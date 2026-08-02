import ChatShell from "@/components/chat-shell";

export const metadata = { title: "新对话 - NoteMind" };

// 新建对话页：始终进入空白新会话，不被重定向到历史会话
// 发第一条消息后，服务端生成会话并跳转到 /chat/{id}
export default function NewChatPage() {
  return <ChatShell activeChatId={null} newConversation />;
}
