import Link from "next/link";
import { Plus, X } from "lucide-react";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import NotesGrid from "@/components/notes-grid";
import NotesSearch from "@/components/notes-search";
import TagsFilter from "@/components/tags-filter";

export const metadata = { title: "我的笔记 - NoteMind" };

// 笔记列表页（Server Component）
// 支持 URL 查询参数：?q=关键词&tag=标签名 组合筛选
// 通过 searchParams 实现"搜索状态可分享、可刷新保持"
export default async function NotesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tag?: string }>;
}) {
  const { q, tag } = await searchParams;
  const user = await getCurrentUser();
  if (!user) return null;

  const keyword = q?.trim() ?? "";
  const tagName = tag?.trim() ?? "";

  // 构建组合查询条件（多租户隔离始终在 where 第一层）
  // 搜索条件：标题 OR 内容 模糊匹配（ILIKE，PG 大小写不敏感）
  // 标签条件：tag 关联表中存在该标签
  const where: Prisma.NoteWhereInput = {
    authorId: user.userId,
    ...(keyword && {
      OR: [
        { title: { contains: keyword, mode: "insensitive" } },
        { content: { contains: keyword, mode: "insensitive" } },
      ],
    }),
    ...(tagName && {
      tags: { some: { name: tagName } },
    }),
  };

  const [notes, allTags] = await Promise.all([
    prisma.note.findMany({
      where,
      orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        title: true,
        content: true,
        pinned: true,
        updatedAt: true,
        tags: { select: { name: true }, orderBy: { name: "asc" } },
      },
    }),
    // 用户的全部标签，用于筛选项（只查自己，数据隔离）
    prisma.tag.findMany({
      where: { ownerId: user.userId },
      select: { name: true, _count: { select: { notes: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <section className="relative mx-auto max-w-5xl px-6 py-14">
      {/* 页头 */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
            我的笔记
          </h1>
          <p className="mt-1.5 text-[14px] text-zinc-500">
            {keyword || tagName
              ? `找到 ${notes.length} 篇匹配的笔记`
              : `共 ${notes.length} 篇 · 置顶优先排序`}
          </p>
        </div>
        <Link href="/notes/new" className="btn-primary flex items-center gap-1.5 px-5 py-2.5 text-[14px]">
          <Plus className="h-4 w-4" strokeWidth={2.4} />
          新建笔记
        </Link>
      </div>

      {/* 搜索栏 */}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* 搜索框（客户端组件：防抖实时搜索） */}
        <NotesSearch keyword={keyword} />

        {/* 标签筛选（客户端组件，选中即跳转） */}
        <TagsFilter allTags={allTags} currentTag={tagName} />
      </div>

      {/* 当前筛选状态 */}
      {tagName && (
        <div className="mt-4 flex items-center gap-2">
          <span className="text-[13px] text-zinc-500">筛选标签：</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-[#8b5cf6]/10 px-3 py-1 text-[12.5px] font-medium text-[#9333ea]">
            {tagName}
            <a href="/notes" className="transition-opacity hover:opacity-60">
              <X className="h-3.5 w-3.5" strokeWidth={2.4} />
            </a>
          </span>
        </div>
      )}

      {/* 列表/空状态 */}
      <NotesGrid notes={notes} />
    </section>
  );
}
