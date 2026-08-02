import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import type { SidebarChat } from "@/components/chat-sidebar";
import ChatWindow, { type ChatMessageDto } from "@/components/chat-window";

// 会话页骨架（Server Component）
// -------------------------------------------------
// 同时服务 /chat、/chat/new（新对话）与 /chat/[id]（历史对话）三个路由：
// - 查询当前用户的全部会话（多租户隔离）
// - 访问 /chat（无 id）且已有会话时，重定向到最新会话
// - newConversation=true（/chat/new）时跳过重定向，直接进入空白新会话
// - 校验目标会话所有权，非本人会话重定向回 /chat
// - 把会话列表 + 初始消息以序列化 props 传给客户端窗口

export default async function ChatShell({
  activeChatId,
  newConversation = false,
}: {
  activeChatId: string | null;
  newConversation?: boolean;
}) {
  const user = await getCurrentUser();
  if (!user) return null; // proxy 已守卫登录，这里兜底

  const chats: SidebarChat[] = await prisma.chat.findMany({
    where: { authorId: user.userId },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { messages: true } },
    },
  });

  // 访问 /chat（无 id）且已有会话：跳到最新的一个
  // （/chat/new 除外：用户明确要开新会话，不重定向）
  if (!activeChatId && !newConversation && chats.length > 0) {
    redirect(`/chat/${chats[0].id}`);
  }

  let messages: ChatMessageDto[] = [];
  if (activeChatId) {
    const chat = await prisma.chat.findFirst({
      where: { id: activeChatId, authorId: user.userId },
    });
    if (!chat) redirect("/chat"); // 非本人/不存在：回到新对话

    messages = (
      await prisma.chatMessage.findMany({
        where: { chatId: activeChatId },
        orderBy: { createdAt: "asc" },
        select: { id: true, role: true, content: true },
      })
    ).map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant",
      content: m.content,
    }));
  }

  // 该用户是否已配置自己的 DeepSeek Key（BYOK，决定 AI 对话是否可用）
  const dbUser = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { aiApiKeyEncrypted: true },
  });
  const aiEnabled = Boolean(dbUser?.aiApiKeyEncrypted);

  return (
    <div className="flex h-[calc(100dvh-3rem)] pt-12">
      <ChatWindow
        chatId={activeChatId}
        initialMessages={messages}
        aiEnabled={aiEnabled}
        chats={chats}
      />
    </div>
  );
}
