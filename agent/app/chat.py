"""AI 对话 Agent：意图路由 →（命中则检索知识库）→ 生成（SSE 流式）。

POST /api/chat   body:
{
  "user_id": "...",                 // web 登录用户（多租户隔离依据）
  "question": "...",
  "history": [{"role": "user"|"assistant", "content": "..."}],  // 最近对话
  "llm": {                          // BYOK：DeepSeek Key 由 web 解密后传进来
    "api_key": "sk-...",
    "model": "deepseek-chat",
    "base_url": "https://api.deepseek.com"
  }
}

图结构（LangGraph，用户选的「LLM 意图路由」方案）：
  START → judge（LLM 判断该问题是否依赖个人知识库）
    ├─ need_knowledge=True  → retrieve（文档 chunks + 笔记 note_chunks 联合检索）→ generate
    └─ need_knowledge=False → generate（普通闲聊，不带检索上下文）
  generate → END

SSE 事件流（供 web BFF 消费，帧语义与 /api/rag 保持一致并扩展）：
  data: {"mode": "knowledge"|"chat"}         # 意图路由结果（judge 结束即推）
  data: {"sources": [{type,name,content}]}   # 命中时的参考片段（先于正文，type: document|note）
  data: {"token": "..."}                     # 逐 token 正文
  data: {"error": "..."}                     # 异常
  data: {"done": true}                       # 结束帧
"""
import json
import logging
import re
from typing import TypedDict

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from langchain_core.messages import AIMessage, AIMessageChunk, HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel

from app.config import settings
from app.db import db_connect

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["chat"])

TOP_K = 6          # 最终送入生成的参考片段总数
PER_TYPE_K = 8     # 文档/笔记各自先取多少，再跨类型合并取 TOP_K


def _vector_literal(vector: list[float]) -> str:
    """把 Python float 列表转成 pgvector 的字面量字符串（配合 ::vector 使用）。"""
    return "[" + ",".join(repr(float(v)) for v in vector) + "]"


def _to_text(content) -> str:
    """兼容 LLM 返回的 str 或 [{type:'text',text:...}] 结构。"""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(
            item.get("text", "") for item in content if isinstance(item, dict)
        )
    return ""


def _parse_need_knowledge(text: str) -> bool:
    """从 LLM 意图判断输出里解析 need_knowledge。

    要求模型只输出严格 JSON，这里先正则直取字段值，失败再兜底整体 JSON.parse。
    """
    raw = (text or "").strip()
    m = re.search(r'"need_knowledge"\s*:\s*(true|false)', raw, re.IGNORECASE)
    if m:
        return m.group(1).lower() == "true"
    m_obj = re.search(r"\{.*\}", raw, re.DOTALL)
    if m_obj:
        try:
            obj = json.loads(m_obj.group(0))
            if isinstance(obj, dict) and "need_knowledge" in obj:
                return bool(obj["need_knowledge"])
        except Exception:
            pass
    return False


# ---------------- 图状态 ----------------
class ChatState(TypedDict):
    user_id: str
    question: str
    history: list[dict]
    llm: dict
    need_knowledge: bool   # judge 的意图路由结果
    context: list[dict]    # [{type: "document"|"note", name, content}]
    answer: str
    sources: list[dict]


# ---------------- LLM 工厂 ----------------
def _make_llm(llm_cfg: dict, temperature: float, streaming: bool):
    """用用户 BYOK 的 DeepSeek 配置构造 ChatOpenAI（流式与否按用途切换）。"""
    api_key = (llm_cfg.get("api_key") or "").strip()
    if not api_key:
        raise ValueError("缺少 llm.api_key（请先在设置页配置 DeepSeek Key）")
    from langchain_openai import ChatOpenAI

    return ChatOpenAI(
        model=llm_cfg.get("model") or settings.ai_model,
        api_key=api_key,
        base_url=llm_cfg.get("base_url") or settings.ai_base_url,
        temperature=temperature,
        streaming=streaming,
        max_retries=0,
    )


# ---------------- 节点 1：LLM 意图路由 ----------------
def _build_judge_messages(question: str, history: list[dict]) -> list:
    system = (
        "你是 NoteMind 的「知识库意图路由器」。只做一件事：判断用户这个问题，"
        "是否必须依赖「用户自己上传的文档或笔记」才能给出可靠回答。\n"
        '只输出严格 JSON（不要 Markdown、不要解释）：{"need_knowledge": true 或 false}\n\n'
        "判断要点：\n"
        "- 输出 true：问题明显在问用户的个人材料 —— 例如“我笔记/文档/上传的资料里…”“总结我的笔记”"
        "“我之前记过/上传过…”“我库里的 XX”；或问题引用前面对话中已讨论过的用户资料内容。\n"
        "- 输出 false：寒暄闲聊、通用知识问答（不查个人资料也能回答）、工具性请求"
        "（如“帮我润色”“推荐一本书”）、与个人资料无关的问题。\n"
        "拿不准时倾向 false：宁可普通回答，也不要把闲聊硬塞进知识库检索。"
    )
    messages: list = [SystemMessage(content=system)]
    for item in history[-6:]:  # 只带最近 6 条上下文帮助理解“它/那个文件”这类指代
        role = item.get("role")
        content = str(item.get("content", ""))[:1000]
        if role == "user":
            messages.append(HumanMessage(content=content))
        elif role == "assistant":
            messages.append(AIMessage(content=content))
    messages.append(HumanMessage(content=question))
    return messages


async def judge_node(state: ChatState) -> dict:
    """LLM 判断是否需要读知识库（非流式小调用，温度 0 提高稳定性）。"""
    llm = _make_llm(state.get("llm") or {}, temperature=0.0, streaming=False)
    resp = await llm.ainvoke(_build_judge_messages(state["question"], state.get("history") or []))
    need = _parse_need_knowledge(_to_text(resp.content))
    logger.info("judge user=%s need_knowledge=%s", state["user_id"], need)
    return {"need_knowledge": need}


# ---------------- 节点 2：联合向量检索 ----------------
def _embed_query(text: str) -> list[float]:
    """把问题转成 1024 维查询向量（SiliconFlow bge-m3，与入库同模型）。"""
    if not settings.siliconflow_api_key:
        raise ValueError("未配置 SILICONFLOW_API_KEY，无法检索")
    from langchain_openai import OpenAIEmbeddings

    embeddings = OpenAIEmbeddings(
        model=settings.embedding_model,
        api_key=settings.siliconflow_api_key,
        base_url=settings.siliconflow_base_url,
        check_embedding_ctx_length=False,
    )
    return embeddings.embed_query(text)


def _retrieve_one_type(sql: str, params: list, query_vec: list[float]) -> list[dict]:
    with db_connect() as conn:
        rows = conn.execute(sql, params).fetchall()
    return [
        {"type": row["source_type"], "name": row["name"], "content": row["content"],
         "dist": row["dist"]}
        for row in rows
    ]


def retrieve_node(state: ChatState) -> dict:
    """问题向量化后，在「文档 chunks」和「笔记 note_chunks」两张表里各查最近邻，
    按距离跨类型合并，取 TOP_K 条作为参考资料。"""
    query_vec = _embed_query(state["question"])

    # 1) 用户上传的文档（documents → chunks）
    doc_sql = (
        'SELECT %s AS source_type, d.name, c.content, '
        '(c.embedding <=> %s::vector) AS dist '
        "FROM chunks c JOIN documents d ON d.id = c.\"documentId\" "
        'WHERE d."ownerId" = %s AND c.embedding IS NOT NULL '
        'ORDER BY dist LIMIT %s'
    )
    doc_hits = _retrieve_one_type(
        doc_sql, ["document", _vector_literal(query_vec), state["user_id"], PER_TYPE_K],
        query_vec,
    )

    # 2) 用户自己的笔记（notes → note_chunks，标题作为展示名）
    note_sql = (
        'SELECT %s AS source_type, COALESCE(n.title, \'未命名笔记\') AS name, c.content, '
        '(c.embedding <=> %s::vector) AS dist '
        'FROM note_chunks c JOIN notes n ON n.id = c."noteId" '
        'WHERE n."authorId" = %s AND c.embedding IS NOT NULL '
        'ORDER BY dist LIMIT %s'
    )
    note_hits = _retrieve_one_type(
        note_sql, ["note", _vector_literal(query_vec), state["user_id"], PER_TYPE_K],
        query_vec,
    )

    hits = sorted(doc_hits + note_hits, key=lambda r: r["dist"])[:TOP_K]
    context = [
        {"type": h["type"], "name": h["name"], "content": h["content"]} for h in hits
    ]
    logger.info("retrieve user=%s doc=%d note=%d total=%d",
                state["user_id"], len(doc_hits), len(note_hits), len(context))
    return {"context": context}


# ---------------- 节点 3：生成 ----------------
def _build_generate_system(context: list[dict]) -> str:
    """带检索上下文时要求依据资料作答并标注引用；无上下文时回到通用助手。"""
    if not context:
        return (
            "你是 NoteMind 的 AI 助手，负责和用户日常对话。\n"
            "回答要求：\n"
            "1. 使用简洁、自然的中文，结构化内容用 Markdown；\n"
            "2. 该回答不依赖用户知识库；若用户提到“我的笔记/文档”里的内容，"
            "而你不确定，可提示用户说得更具体些。"
        )

    blocks = []
    for i, item in enumerate(context, start=1):
        kind = "文档" if item["type"] == "document" else "笔记"
        blocks.append(f"[{i}] {kind}《{item['name']}》：\n{item['content']}")
    ref = "\n\n".join(blocks)
    return (
        "你是 NoteMind 的智能知识库助手。请只依据下列「参考资料」回答用户问题：\n"
        f"\n===== 参考资料 =====\n{ref}\n===== 参考资料结束 =====\n\n"
        "规则：\n"
        "1. 优先用参考资料里的内容回答，关键处用 [1] 形式标注引用的编号；\n"
        "2. 参考资料不足以回答时，明确说“资料里没有相关内容”，不要编造；\n"
        "3. 结合最近对话历史理解追问（例如“它的结论是什么”中的“它”指前文主题）；\n"
        "4. 用 Markdown 排版，保持简洁。"
    )


async def generate_node(state: ChatState) -> dict:
    """基于检索上下文（可能为空）+ 历史对话，流式生成答案。"""
    llm = _make_llm(state.get("llm") or {}, temperature=0.3, streaming=True)

    messages: list = [SystemMessage(content=_build_generate_system(state["context"]))]
    for item in (state.get("history") or [])[-12:]:
        role = item.get("role")
        content = str(item.get("content", ""))[:2000]
        if role == "user":
            messages.append(HumanMessage(content=content))
        elif role == "assistant":
            messages.append(AIMessage(content=content))
    messages.append(HumanMessage(content=state["question"]))

    chunks: list[AIMessageChunk] = []
    async for chunk in llm.astream(messages):
        chunks.append(chunk)
    answer = "".join(_to_text(c.content) for c in chunks)
    return {"answer": answer, "sources": state.get("context") or []}


# ---------------- 图编译 ----------------
def _route(state: ChatState) -> str:
    return "retrieve" if state.get("need_knowledge") else "generate"


def _build_graph():
    builder = StateGraph(ChatState)
    builder.add_node("judge_node", judge_node)
    builder.add_node("retrieve_node", retrieve_node)
    builder.add_node("generate_node", generate_node)
    builder.add_edge(START, "judge_node")
    builder.add_conditional_edges(
        "judge_node", _route, {"retrieve": "retrieve_node", "generate": "generate_node"}
    )
    builder.add_edge("retrieve_node", "generate_node")
    builder.add_edge("generate_node", END)
    return builder.compile()


_chat_graph = _build_graph()


# ---------------- 请求 / SSE ----------------
class ChatRequest(BaseModel):
    user_id: str
    question: str
    history: list[dict] = []
    llm: dict = {}


def _sse(obj: dict) -> str:
    return f"data: {json.dumps(obj, ensure_ascii=False)}\n\n"


@router.post("")
async def chat(req: ChatRequest) -> StreamingResponse:
    user_id = (req.user_id or "").strip()
    question = (req.question or "").strip()
    if not user_id:
        raise HTTPException(status_code=400, detail="缺少 user_id")
    if not question:
        raise HTTPException(status_code=400, detail="消息不能为空")

    state: ChatState = {
        "user_id": user_id,
        "question": question[:2000],
        "history": (req.history or [])[-12:],
        "llm": req.llm or {},
        "need_knowledge": False,
        "context": [],
        "answer": "",
        "sources": [],
    }

    async def event_stream():
        try:
            async for event in _chat_graph.astream_events(
                state, config={"recursion_limit": 10}, version="v2"
            ):
                # 1) judge 结束：先推意图路由结果（mode 帧）
                if (
                    event["event"] == "on_chain_end"
                    and event.get("name") == "judge_node"
                ):
                    output = event.get("data", {}).get("output") or {}
                    need = bool(output.get("need_knowledge"))
                    yield _sse({"mode": "knowledge" if need else "chat"})
                # 2) 检索结束：命中则推参考来源（先于正文）
                if (
                    event["event"] == "on_chain_end"
                    and event.get("name") == "retrieve_node"
                ):
                    data = event.get("data", {}).get("output") or {}
                    sources = data.get("context") or []
                    if sources:
                        yield _sse({
                            "sources": [
                                {"type": s["type"], "name": s["name"],
                                 "content": s["content"][:500]}
                                for s in sources
                            ]
                        })
                # 3) LLM 逐 token 流式（只来自 generate_node 的流式调用）
                if event["event"] == "on_chat_model_stream":
                    chunk = event["data"].get("chunk")
                    if isinstance(chunk, AIMessageChunk):
                        token = _to_text(chunk.content)
                        if token:
                            yield _sse({"token": token})
        except HTTPException as exc:
            yield _sse({"error": exc.detail})
        except Exception as exc:
            logger.exception("chat failed user=%s", user_id)
            yield _sse({"error": str(exc)[:500]})
        yield _sse({"done": True})

    return StreamingResponse(event_stream(), media_type="text/event-stream")
