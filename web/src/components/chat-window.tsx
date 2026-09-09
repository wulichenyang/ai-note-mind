"use client";

import { useState, useRef, useEffect, memo } from "react";
import { useRouter } from "next/navigation";
import { Send, Square, Sparkles, Loader2, MessageSquareText, Menu, ChevronDown, FileText, StickyNote } from "lucide-react";
import ChatSidebar, { type SidebarChat } from "@/components/chat-sidebar";
import ChatMarkdown from "@/components/chat-markdown";

// 聊天窗口（Client Component）
// -------------------------------------------------
// 职责：
// 1. 渲染消息气泡（user 右侧渐变 / assistant 左侧玻璃卡片）
// 2. 流式读取 /api/chat 的 SSE 响应，实时打字机渲染
// 3. 首帧 __meta.chatId：新会话时流结束后跳转到 /chat/{id}
// 4. 支持 AbortController 停止生成
// 5. 移动端：顶部工具栏提供"会话"抽屉入口
//
// 为什么是客户端？需要 fetch + ReadableStream 逐块渲染，
// 以及输入框的即时交互状态。

export type ChatSource = {
  type: "document" | "note";
  name: string;
  content: string;
};

export type ChatMessageDto = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
};

type ChatWindowProps = {
  chatId: string | null; // null 表示新会话（尚未入库）
  initialMessages: ChatMessageDto[];
  aiEnabled: boolean;
  chats: SidebarChat[];
};

const SUGGESTIONS = [
  "总结我最近的笔记",
  "帮我梳理笔记里的重点知识",
  "基于我的笔记，给一份学习计划建议",
];

let tempSeq = 0;
const tmpId = () => `tmp-${Date.now()}-${tempSeq++}`;

// 用户消息气泡：memo 化（rerender-memo）
// 流式更新时只有最后一条 assistant 消息在变，memo 让其余气泡跳过重渲染
const UserBubble = memo(function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[75%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-gradient-to-br from-[#6366f1] to-[#a855f7] px-4 py-2.5 text-[14px] leading-relaxed text-white shadow-[0_4px_20px_rgba(139,92,246,0.3)]">
        {content}
      </div>
    </div>
  );
});

// 引用来源块：可折叠，列出本次回答检索到的资料
const SourceRefs = memo(function SourceRefs({
  sources,
}: {
  sources: ChatSource[];
}) {
  const [open, setOpen] = useState(false);
  if (!sources.length) return null;
  return (
    <div className="mt-2 border-t border-[#8b5cf6]/10 pt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full px-1 text-[11px] font-medium text-[#7c3aed] transition-colors hover:bg-[#8b5cf6]/10"
      >
        <ChevronDown
          className={`h-3 w-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          strokeWidth={2.5}
        />
        参考了 {sources.length} 份知识库资料
      </button>
      {open && (
        <ul className="mt-1.5 space-y-1.5">
          {sources.map((s, i) => {
            const Icon = s.type === "document" ? FileText : StickyNote;
            return (
              <li
                key={`${s.type}-${s.name}-${i}`}
                className="flex gap-2 rounded-lg border border-black/5 bg-white/50 px-2 py-1.5"
              >
                <Icon
                  className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${s.type === "note" ? "text-[#a855f7]" : "text-[#6366f1]"}`}
                  strokeWidth={2.2}
                />
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-semibold text-zinc-700">
                    {s.type === "note" ? "笔记" : "文档"}《{s.name}》
                  </p>
                  <p className="line-clamp-2 text-[11px] leading-relaxed text-zinc-500">
                    {s.content}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
});

// 助手消息气泡：memo 化，Markdown 走懒加载组件
const AssistantBubble = memo(function AssistantBubble({
  content,
  streaming,
  sources,
}: {
  content: string;
  streaming: boolean;
  sources?: ChatSource[];
}) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[80%] rounded-2xl rounded-bl-md border border-white/70 bg-white/70 px-4 py-3 text-[14px] leading-relaxed text-zinc-700 shadow-[0_2px_12px_rgba(0,0,0,0.04)] backdrop-blur-xl">
        {content ? (
          <>
            <ChatMarkdown content={content} />
            {sources && <SourceRefs sources={sources} />}
          </>
        ) : streaming ? (
          <span className="flex items-center gap-2 text-zinc-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            正在思考…
          </span>
        ) : (
          <span className="text-zinc-400">（未生成内容）</span>
        )}
      </div>
    </div>
  );
});

export default function ChatWindow({
  chatId: initialChatId,
  initialMessages,
  aiEnabled,
  chats,
}: ChatWindowProps) {
  const router = useRouter();
  const [chatId, setChatId] = useState<string | null>(initialChatId);
  const [messages, setMessages] = useState<ChatMessageDto[]>(initialMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // 本地会话列表：发消息时实时把当前会话移到最前（无需刷新页面）
  const [localChats, setLocalChats] = useState<SidebarChat[]>(chats);

  // 当前会话标题（移动端工具栏显示）
  const activeChat = localChats.find((c) => c.id === chatId);
  const activeTitle = activeChat?.title ?? "新对话";

  // 切换会话（URL 变化导致 props 更新）时，重置为服务端数据
  useEffect(() => {
    setChatId(initialChatId);
    setMessages(initialMessages);
    setLoading(false);
    setError("");
    setSidebarOpen(false);
    abortRef.current?.abort();
    abortRef.current = null;
  }, [initialChatId, initialMessages]);

  // 服务端会话列表变化（新建会话跳转回来 / 其他用户操作）时同步
  useEffect(() => {
    setLocalChats(chats);
  }, [chats]);

  // 卸载时中止请求
  useEffect(() => () => abortRef.current?.abort(), []);

  // 新消息自动滚动到底部
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  const send = async (preset?: string) => {
    const text = (preset ?? input).trim();
    if (!text || loading) return;
    if (!aiEnabled) return;

    setInput("");
    setError("");
    setLoading(true);
    abortRef.current = new AbortController();

    // 乐观渲染：先显示用户消息 + 空助手占位
    setMessages((prev) => [
      ...prev,
      { id: tmpId(), role: "user", content: text },
      { id: tmpId(), role: "assistant", content: "" },
    ]);

    let resolvedChatId: string | null = null;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId, content: text }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `请求失败（${res.status}）`);
      }

      // 流式读取 SSE：data: {"choices":[{"delta":{"content":"..."}}]}
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? ""; // 保留可能未完成的行
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === "[DONE]") continue;

          let json: Record<string, unknown>;
          try {
            json = JSON.parse(payload);
          } catch {
            continue; // 忽略无法解析的行
          }

          if (json.__meta) {
            // 首帧元数据：新会话时记录服务端生成的 chatId
            resolvedChatId = (json.__meta as { chatId?: string }).chatId ?? null;
            // 实时排序：把当前会话移到侧栏最前（无需刷新页面）
            const activeId = resolvedChatId ?? chatId;
            if (activeId) {
              setLocalChats((prev) => {
                const target = prev.find((c) => c.id === activeId);
                if (!target) return prev;
                const others = prev.filter((c) => c.id !== activeId);
                return [target, ...others];
              });
            }
          } else if (json.__sources) {
            // 命中知识库：把引用来源挂到正在生成的助手消息上
            const sources = json.__sources as ChatSource[];
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last.role !== "assistant") return prev;
              next[next.length - 1] = { ...last, sources };
              return next;
            });
          } else if (json.error) {
            throw new Error(json.error as string);
          } else {
            const delta = (
              json.choices as
                | { delta?: { content?: string } }[]
                | undefined
            )?.[0]?.delta?.content;
            if (delta) {
              setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                next[next.length - 1] = {
                  ...last,
                  content: last.content + delta,
                };
                return next;
              });
            }
          }
        }
      }

      // 流正常结束：若是新会话（chatId 原为 null），跳转到会话页
      // （此时用户消息与助手回复都已持久化，服务端重新渲染历史）
      if (chatId === null && resolvedChatId) {
        router.replace(`/chat/${resolvedChatId}`, { scroll: false });
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      // 失败时移除空的助手占位，保留用户消息
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last.role === "assistant" && !last.content) return prev.slice(0, -1);
        return prev;
      });
      setError((err as Error).message || "AI 调用失败");
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  const stop = () => abortRef.current?.abort();

  return (
    <div className="flex min-w-0 flex-1">
      {/* 桌面侧栏（md 以上显示，随 localChats 实时排序） */}
      <ChatSidebar chats={localChats} activeId={chatId} variant="desktop" />

      <div className="flex min-w-0 flex-1 flex-col">
      {/* 移动端工具栏：会话抽屉入口 + 当前会话标题（md 以上隐藏） */}
      <div className="flex items-center gap-2 border-b border-black/[0.05] bg-white/40 px-3 py-2 backdrop-blur-2xl md:hidden">
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="flex h-8 items-center gap-1.5 rounded-full border border-black/[0.08] bg-white/70 px-3 text-[12px] font-medium text-zinc-700 active:scale-95"
        >
          <Menu className="h-3.5 w-3.5" strokeWidth={2.2} />
          会话
        </button>
        <span className="flex min-w-0 flex-1 items-center gap-1.5 text-[13px] font-medium text-zinc-800">
          <MessageSquareText className="h-3.5 w-3.5 shrink-0 text-[#8b5cf6]" strokeWidth={2.2} />
          <span className="truncate">{activeTitle}</span>
        </span>
      </div>

      {/* 消息区 */}
      <div className="flex-1 space-y-5 overflow-y-auto px-6 py-8">
        {messages.length === 0 ? (
          // 空状态：欢迎 + 建议问题
          <div className="flex h-full flex-col items-center justify-center text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#6366f1] via-[#8b5cf6] to-[#a855f7] shadow-[0_8px_30px_rgba(139,92,246,0.35)]">
              <Sparkles className="h-6 w-6 text-white" strokeWidth={2} />
            </span>
            <h2 className="mt-5 text-xl font-semibold tracking-tight text-zinc-900">
              和你的知识库对话
            </h2>
            <p className="mt-1.5 max-w-sm text-[13px] text-zinc-500">
              AI 会基于你最近的笔记回答，让知识真正流动起来
            </p>
            <div className="mt-6 flex flex-col items-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  disabled={!aiEnabled || loading}
                  className="rounded-full border border-[#8b5cf6]/25 bg-white/60 px-4 py-2 text-[13px] font-medium text-[#7c3aed] backdrop-blur transition-all duration-150 hover:bg-[#8b5cf6]/10 active:scale-95 disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) =>
            m.role === "user" ? (
              <UserBubble key={m.id} content={m.content} />
            ) : (
              <AssistantBubble
                key={m.id}
                content={m.content}
                streaming={loading}
                sources={m.sources}
              />
            ),
          )
        )}
        <div ref={bottomRef} />
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="px-6 pb-2">
          <p className="rounded-xl border border-red-500/20 bg-red-50/80 px-4 py-2.5 text-[12px] text-red-500">
            {error}
          </p>
        </div>
      )}

      {/* 输入区 */}
      <div className="border-t border-black/[0.05] bg-white/40 p-4 backdrop-blur-2xl">
        {!aiEnabled && (
          <p className="mb-2 text-center text-[12px] text-zinc-400">
            未配置 Key，{" "}
            <a
              href="/settings"
              className="font-medium text-[#8b5cf6] underline underline-offset-2"
            >
              去设置页填写
            </a>{" "}
            你的 DeepSeek Key 后使用 AI 对话
          </p>
        )}
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              // Enter 发送，Shift+Enter 换行
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder="输入消息，Enter 发送，Shift+Enter 换行…"
            className="max-h-40 flex-1 resize-none rounded-2xl border border-black/[0.08] bg-white/80 px-4 py-3 text-[14px] text-zinc-800 shadow-inner outline-none transition-all duration-150 placeholder:text-zinc-400 focus:border-[#8b5cf6]/40 focus:bg-white"
          />
          {loading ? (
            <button
              type="button"
              onClick={stop}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-red-500/20 bg-red-50 text-red-500 transition-all duration-150 hover:bg-red-100 active:scale-95"
              aria-label="停止生成"
            >
              <Square className="h-4 w-4 fill-current" strokeWidth={2.4} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => send()}
              disabled={!aiEnabled || !input.trim()}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#6366f1] to-[#a855f7] text-white shadow-[0_4px_16px_rgba(139,92,246,0.35)] transition-all duration-150 hover:shadow-[0_6px_22px_rgba(139,92,246,0.5)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="发送"
            >
              <Send className="h-4 w-4" strokeWidth={2.2} />
            </button>
          )}
        </div>
      </div>

      {/* 移动端会话抽屉 */}
      {sidebarOpen && (
        <ChatSidebar
          chats={localChats}
          activeId={chatId}
          variant="mobile"
          onNavigate={() => setSidebarOpen(false)}
        />
      )}
      </div>
    </div>
  );
}
