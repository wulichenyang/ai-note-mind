"""LangGraph RAG Agent：检索 → 生成（SSE 流式）。

POST /api/rag   body:
{
  "user_id": "...",          // web 登录用户（多租户隔离依据）
  "question": "...",
  "history": [{"role": "user", "content": "..."}],   // 最近对话，供多轮理解
  "llm": {                    // BYOK：DeepSeek Key 由 web 解密后传进来
    "api_key": "sk-...",
    "model": "deepseek-chat",
    "base_url": "https://api.deepseek.com"
  }
}

图结构（StateGraph）：
  START → retrieve（查 pgvector，按 ownerId 过滤）→ generate（LLM 流式作答）→ END

SSE 事件流（供 web BFF / 前端消费）：
  data: {"sources": [...]}        # 检索到的参考片段（在生成前发出）
  data: {"token": "..."}          # 逐 token 的回复正文
  data: {"error": "..."}          # 异常
  data: {"done": true}            # 结束帧
"""
import asyncio
import json
import logging
from typing import Annotated, TypedDict

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from langchain_core.messages import AIMessageChunk, HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel

from app.config import settings
from app.db import db_connect

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/rag", tags=["rag"])

TOP_K = 6  # 检索返回的参考片段数


def _vector_literal(vector: list[float]) -> str:
    """把 Python float 列表转成 pgvector 的字面量字符串（配合 ::vector 使用）。"""
    return "[" + ",".join(repr(float(v)) for v in vector) + "]"


# ---------------- 图状态 ----------------
class RagState(TypedDict):
    user_id: str
    document_id: str  # 空 = 全库检索；非空 = 只在该文档内检索（知识库"追问"）
    question: str
    history: list[dict]
    llm: dict
    context: list[dict]  # [{name, content}]
    answer: str
    sources: list[dict]


# ---------------- 节点 1：向量检索 ----------------
def retrieve_node(state: RagState) -> dict:
    """把问题向量化，在用户自己的文档 chunk 里做余弦最近邻检索。"""
    if not settings.siliconflow_api_key:
        raise ValueError("未配置 SILICONFLOW_API_KEY，无法检索")

    from langchain_openai import OpenAIEmbeddings

    embeddings = OpenAIEmbeddings(
        model=settings.embedding_model,
        api_key=settings.siliconflow_api_key,
        base_url=settings.siliconflow_base_url,
        check_embedding_ctx_length=False,
    )
    query_vec = embeddings.embed_query(state["question"])

    sql = (
        'SELECT c.id, c.content, d.name FROM chunks c '
        'JOIN documents d ON d.id = c."documentId" '
        'WHERE d."ownerId" = %s AND c.embedding IS NOT NULL '
    )
    params: list = [state["user_id"]]
    if state.get("document_id"):
        sql += 'AND d.id = %s '
        params.append(state["document_id"])
    sql += "ORDER BY c.embedding <=> %s::vector LIMIT %s"
    params += [_vector_literal(query_vec), TOP_K]

    with db_connect() as conn:
        rows = conn.execute(sql, params).fetchall()

    context = [
        {"name": row["name"], "content": row["content"]} for row in rows
    ]
    logger.info("rag retrieve user=%s hits=%d", state["user_id"], len(context))
    return {"context": context}


# ---------------- 节点 2：生成 ----------------
def _to_text(content) -> str:
    """兼容 ChatOpenAI 返回的 str 或 [{type:'text',text:...}] 结构。"""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(
            item.get("text", "") for item in content if isinstance(item, dict)
        )
    return ""


async def generate_node(state: RagState) -> dict:
    """基于检索上下文 + 历史对话，流式生成答案。"""
    llm_cfg = state.get("llm") or {}
    api_key = (llm_cfg.get("api_key") or "").strip()
    if not api_key:
        raise ValueError("缺少 llm.api_key（请先在设置页配置 DeepSeek Key）")

    from langchain_openai import ChatOpenAI

    llm = ChatOpenAI(
        model=llm_cfg.get("model") or settings.ai_model,
        api_key=api_key,
        base_url=llm_cfg.get("base_url") or settings.ai_base_url,
        temperature=0.3,
        streaming=True,
    )

    messages: list = [SystemMessage(content=_build_system_prompt(state["context"]))]
    for item in state.get("history") or []:
        role = item.get("role")
        content = str(item.get("content", ""))[:2000]
        if role == "user":
            messages.append(HumanMessage(content=content))
        elif role == "assistant":
            messages.append(AIMessageChunk(content=content))
    messages.append(HumanMessage(content=state["question"]))

    chunks: list[AIMessageChunk] = []
    async for chunk in llm.astream(messages):
        chunks.append(chunk)
    answer = "".join(_to_text(c.content) for c in chunks)
    return {"answer": answer, "sources": state.get("context") or []}


def _build_system_prompt(context: list[dict]) -> str:
    blocks = []
    for i, item in enumerate(context, start=1):
        blocks.append(f"[{i}] 来源文档《{item['name']}》：\n{item['content']}")
    ref = "\n\n".join(blocks) if blocks else "（没有检索到相关资料）"
    return (
        "你是 NoteMind 的智能知识库助手。请只依据下列「参考资料」回答用户问题：\n"
        f"\n===== 参考资料 =====\n{ref}\n===== 参考资料结束 =====\n\n"
        "规则：\n"
        "1. 优先用参考资料里的内容回答，回答末尾用 [1] 标注引用来源编号；\n"
        "2. 参考资料不足以回答时，明确说“资料里没有相关内容”，不要编造；\n"
        "3. 结合最近对话历史理解追问（例如“它的结论是什么”中的“它”指前文主题）；\n"
        "4. 用 Markdown 排版，保持简洁。"
    )


# ---------------- 图编译 ----------------
def _build_graph():
    builder = StateGraph(RagState)
    builder.add_node("retrieve_node", retrieve_node)
    builder.add_node("generate_node", generate_node)
    builder.add_edge(START, "retrieve_node")
    builder.add_edge("retrieve_node", "generate_node")
    builder.add_edge("generate_node", END)
    return builder.compile()


_rag_graph = _build_graph()


# ---------------- 请求 / SSE ----------------
class RagRequest(BaseModel):
    user_id: str
    question: str
    document_id: str = ""  # 可选：限定单文档（知识库"追问该文件"）
    history: list[dict] = []
    llm: dict = {}


def _sse(obj: dict) -> str:
    return f"data: {json.dumps(obj, ensure_ascii=False)}\n\n"


@router.post("")
async def rag(req: RagRequest) -> StreamingResponse:
    user_id = (req.user_id or "").strip()
    question = (req.question or "").strip()
    if not user_id:
        raise HTTPException(status_code=400, detail="缺少 user_id")
    if not question:
        raise HTTPException(status_code=400, detail="问题不能为空")

    state: RagState = {
        "user_id": user_id,
        "document_id": (req.document_id or "").strip(),
        "question": question[:2000],
        "history": (req.history or [])[-12:],  # 只带最近 12 条，控制上下文
        "llm": req.llm or {},
        "context": [],
        "answer": "",
        "sources": [],
    }

    async def event_stream():
        try:
            async for event in _rag_graph.astream_events(
                state, config={"recursion_limit": 10}, version="v2"
            ):
                # 1) 检索完成后立刻把参考来源推给前端（先于正文）
                if (
                    event["event"] == "on_chain_end"
                    and event.get("name") == "retrieve_node"
                ):
                    data = event.get("data", {}).get("output") or {}
                    sources = data.get("context") or []
                    yield _sse(
                        {"sources": [{"name": s["name"], "content": s["content"][:500]} for s in sources]}
                    )
                # 2) LLM 逐 token 流式
                if event["event"] == "on_chat_model_stream":
                    chunk = event["data"].get("chunk")
                    if isinstance(chunk, AIMessageChunk):
                        token = _to_text(chunk.content)
                        if token:
                            yield _sse({"token": token})
        except HTTPException as exc:
            yield _sse({"error": exc.detail})
        except Exception as exc:  # 网络/Key/超时等：把原因透传给前端展示
            logger.exception("rag failed user=%s", user_id)
            yield _sse({"error": str(exc)[:500]})
        yield _sse({"done": True})

    return StreamingResponse(event_stream(), media_type="text/event-stream")
