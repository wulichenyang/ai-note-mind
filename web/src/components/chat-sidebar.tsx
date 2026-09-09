"use client";

import Link from "next/link";
import { Plus, MessageSquareText, X } from "lucide-react";

// 会话侧栏（Client Component）
// -------------------------------------------------
// 数据以 props 传入（由服务端 ChatShell 查询，多租户隔离）。
// 两种形态：
// - desktop：桌面固定左侧栏（md 及以上显示）
// - mobile：移动端抽屉覆盖层（由聊天窗口顶部的"会话"按钮控制）
// 为什么是 client？移动抽屉需要交互状态和点击关闭回调。

export type SidebarChat = {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  _count: { messages: number };
};

type ChatSidebarProps = {
  chats: SidebarChat[];
  activeId: string | null;
  variant?: "desktop" | "mobile";
  onNavigate?: () => void;
};

const inner = ({ chats, activeId, onNavigate }: ChatSidebarProps) => (
  <>
    {/* 新建对话：进入空白新会话（不被重定向到历史会话） */}
    <Link
      href="/chat/new"
      onClick={onNavigate}
      className="btn-primary flex items-center justify-center gap-1.5 px-4 py-2.5 text-[13px]"
    >
      <Plus className="h-4 w-4" strokeWidth={2.4} />
      新建对话
    </Link>

    {/* 会话列表 */}
    <div className="mt-4 flex-1 space-y-1 overflow-y-auto pr-1">
      {chats.length === 0 && (
        <p className="px-3 py-8 text-center text-[12px] text-zinc-400">
          还没有对话
          <br />
          点击上方"新建对话"开始
        </p>
      )}
      {chats.map((chat) => {
        const active = chat.id === activeId;
        return (
          <Link
            key={chat.id}
            href={`/chat/${chat.id}`}
            onClick={onNavigate}
            className={`group flex items-center gap-2.5 rounded-xl px-3 py-2.5 transition-all duration-150 ${
              active
                ? "bg-gradient-to-br from-[#6366f1]/12 to-[#a855f7]/12 shadow-[inset_0_0_0_1px_rgba(139,92,246,0.25)]"
                : "hover:bg-white/70"
            }`}
          >
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors ${
                active
                  ? "bg-gradient-to-br from-[#6366f1] to-[#a855f7] text-white"
                  : "bg-zinc-100 text-zinc-500 group-hover:bg-white"
              }`}
            >
              <MessageSquareText className="h-3.5 w-3.5" strokeWidth={2.2} />
            </span>
            <div className="min-w-0 flex-1">
              <p
                className={`truncate text-[13px] font-medium ${
                  active ? "text-zinc-900" : "text-zinc-700"
                }`}
              >
                {chat.title}
              </p>
              <p className="text-[11px] text-zinc-400">
                {chat._count.messages} 条消息
              </p>
            </div>
          </Link>
        );
      })}
    </div>
  </>
);

export default function ChatSidebar({
  variant = "desktop",
  ...rest
}: ChatSidebarProps) {
  // 桌面形态：固定左侧栏
  if (variant === "desktop") {
    return (
      <aside className="hidden w-72 shrink-0 flex-col border-r border-black/[0.05] bg-white/40 p-4 backdrop-blur-2xl md:flex">
        {inner(rest)}
      </aside>
    );
  }

  // 移动形态：全屏抽屉覆盖层（遮罩点击关闭）
  return (
    <div className="fixed inset-0 z-40 md:hidden">
      {/* 遮罩 */}
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
        onClick={rest.onNavigate}
      />
      {/* 抽屉面板 */}
      <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[80%] flex-col border-r border-white/70 bg-[#f5f5f7]/95 p-4 shadow-2xl backdrop-blur-2xl">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[13px] font-semibold text-zinc-900">
            会话列表
          </span>
          <button
            type="button"
            onClick={rest.onNavigate}
            className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-black/5"
            aria-label="关闭"
          >
            <X className="h-4 w-4" strokeWidth={2.2} />
          </button>
        </div>
        {inner(rest)}
      </aside>
    </div>
  );
}
