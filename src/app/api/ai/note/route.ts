import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { getUserAiClient, streamChatRaw, toSseResponse } from "@/lib/ai";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * 笔记 AI 功能路由
 * POST /api/ai/note  { noteId, action: "summary" | "continue" }
 * -------------------------------------------------
 * 为什么用 API Route 而不是 Server Action？
 * 流式响应（SSE）需要直接操作 Response 流对象，
 * Server Action 面向表单提交，不适合实时流式输出。
 *
 * 安全（BYOK）：
 * 1. auth() 校验登录
 * 2. findFirst + authorId 校验笔记所有权
 * 3. 用用户自己的 DeepSeek Key 发起调用（服务端解密，绝不下发）
 * 4. 未配置 Key 返回 403，引导去设置页
 */

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "未登录" }, { status: 401 });
  }

  // 用户未配置自己的 Key：403 引导去设置页（不消耗任何共享额度）
  const ai = await getUserAiClient(session.user.id);
  if (!ai) {
    return Response.json(
      { error: "你还没有配置 DeepSeek Key，请到「设置」页填写后使用" },
      { status: 403 },
    );
  }

  const { noteId, action } = await req.json();
  if (!noteId || !["summary", "continue"].includes(action)) {
    return Response.json({ error: "参数错误" }, { status: 400 });
  }

  // 所有权校验：只有笔记作者能调用 AI
  const note = await prisma.note.findFirst({
    where: { id: noteId, authorId: session.user.id },
    select: { title: true, content: true },
  });
  if (!note) {
    return Response.json({ error: "笔记不存在" }, { status: 404 });
  }

  // 按动作构造不同的提示词
  const system =
    action === "summary"
      ? "你是专业的笔记助手。请为用户总结这篇笔记的核心要点，用简洁的要点列表输出，使用 Markdown 格式。"
      : "你是专业的笔记助手。请基于这篇笔记的内容继续扩展写作，保持一致的风格和主题，使用 Markdown 格式。";

  // 原生 OpenAI 流式：用该用户自己的客户端逐片生成并封装成 SSE 响应
  return toSseResponse(
    streamChatRaw({
      client: ai.client,
      model: ai.model,
      system,
      messages: [{ role: "user", content: `笔记标题：${note.title}\n\n笔记内容：\n${note.content}` }],
      temperature: 0.7,
      maxTokens: 1024,
    }),
  );
}
