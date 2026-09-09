"""文档摄取：多模态读取 → 分片 → SiliconFlow 向量化 → 写回 pgvector。

POST /api/ingest   body: { "document_id": "..." }
调用链：web 上传原文件到 Vercel Blob + 建 Document(uploaded) 后，
web BFF 带 X-Service-Token 调本接口；本接口同步执行：
  1. 从 documents 表取元数据 → 下载 Vercel Blob 原文件（public URL）
  2. 按类型解析：PDF / Word / PPT / Excel / Markdown / HTML / TXT / 图片(视觉模型)
  3. RecursiveCharacterTextSplitter 切分（中文友好分隔符）
  4. SiliconFlow BAAI/bge-m3（免费，1024 维，对齐 vector(1024)）批量向量化
  5. 同事务：清旧 chunk → 插新 chunk(含 embedding) → Document 置 ready/failed

注：同步执行适合 MVP 的小文档（<4MB，几十个 chunk，几秒内完成）。
   超大文件/长任务后续可换 Vercel Background / 消息队列，接口契约不变。
"""
import base64
import io
import logging
import uuid

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config import settings
from app.db import db_connect

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ingest", tags=["ingest"])

# SiliconFlow / Vercel Blob 网络请求超时；图片走视觉模型，单次网络往返
DOWNLOAD_TIMEOUT = 60.0


class IngestRequest(BaseModel):
    document_id: str


def _download(storage_key: str) -> bytes:
    """从 Vercel Blob 下载原文件（public store 的 URL 直接可读）。"""
    with httpx.Client(timeout=DOWNLOAD_TIMEOUT, follow_redirects=True) as client:
        resp = client.get(storage_key)
        resp.raise_for_status()
        return resp.content


def _extract_text(name: str, content_type: str, data: bytes) -> str:
    """按 MIME 类型把二进制解析成纯文本（多模态入口）。"""
    ct = (content_type or "").lower()

    if ct == "application/pdf" or name.lower().endswith(".pdf"):
        from pypdf import PdfReader

        reader = PdfReader(io.BytesIO(data))
        pages = [page.extract_text() or "" for page in reader.pages]
        return "\n\n".join(pages)

    if "wordprocessingml" in ct or name.lower().endswith(".docx"):
        from docx import Document as DocxDocument

        doc = DocxDocument(io.BytesIO(data))
        parts = [p.text for p in doc.paragraphs if p.text.strip()]
        for table in doc.tables:
            for row in table.rows:
                for cell in row.cells:
                    if cell.text.strip():
                        parts.append(cell.text.strip())
        return "\n".join(parts)

    if "presentationml" in ct or name.lower().endswith(".pptx"):
        from pptx import Presentation

        prs = Presentation(io.BytesIO(data))
        parts: list[str] = []
        for slide in prs.slides:
            for shape in slide.shapes:
                if getattr(shape, "has_text_frame", False):
                    for para in shape.text_frame.paragraphs:
                        text = "".join(run.text for run in para.runs).strip()
                        if text:
                            parts.append(text)
                if getattr(shape, "has_table", False):
                    for row in shape.table.rows:
                        cells = [c.text.strip() for c in row.cells]
                        if any(cells):
                            parts.append(" | ".join(cells))
        return "\n".join(parts)

    if "spreadsheetml" in ct or name.lower().endswith(".xlsx"):
        from openpyxl import load_workbook

        wb = load_workbook(io.BytesIO(data), read_only=True, data_only=True)
        parts: list[str] = []
        for ws in wb.worksheets:
            rows = []
            for row in ws.iter_rows(values_only=True):
                cells = [str(c).strip() for c in row if c is not None and str(c).strip()]
                if cells:
                    rows.append(" | ".join(cells))
            if rows:
                parts.append(f"# Sheet: {ws.title}\n" + "\n".join(rows))
        return "\n".join(parts)

    if ct.startswith("image/"):
        return _describe_image(ct, data)

    # markdown / html / txt / log：按 UTF-8 直接解码（带 BOM 兼容）
    return data.decode("utf-8-sig", errors="replace")


def _describe_image(content_type: str, data: bytes) -> str:
    """图片没有文本，交给视觉模型（SiliconFlow OpenAI 兼容）转成文字描述后入库检索。"""
    if not settings.siliconflow_api_key:
        raise RuntimeError("未配置 SILICONFLOW_API_KEY，无法解析图片（需要视觉模型）")

    b64 = base64.b64encode(data).decode()
    data_url = f"data:{content_type};base64,{b64}"
    payload = {
        "model": settings.vision_model,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": data_url}},
                    {
                        "type": "text",
                        "text": (
                            "这是一张用户上传到知识库的图片。请详细描述画面内容，"
                            "并逐字转录图中所有文字，输出结构化 Markdown，便于后续检索。"
                        ),
                    },
                ],
            }
        ],
        "temperature": 0.2,
    }
    headers = {"Authorization": f"Bearer {settings.siliconflow_api_key}"}
    with httpx.Client(timeout=DOWNLOAD_TIMEOUT) as client:
        resp = client.post(
            f"{settings.siliconflow_base_url.rstrip('/')}/chat/completions",
            json=payload,
            headers=headers,
        )
        if resp.status_code != 200:
            raise RuntimeError(
                f"视觉模型调用失败：HTTP {resp.status_code} {resp.text[:300]}"
            )

    content = resp.json()["choices"][0]["message"]["content"]
    # OpenAI 兼容返回可能为纯字符串，或 [{type:'text',text:...}] 结构，两种都兼容
    if isinstance(content, str):
        return content
    return "\n".join(
        item.get("text", "")
        for item in content
        if isinstance(item, dict) and item.get("type") == "text"
    )


def _split_text(text: str) -> list[str]:
    """递归字符切分器：优先在段落/中英文句号处断开，避免语义割裂。"""
    from langchain_text_splitters import RecursiveCharacterTextSplitter

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=800,
        chunk_overlap=150,
        length_function=len,
        separators=["\n\n", "\n", "。", "！", "？", "；", ". ", " ", ""],
    )
    parts = [p.strip() for p in splitter.split_text(text)]
    return [p for p in parts if p]


def _embed_documents(texts: list[str]) -> list[list[float]]:
    """SiliconFlow BAAI/bge-m3 → 1024 维向量（免费，与 vector(1024) 对齐）。

    langchain-openai 的 OpenAIEmbeddings 走 /v1/embeddings（OpenAI 兼容）；
    关闭 tiktoken 长度检查（bge-m3 非 OpenAI tokenizer，且分片远小于上下文上限）。
    """
    if not texts:
        return []
    if not settings.siliconflow_api_key:
        raise RuntimeError("未配置 SILICONFLOW_API_KEY，无法向量化")

    from langchain_openai import OpenAIEmbeddings

    embeddings = OpenAIEmbeddings(
        model=settings.embedding_model,
        api_key=settings.siliconflow_api_key,
        base_url=settings.siliconflow_base_url,
        check_embedding_ctx_length=False,
    )
    return embeddings.embed_documents(texts)


def process_document(document_id: str) -> dict:
    """核心：抓取 → 解析 → 分片 → 向量化 → 事务写回 pgvector。"""
    with db_connect() as conn:
        doc = conn.execute(
            "SELECT id, name, content_type, storage_key, status "
            "FROM documents WHERE id = %s",
            (document_id,),
        ).fetchone()
        if not doc:
            raise HTTPException(status_code=404, detail="文档不存在")

    try:
        raw = _download(doc["storage_key"])
        text = _extract_text(doc["name"], doc["content_type"], raw)
        chunks = _split_text(text)
        if not chunks:
            raise RuntimeError(
                "未能提取出可检索的文字（扫描版 PDF / 纯图片无文字的文档，请先转成文本）"
            )

        vectors = _embed_documents(chunks)
        if len(vectors) != len(chunks):
            raise RuntimeError(
                f"向量数量({len(vectors)})与分片数量({len(chunks)})不一致"
            )

        with db_connect() as conn:
            with conn.cursor() as cur:
                # 重跑语义：先清空该文档旧分片，再写入新分片
                cur.execute(
                    'DELETE FROM chunks WHERE "documentId" = %s', (document_id,)
                )
                for seq, (content, vec) in enumerate(zip(chunks, vectors)):
                    vector_literal = "[" + ",".join(repr(float(v)) for v in vec) + "]"
                    cur.execute(
                        'INSERT INTO chunks '
                        '(id, "documentId", seq, content, embedding, "createdAt") '
                        "VALUES (%s, %s, %s, %s, %s::vector, now())",
                        (uuid.uuid4().hex, document_id, seq, content, vector_literal),
                    )
                cur.execute(
                    'UPDATE documents SET status = %s, chunk_count = %s, '
                    'error = NULL, "updatedAt" = now() WHERE id = %s',
                    ("ready", len(chunks), document_id),
                )
            conn.commit()

        logger.info("ingested doc=%s chunks=%d", document_id, len(chunks))
        return {"document_id": document_id, "status": "ready", "chunks": len(chunks)}

    except HTTPException:
        raise  # 文档不存在，不需要把状态打成 failed
    except Exception as exc:  # 解析/网络/向量化失败：记录原因方便前端展示
        logger.exception("ingest failed doc=%s", document_id)
        try:
            with db_connect() as conn:
                conn.execute(
                    'UPDATE documents SET status = %s, error = %s, '
                    '"updatedAt" = now() WHERE id = %s',
                    ("failed", str(exc)[:500], document_id),
                )
                conn.commit()
        except Exception:
            logger.exception("failed to persist error state for doc=%s", document_id)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("")
def run_ingest(req: IngestRequest) -> dict:
    """web 上传完成后调用：同步解析入库。"""
    return process_document(req.document_id)
