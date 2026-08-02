import "server-only";
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";

/**
 * DeepSeek 客户端（只在服务端使用）
 * -------------------------------------------------
 * 为什么 DeepSeek 只需改 baseURL 就能用？
 * DeepSeek 的 API 完全兼容 OpenAI 协议（OpenAI-compatible），
 * 请求/响应格式一致，所以直接用官方 openai SDK，
 * 把 baseURL 指向 api.deepseek.com 即可。
 *
 * 为什么 import "server-only"？
 * 这是 Next.js 的编译期保护：如果任何客户端代码 import 了这个模块，
 * 会直接编译报错。API key 绝不能进入浏览器 bundle。
 *
 * BYOK 安全模型（公网部署）：
 * - 不配置任何全局 DeepSeek Key，杜绝"共享额度被刷爆"
 * - 每个用户在 /settings 填写自己的 Key，AES-256-GCM 加密存库
 * - 调用时由 getUserAiClient 解密出用户自己的 Key 构造独立客户端
 * - 用户之间完全隔离，各花各的额度
 */

const baseURL = process.env.AI_BASE_URL ?? "https://api.deepseek.com";
// 用户未在设置页选择模型时的默认值（环境变量可覆盖）
export const DEFAULT_MODEL = process.env.AI_MODEL ?? "deepseek-chat";

export type AiClient = {
  client: OpenAI;
  model: string;
};

/**
 * 获取某用户自己的 AI 客户端
 * -------------------------------------------------
 * 从数据库读取该用户加密存储的 Key → 解密 → 构造专属 OpenAI 客户端。
 * 未配置 Key 的用户返回 null，调用方返回 403 提示去设置页配置。
 */
export async function getUserAiClient(userId: string): Promise<AiClient | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { aiApiKeyEncrypted: true, aiModel: true },
  });
  if (!user?.aiApiKeyEncrypted) return null;

  const apiKey = decrypt(user.aiApiKeyEncrypted);
  return {
    client: new OpenAI({ apiKey, baseURL }),
    model: user.aiModel?.trim() || DEFAULT_MODEL,
  };
}

/**
 * 原生 OpenAI 协议流式对话（DeepSeek）
 * -------------------------------------------------
 * 为什么不用 AI SDK 的 streamText().toTextStreamResponse()？
 * toTextStreamResponse 输出的是"纯文本拼接流"，而前端解析的是
 * OpenAI 标准 SSE 格式（data: {"choices":[{"delta":{"content":"..."}}]}）。
 * DeepSeek 完全兼容 OpenAI 协议，直接用 openai SDK 的
 * chat.completions.create({ stream: true }) 拿到原生分片，
 * 逐片 yield 文本增量，前后端格式严格一致，也方便在生成过程中
 * 持久化完整回复。
 */
export async function* streamChatRaw(params: {
  client: OpenAI;
  model: string;
  system?: string;
  messages: { role: "user" | "assistant"; content: string }[];
  temperature?: number;
  maxTokens?: number;
}): AsyncGenerator<string> {
  const { client, model } = params;

  const stream = await client.chat.completions.create({
    model,
    messages: [
      ...(params.system ? [{ role: "system" as const, content: params.system }] : []),
      ...params.messages,
    ],
    temperature: params.temperature ?? 0.7,
    max_tokens: params.maxTokens ?? 2048,
    stream: true,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta?.content;
    if (delta) yield delta;
  }
}

/**
 * 把文本增量流包装成 OpenAI 标准 SSE Response
 * meta 可选：在首帧注入自定义元数据（如 chatId），
 * 前端解析 data: {"__meta":{...}} 用于更新 URL / 侧栏。
 */
export function toSseResponse(
  stream: AsyncIterable<string>,
  meta?: Record<string, unknown>,
) {
  const encoder = new TextEncoder();
  const sse = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (meta) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ __meta: meta })}\n\n`),
          );
        }
        for await (const delta of stream) {
          const payload = JSON.stringify({
            choices: [{ delta: { content: delta } }],
          });
          controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ error: (err as Error).message })}\n\n`,
          ),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(sse, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
