import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pin } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import NoteDetailActions from "@/components/note-detail-actions";
import MarkdownContent from "@/components/markdown-content";
import TagInput from "@/components/tag-input";
import NoteAI from "@/components/note-ai";

export const metadata = { title: "笔记详情 - NoteMind" };

function formatDate(date: Date) {
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// 笔记详情页（动态路由）
// params 是 Promise（Next.js 15+ 异步参数约定）
export default async function NoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return null;

  // findFirst + authorId：非本人笔记直接 404（数据隔离）
  const note = await prisma.note.findFirst({
    where: { id, authorId: user.userId },
    include: { tags: { select: { name: true } } },
  });
  if (!note) notFound();

  // 该用户是否已配置自己的 DeepSeek Key（BYOK，决定 AI 功能是否可用）
  const dbUser = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { aiApiKeyEncrypted: true },
  });
  const hasAiKey = Boolean(dbUser?.aiApiKeyEncrypted);

  return (
    <section className="relative mx-auto max-w-3xl px-6 py-14">
      {/* 返回 + 操作栏 */}
      <div className="flex items-center justify-between">
        <Link
          href="/notes"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-zinc-500 transition-colors hover:text-zinc-900"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.2} />
          返回列表
        </Link>
        <NoteDetailActions noteId={note.id} pinned={note.pinned} />
      </div>

      {/* 笔记主体 */}
      <article className="mt-8">
        <header className="flex items-start gap-3">
          <h1 className="flex-1 text-3xl font-semibold leading-tight tracking-tight text-zinc-900">
            {note.title}
          </h1>
          {note.pinned && (
            <Pin className="mt-1.5 h-5 w-5 shrink-0 fill-[#8b5cf6] text-[#8b5cf6]" strokeWidth={2} />
          )}
        </header>

        <div className="mt-3 flex items-center gap-3">
          <span className="text-[13px] text-zinc-400">
            更新于 {formatDate(note.updatedAt)}
          </span>
        </div>

        {/* 标签管理（回车添加 + 联想 + 移除） */}
        <div className="mt-4">
          <TagInput
            noteId={note.id}
            initialTags={note.tags.map((t) => t.name)}
          />
        </div>

        {/* AI 摘要/续写 */}
        <NoteAI
          noteId={note.id}
          title={note.title}
          content={note.content}
          enabled={hasAiKey}
        />

        {/* Markdown 内容 */}
        <div className="glass-card mt-8 p-8">
          <MarkdownContent content={note.content} />
        </div>
      </article>
    </section>
  );
}
