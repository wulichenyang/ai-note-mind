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

图结构（LangGraph，混合意图路由：「向量预检优先 + LLM 兜底」）：
  START → route_node：
    1) 先把问题向量化，对「文档 chunks + 笔记 note_chunks」做联合检索；
    2) 若最相似片段距离 <= SIM_CUTOFF（说明用户知识库里确实有相关内容，
       例如课程文档撞上“什么是 RAG”这类通用问法）→ 直接判定命中，带上参考；
    3) 否则才调用 LLM 判断该问题是否依赖个人资料（处理“总结我的笔记”、
       多轮代词指代等向量不强但语义明确的场景）。
  → generate_node（命中则带参考生成，未命中则普通对话）→ END

SSE 事件流（供 web BFF 消费，帧语义与 /api/rag 保持一致并扩展）：
  data: {"mode": "knowledge"|"chat"}         # 路由结果（route_node 结束即推）
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
# 余弦距离 = 1 - 余弦相似度。实测同一主题课程文档命中约 0.29~0.39，
# 通用闲聊（天气/写诗/自我介绍）约 0.50~0.63，0.45 为清晰分界。
SIM_CUTOFF = 0.45


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


# ---------------- 检索（向量预检 + 命中组装） ----------------
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


def _retrieve_one_type(sql: str, params: list) -> list[dict]:
    with db_connect() as conn:
        rows = conn.execute(sql, params).fetchall()
    return [
        {"type": row["source_type"], "name": row["name"], "content": row["content"],
         "dist": row["dist"]}
        for row in rows
    ]


def _search_knowledge(user_id: str, question: str) -> tuple[list[dict], float]:
    """文档 chunks + 笔记 note_chunks 联合最近邻检索。

    返回 (带 dist 的命中列表(已按距离升序取前 TOP_K), 最相似距离 best_dist)。
    best_dist = 1.0 表示知识库里没有任何可检索内容。
    """
    query_vec = _embed_query(question)

    doc_sql = (
        'SELECT %s AS source_type, d.name, c.content, '
        '(c.embedding <=> %s::vector) AS dist '
        "FROM chunks c JOIN documents d ON d.id = c.\"documentId\" "
        'WHERE d."ownerId" = %s AND c.embedding IS NOT NULL '
        'ORDER BY dist LIMIT %s'
    )
    doc_hits = _retrieve_one_type(
        doc_sql, ["document", _vector_literal(query_vec), user_id, PER_TYPE_K]
    )

    note_sql = (
        'SELECT %s AS source_type, COALESCE(n.title, \'未命名笔记\') AS name, c.content, '
        '(c.embedding <=> %s::vector) AS dist '
        'FROM note_chunks c JOIN notes n ON n.id = c."noteId" '
        'WHERE n."authorId" = %s AND c.embedding IS NOT NULL '
        'ORDER BY dist LIMIT %s'
    )
    note_hits = _retrieve_one_type(
        note_sql, ["note", _vector_literal(query_vec), user_id, PER_TYPE_K]
    )

    hits = sorted(doc_hits + note_hits, key=lambda r: r["dist"])[:TOP_K]
    best = hits[0]["dist"] if hits else 1.0
    return hits, best


# ---------------- LLM 兜底判断（仅当向量预检未强命中时） ----------------
def _build_judge_messages(question: str, history: list[dict]) -> list:
    system = (
        "你是 NoteMind 的「知识库意图路由器」。系统已提前对用户的知识库做过一次向量检索，"
        "但**没有发现与这个问题足够相关的内容**。现在需要你兜底判断：这个问题是否仍然"
        "必须依赖「用户自己上传的文档或笔记」才能回答。\n"
        '只输出严格 JSON（不要 Markdown、不要解释）：{"need_knowledge": true 或 false}\n\n'
        "输出 true 的场景：\n"
        "- 用户明确要求查看/总结/引用自己的资料：“我的笔记/文档里…”“总结我的笔记”"
        "“我上传的…”“把 XX 整理成…”；\n"
        "- 问题引用了前面对话中已出现的用户资料内容（如“那个文件”“它的结论”）。\n"
        "输出 false：寒暄、纯粹通用知识问答、创作请求、与个人资料无关的问题。\n"
        "拿不准时倾向 false。"
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


async def _llm_judge(state: ChatState) -> bool:
    """非流式小调用，温度 0 提高稳定性。"""
    llm = _make_llm(state.get("llm") or {}, temperature=0.0, streaming=False)
    resp = await llm.ainvoke(
        _build_judge_messages(state["question"], state.get("history") or [])
    )
    return _parse_need_knowledge(_to_text(resp.content))


# ---------------- 节点 1：路由（向量预检优先 + LLM 兜底） ----------------
async def route_node(state: ChatState) -> dict:
    """决定本次是否带知识库上下文生成。

    - 向量预检命中（best_dist <= SIM_CUTOFF）→ 直接用检索结果；
    - 未命中 → LLM 兜底判断（覆盖“总结我的笔记”、指代追问等表述）。
    只要最终判定命中且确有内容，就把 topK 参考资料放 context 交给 generate。
    """
    hits, best = _search_knowledge(state["user_id"], state["question"])

    if best <= SIM_CUTOFF:
        use_context = True
        judge = None
    else:
        judge = await _llm_judge(state)
        # LLM 判 true 但库里根本没内容时，退化为普通回答，避免无据硬答
        use_context = bool(judge) and bool(hits)

    context = [
        {"type": h["type"], "name": h["name"], "content": h["content"]}
        for h in (hits if use_context else [])
    ]
    logger.info(
        "route user=%s best_dist=%.3f llm_judge=%s use_context=%s hits=%d",
        state["user_id"], best, judge, use_context, len(context),
    )
    return {"need_knowledge": use_context, "context": context}


# ---------------- 节点 2：生成 ----------------
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
def _build_graph():
    builder = StateGraph(ChatState)
    builder.add_node("route_node", route_node)
    builder.add_node("generate_node", generate_node)
    builder.add_edge(START, "route_node")
    builder.add_edge("route_node", "generate_node")
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
                # 1) route_node 结束：推意图路由结果（mode 帧），命中则推参考来源
                if (
                    event["event"] == "on_chain_end"
                    and event.get("name") == "route_node"
                ):
                    output = event.get("data", {}).get("output") or {}
                    need = bool(output.get("need_knowledge"))
                    yield _sse({"mode": "knowledge" if need else "chat"})
                    sources = output.get("context") or []
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
