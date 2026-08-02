import ChatShell from "@/components/chat-shell";

export const metadata = { title: "AI 对话 - NoteMind" };

// 新对话页：activeChatId 为空
// 若已有会话，ChatShell 会自动重定向到最新会话
export default function ChatPage() {
  return <ChatShell activeChatId={null} />;
}
