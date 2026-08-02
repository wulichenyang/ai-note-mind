import Link from "next/link";
import { Pin, NotebookPen, Search } from "lucide-react";

type NoteItem = {
  id: string;
  title: string;
  content: string;
  pinned: boolean;
  updatedAt: Date;
  tags: { name: string }[];
};

function formatDate(date: Date) {
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// 从 Markdown 提取纯文本做列表摘要
const plainText = (md: string) =>
  md.replace(/[#>*`\-_\[\]()!]/g, "").replace(/\s+/g, " ").slice(0, 80);

// 笔记卡片网格 + 空状态（Server Component）
export default function NotesGrid({ notes }: { notes: NoteItem[] }) {
  // 空状态：区分"无笔记"和"无搜索结果"
  if (notes.length === 0) {
    return (
      <div className="glass-card mt-12 flex flex-col items-center px-8 py-20 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-[#6366f1] to-[#a855f7] shadow-[0_8px_28px_rgba(139,92,246,0.4)]">
          <NotebookPen className="h-8 w-8 text-white" strokeWidth={1.8} />
        </span>
        <h2 className="mt-6 text-xl font-semibold tracking-tight text-zinc-900">
          还没有笔记
        </h2>
        <p className="mt-2 max-w-sm text-[14px] text-zinc-500">
          记录你的第一个想法吧。支持 Markdown、标签和全文搜索。
        </p>
        <Link href="/notes/new" className="btn-primary mt-8 px-6 py-2.5 text-[14px]">
          写第一篇笔记
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {notes.map((note) => (
          <Link
            key={note.id}
            href={`/notes/${note.id}`}
            className="glass-card group flex flex-col p-6 text-left transition-all duration-200 hover:-translate-y-1.5 hover:shadow-[0_20px_60px_rgba(0,0,0,0.12)]"
          >
            {/* 标题行 */}
            <div className="flex items-start justify-between gap-3">
              <h3 className="line-clamp-2 text-[16px] font-semibold leading-snug tracking-tight text-zinc-900">
                {note.title}
              </h3>
              {note.pinned && (
                <Pin className="h-4 w-4 shrink-0 fill-[#8b5cf6] text-[#8b5cf6]" strokeWidth={2} />
              )}
            </div>

            {/* 摘要 */}
            <p className="mt-2.5 line-clamp-2 flex-1 text-[13px] leading-relaxed text-zinc-500">
              {plainText(note.content) || "（空白笔记）"}
            </p>

            {/* 底部：标签 + 日期 */}
            <div className="mt-5 flex items-center justify-between">
              <div className="flex flex-wrap gap-1.5">
                {note.tags.slice(0, 2).map((tag) => (
                  <span
                    key={tag.name}
                    className="rounded-full bg-[#a855f7]/10 px-2 py-0.5 text-[11px] font-medium text-[#9333ea]"
                  >
                    {tag.name}
                  </span>
                ))}
                {note.tags.length > 2 && (
                  <span className="text-[11px] text-zinc-400">
                    +{note.tags.length - 2}
                  </span>
                )}
              </div>
              <span className="text-[12px] text-zinc-400">
                {formatDate(note.updatedAt)}
              </span>
            </div>
          </Link>
        ))}
      </div>

      {/* 搜索无结果提示 */}
      <div className="mt-10 flex items-center justify-center gap-2 text-[13px] text-zinc-400">
        <Search className="h-3.5 w-3.5" />
        {notes.length === 0 ? "没有匹配的笔记" : `共 ${notes.length} 篇`}
      </div>
    </>
  );
}
