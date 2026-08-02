import ChatShell from "@/components/chat-shell";

export const metadata = { title: "AI 对话 - NoteMind" };

// 历史会话页：从 URL 取会话 id（Next.js 15+ 异步 params）
export default async function ChatDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ChatShell activeChatId={id} />;
}
