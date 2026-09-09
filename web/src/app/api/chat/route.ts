import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { getUserAiClient, streamChatRaw, toSseResponse } from "@/lib/ai";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * AI 对话路由
 * POST /api/chat  { chatId?: string, content: string }
 * -------------------------------------------------
 * 功能：
 * 1. 校验登录 + 会话所有权（多租户隔离）
 * 2. 用用户自己的 DeepSeek Key（BYOK），未配置返回 403
 * 3. 无 chatId 时自动新建会话（取首条消息前 20 字做标题）
 * 4. 持久化用户消息，读取历史消息（最近 20 条）
 * 5. RAG：把用户最近 8 篇笔记的标题+摘要注入 system prompt
 * 6. 流式生成，边流边在结束帧持久化完整助手回复
 * 7. 首帧 SSE 元数据返回 chatId，前端据此更新 URL / 侧栏
 *
 * 为什么在这里持久化而非前端再发一次请求？
 * 服务端在生成结束时已持有完整文本，一次请求完成"生成+存储"，
 * 前端只管渲染，逻辑更内聚、也避免二次请求带来的不一致。
 */

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "未登录" }, { status: 401 });
  }

  // 用户未配置自己的 Key：403 引导去设置页
  const ai = await getUserAiClient(session.user.id);
  if (!ai) {
    return Response.json(
      { error: "你还没有配置 DeepSeek Key，请到「设置」页填写后使用" },
      { status: 403 },
    );
  }

  const { chatId, content } = await req.json();
  if (!content || typeof content !== "string" || !content.trim()) {
    return Response.json({ error: "消息不能为空" }, { status: 400 });
  }
  const trimmed = content.trim().slice(0, 4000); // 单条消息长度上限

  const userId = session.user.id;

  // 1. 解析目标会话：传入则校验所有权；未传入则新建
  let chat;
  if (chatId) {
    chat = await prisma.chat.findFirst({
      where: { id: chatId, authorId: userId },
    });
    if (!chat) {
      return Response.json({ error: "会话不存在" }, { status: 404 });
    }
  } else {
    chat = await prisma.chat.create({
      data: {
        title: trimmed.slice(0, 20) || "新对话",
        authorId: userId,
      },
    });
  }

  // 2. 持久化用户消息 + 更新会话活跃时间
  //    两次独立写操作放进 $transaction：原子性 + 一次网络往返
  await prisma.$transaction([
    prisma.chatMessage.create({
      data: { chatId: chat.id, role: "user", content: trimmed },
    }),
    // 更新"最近活跃时间"（@updatedAt），让本会话在列表中置顶
    prisma.chat.update({
      where: { id: chat.id },
      data: { updatedAt: new Date() },
    }),
  ]);

  // 3. 两个只读查询独立，并行执行消除 waterfall：
  //    - 历史消息（最近 20 条，倒序取再反转回正序）
  //    - RAG 笔记（最近 8 篇标题+摘要，注入 system prompt）
  const [history, notes] = await Promise.all([
    prisma.chatMessage.findMany({
      where: { chatId: chat.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.note.findMany({
      where: { authorId: userId },
      orderBy: { updatedAt: "desc" },
      take: 8,
      select: { title: true, content: true },
    }),
  ]);
  history.reverse();
  const ragContext = notes
    .map((n) => `- ${n.title}：${n.content.slice(0, 200)}`)
    .join("\n");

  const system = `你是一个知识库 AI 助手（NoteMind），只基于用户自己的笔记回答问题。

用户最近笔记（标题：内容摘要）：
${ragContext || "（用户还没有笔记）"}

回答要求：
1. 优先引用上述笔记内容作答，可标注来源标题，如（来源：《xxx》）
2. 笔记不足以回答时，诚实说明，并给出通用建议
3. 使用简洁、自然的中文，结构化内容用 Markdown 列表`;

  // 5. 流式生成：逐片转发给前端，同时累计全文，结束时持久化助手消息
  let full = "";
  const generator = streamChatRaw({
    client: ai.client,
    model: ai.model,
    system,
    messages: history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    temperature: 0.7,
    maxTokens: 2048,
  });

  const withPersist = (async function* () {
    try {
      for await (const delta of generator) {
        full += delta;
        yield delta;
      }
    } finally {
      // 无论正常结束还是被中断，只要生成了内容就保存（避免丢失半截回复）
      if (full.trim()) {
        await prisma.chatMessage.create({
          data: { chatId: chat.id, role: "assistant", content: full },
        });
      }
    }
  })();

  // 6. 首帧注入 chatId 元数据
  return toSseResponse(withPersist, { chatId: chat.id });
}
