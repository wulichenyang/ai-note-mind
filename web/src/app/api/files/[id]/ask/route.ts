import { auth } from "@/auth";
import { getUserAiSecret } from "@/lib/ai";
import { openRagSse } from "@/lib/agent";
import { prisma } from "@/lib/prisma";
import { toSseResponse } from "@/lib/ai";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * 知识库"追问"路由（单文档 RAG 问答）
 * POST /api/files/:id/ask   body: { question }
 * -------------------------------------------------
 * 1. 鉴权 + 校验文档归属且已 ready
 * 2. 解密用户 DeepSeek Key（BYOK）→ 与 document_id 一起传给 agent /api/rag
 * 3. 把 agent 的 SSE 帧转换成 OpenAI 标准流式格式返回给前端渲染
 *
 * 说明：这里是"无状态单轮问答"（不写入 chats 表）。
 * 需要多轮记忆时，由 Chat 页面与会话挂钩，接口契约不变。
 */

function sseDataParser(): (frame: string) => { token?: string; error?: string; done?: boolean } {
  return (frame) => {
    if (!frame.startsWith("data: ")) return {};
    try {
      const obj = JSON.parse(frame.slice(6));
      return obj as { token?: string; error?: string; done?: boolean };
    } catch {
      return {};
    }
  };
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "未登录" }, { status: 401 });
  }
  const userId = session.user.id;
  const { id } = await params;

  const doc = await prisma.document.findFirst({
    where: { id, ownerId: userId },
    select: { id: true, status: true, name: true },
  });
  if (!doc) {
    return Response.json({ error: "文件不存在" }, { status: 404 });
  }
  if (doc.status !== "ready") {
    return Response.json(
      { error: doc.status === "failed" ? "该文件解析失败，请先重新解析" : "文件还在解析中，请稍候" },
      { status: 409 },
    );
  }

  const secret = await getUserAiSecret(userId);
  if (!secret) {
    return Response.json(
      { error: "你还没有配置 DeepSeek Key，请到「设置」页填写后使用" },
      { status: 403 },
    );
  }

  const { question } = await req.json();
  if (!question || typeof question !== "string" || !question.trim()) {
    return Response.json({ error: "问题不能为空" }, { status: 400 });
  }
  const trimmed = question.trim().slice(0, 2000);

  // 建立到 agent 的 SSE，边收边转成 OpenAI 标准格式逐 token 输出
  const generator = (async function* () {
    let resp: Response;
    try {
      resp = await openRagSse({
        user_id: userId,
        document_id: doc.id,
        question: trimmed,
        history: [],
        llm: { api_key: secret.apiKey, model: secret.model, base_url: secret.baseUrl },
      });
    } catch (err) {
      throw new Error(`知识库服务不可用：${(err as Error).message}`);
    }
    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}));
      throw new Error((body as { detail?: string }).detail ?? `知识库服务返回 ${resp.status}`);
    }
    if (!resp.body) throw new Error("知识库服务无响应");

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    const parse = sseDataParser();
    let buffer = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";
        for (const frame of frames) {
          const evt = parse(frame);
          if (evt.error) throw new Error(evt.error);
          if (evt.token) yield evt.token;
          if (evt.done) return;
        }
      }
    } finally {
      reader.releaseLock();
    }
  })();

  return toSseResponse(generator);
}
