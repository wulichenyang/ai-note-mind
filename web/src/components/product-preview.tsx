import {
  NotebookPen,
  Search,
  MessageSquareText,
  Pin,
  Send,
  Sparkles,
} from "lucide-react";

// 产品预览 mock：浅色 iOS 应用界面（左侧笔记列表 + 右侧 AI 对话）
// 毛玻璃质感 + 细腻阴影，模拟真实产品截图
const notes = [
  {
    title: "Next.js 学习笔记",
    preview: "App Router、Server Actions 与数据获取……",
    tag: "技术",
    color: "#6366f1",
  },
  {
    title: "面试要点梳理",
    preview: "React 渲染机制、闭包、性能优化……",
    tag: "求职",
    color: "#a855f7",
  },
  {
    title: "产品灵感收集",
    preview: "关于 AI 知识库的 3 个产品想法……",
    tag: "灵感",
    color: "#e879f9",
  },
];

const messages = [
  { role: "user", text: "帮我总结一下 Next.js 学习笔记的要点", mine: true },
  {
    role: "ai",
    text: "根据你的笔记，核心要点有：1）App Router 基于文件路由…",
    mine: false,
  },
];

export default function ProductPreview() {
  return (
    <div className="animate-float mx-auto max-w-3xl">
      {/* 产品外壳：白色毛玻璃 + 细腻分层阴影 */}
      <div className="glass-panel overflow-hidden text-left">
        {/* 窗口顶栏 */}
        <div className="flex items-center gap-1.5 border-b border-black/[0.04] px-5 py-3.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          <span className="ml-3 flex-1 rounded-lg bg-black/[0.04] px-3 py-1 text-center text-[11px] text-zinc-400">
            notemind.app
          </span>
        </div>

        {/* 应用主体：左列表 + 右对话 */}
        <div className="grid grid-cols-1 sm:grid-cols-2">
          {/* 左侧：笔记列表 */}
          <div className="border-b border-black/[0.04] p-5 sm:border-b-0 sm:border-r">
            <div className="flex items-center gap-2 rounded-xl bg-black/[0.04] px-3.5 py-2.5">
              <Search className="h-3.5 w-3.5 text-zinc-400" />
              <span className="text-[12px] text-zinc-400">搜索笔记…</span>
            </div>
            <div className="mt-3.5 space-y-2.5">
              {notes.map((note) => (
                <div
                  key={note.title}
                  className="rounded-2xl border border-white/80 bg-white/80 p-3.5 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-center gap-1.5">
                    <NotebookPen
                      className="h-3 w-3"
                      strokeWidth={2.2}
                      style={{ color: note.color }}
                    />
                    <span className="text-[13px] font-medium text-zinc-800">
                      {note.title}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-[11.5px] text-zinc-400">
                    {note.preview}
                  </p>
                  <span
                    className="mt-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-medium"
                    style={{ color: note.color, background: `${note.color}14` }}
                  >
                    {note.tag}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 右侧：AI 对话 */}
          <div className="flex flex-col bg-gradient-to-b from-black/[0.015] to-transparent p-5">
            <div className="flex items-center gap-1.5 pb-2.5 text-[12px] font-medium text-zinc-700">
              <MessageSquareText className="h-3.5 w-3.5 text-[#8b5cf6]" strokeWidth={2.2} />
              AI 助手
              <span className="ml-auto flex items-center gap-1 rounded-full bg-[#a855f7]/10 px-2 py-0.5 text-[10px] font-medium text-[#9333ea]">
                <Sparkles className="h-2.5 w-2.5" />
                DeepSeek
              </span>
            </div>
            <div className="flex-1 space-y-2.5">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.mine ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-[12px] leading-relaxed ${
                      msg.mine
                        ? "rounded-br-md bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] text-white shadow-[0_4px_14px_rgba(139,92,246,0.35)]"
                        : "rounded-bl-md border border-white/80 bg-white/80 text-zinc-700 shadow-sm"
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3.5 flex items-center gap-2 rounded-xl border border-white/80 bg-white/80 px-3.5 py-2.5 shadow-sm">
              <span className="flex-1 text-[12px] text-zinc-400">
                问点关于你笔记的问题…
              </span>
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-[#6366f1] to-[#8b5cf6]">
                <Send className="h-3 w-3 text-white" strokeWidth={2.4} />
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 浮动徽章 */}
      <div className="pointer-events-none absolute -right-4 top-10 hidden rounded-2xl border border-white/70 bg-white/70 px-4 py-3 text-left shadow-2xl backdrop-blur-xl sm:block">
        <div className="flex items-center gap-1.5 text-[12px] font-semibold text-zinc-800">
          <Pin className="h-3 w-3 text-[#8b5cf6]" strokeWidth={2.4} />
          智能摘要
        </div>
        <p className="mt-0.5 text-[11px] text-zinc-500">一键总结任意笔记</p>
      </div>
    </div>
  );
}
