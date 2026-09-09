import "server-only";

/**
 * web BFF → agent(Python) 的内部调用
 * -------------------------------------------------
 * agent 服务只接受带 X-Service-Token 的请求，且不直接暴露公网，
 * 所有调用都经由本模块（复用 AGENT_BASE_URL / AGENT_SERVICE_TOKEN）。
 */

function agentUrl(path: string) {
  const base = process.env.AGENT_BASE_URL?.replace(/\/$/, "") ?? "";
  return `${base}${path}`;
}

function headers(json = true) {
  return {
    "X-Service-Token": process.env.AGENT_SERVICE_TOKEN ?? "",
    ...(json ? { "Content-Type": "application/json" } : {}),
  };
}

/** 触发/重试单文档解析（agent 同步执行，超时上限 50s） */
export async function callAgentIngest(documentId: string): Promise<void> {
  const resp = await fetch(agentUrl("/api/ingest"), {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ document_id: documentId }),
    signal: AbortSignal.timeout(50_000),
  });
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error((body as { detail?: string }).detail ?? `agent 返回 ${resp.status}`);
  }
}

/** 笔记保存后触发向量索引重建（agent 同步执行，超时上限 50s） */
export async function callAgentIngestNote(noteId: string): Promise<void> {
  const resp = await fetch(agentUrl("/api/ingest/note"), {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ note_id: noteId }),
    signal: AbortSignal.timeout(50_000),
  });
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error((body as { detail?: string }).detail ?? `agent 返回 ${resp.status}`);
  }
}

/** 打开到 agent /api/chat 的 SSE 流（AI 对话意图路由，BFF 转发用） */
export function openChatSse(payload: object): Promise<Response> {
  return fetch(agentUrl("/api/chat"), {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(55_000),
  });
}
