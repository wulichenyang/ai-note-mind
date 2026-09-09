import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { getUserAiSecret, toSseResponse } from "@/lib/ai";
import { openChatSse } from "@/lib/agent";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * AI 对话路由（agent BFF 代理 + 会话持久化）
 * POST /api/chat  { chatId?: string, content: string }
 * -------------------------------------------------
 * 链路：
 * 1. 校验登录 + 会话所有权（多租户隔离）；无 chatId 自动新建会话
 * 2. 用用户自己的 DeepSeek Key（BYOK），未配置返回 403
 * 3. 持久化用户消息，读取历史消息（最近 20 条）
 * 4. 转发给 agent /api/chat：由 agent 先做「是否读知识库」的意图路由，
 *    命中则检索（文档 chunks + 笔记 note_chunks）后带引用生成，否则普通生成
 * 5. 把 agent 内部 SSE 帧转换为 OpenAI 标准流给前端；
 *    其中 sources 帧内联成 __sources 事件供前端渲染引用来源
 * 6. 生成结束时把完整回复 + 引用来源回存为 assistant 消息
 */

type AgentFrame = {
  mode?: "knowledge" | "chat";
  sources?: { type: "document" | "note"; name: string; content: string }[];
  token?: string;
  error?: string;
  done?: boolean;
};

function sseDataParser(): (frame: string) => AgentFrame {
  return (frame) => {
    if (!frame.startsWith("data: ")) return {};
    try {
      return JSON.parse(frame.slice(6)) as AgentFrame;
    } catch {
      return {};
    }
  };
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "未登录" }, { status: 401 });
  }

  // 用户未配置自己的 Key：403 引导去设置页
  const secret = await getUserAiSecret(session.user.id);
  if (!secret) {
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
  await prisma.$transaction([
    prisma.chatMessage.create({
      data: { chatId: chat.id, role: "user", content: trimmed },
    }),
    prisma.chat.update({
      where: { id: chat.id },
      data: { updatedAt: new Date() },
    }),
  ]);

  // 3. 读取历史消息（最近 20 条，倒序取再反转回正序），交给 agent 理解追问
  const history = await prisma.chatMessage.findMany({
    where: { chatId: chat.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  history.reverse();

  // 4. 建到 agent /api/chat 的 SSE：agent 内部做意图路由 + 检索 + 生成
  //    边收边转 OpenAI 标准格式；sources 帧内联透传给前端展示引用来源
  const generator = (async function* () {
    let full = "";
    let sources: AgentFrame["sources"] = [];
    try {
      let resp: Response;
      try {
        resp = await openChatSse({
          user_id: userId,
          question: trimmed,
          history: history.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
          llm: {
            api_key: secret.apiKey,
            model: secret.model,
            base_url: secret.baseUrl,
          },
        });
      } catch (err) {
        throw new Error(`AI 服务不可用：${(err as Error).message}`);
      }
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(
          (body as { detail?: string }).detail ?? `AI 服务返回 ${resp.status}`,
        );
      }
      if (!resp.body) throw new Error("AI 服务无响应");

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
            if (evt.sources?.length) {
              sources = evt.sources;
              yield { __sources: evt.sources };
            }
            if (evt.token) {
              full += evt.token;
              yield evt.token;
            }
            if (evt.done) return;
          }
        }
      } finally {
        reader.releaseLock();
      }
    } finally {
      // 无论正常结束还是被中断，只要生成了内容就保存（避免丢失半截回复），
      // 同时把本次命中的引用来源回存到 assistant 消息上
      if (full.trim()) {
        await prisma.chatMessage.create({
          data: {
            chatId: chat.id,
            role: "assistant",
            content: full,
            ...(sources.length ? { sources } : {}),
          },
        });
      }
    }
  })();

  // 5. 首帧注入 chatId 元数据，前端据此更新 URL / 侧栏
  return toSseResponse(generator, { chatId: chat.id });
}
