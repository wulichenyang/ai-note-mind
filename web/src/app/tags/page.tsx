import Link from "next/link";
import { Tag } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export const metadata = { title: "标签 - NoteMind" };

// 标签列表页（Server Component）
// 用 groupBy 按标签聚合统计每篇笔记数量
// 这也是"标签云"的经典实现：点击标签跳转到 /notes?tag=xxx
export default async function TagsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  // 查询当前用户的全部标签，并统计每个标签关联的笔记数
  // 为什么不用 groupBy？Prisma 的 groupBy._count 只能统计标量字段，
  // 不能统计关系。要数"每个标签下有几篇笔记"，
  // 用 findMany + _count: { select: { notes: true } } 是标准做法
  const tags = await prisma.tag.findMany({
    where: { ownerId: user.userId },
    select: { name: true, _count: { select: { notes: true } } },
    orderBy: { notes: { _count: "desc" } },
  });

  // 标签总数与总笔记数
  const totalNotes = tags.reduce((sum, t) => sum + t._count.notes, 0);

  // 按数量决定标签字号（标签云效果）
  const maxCount = tags[0]?._count.notes ?? 1;

  return (
    <section className="relative mx-auto max-w-4xl px-6 py-14">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
            标签
          </h1>
          <p className="mt-1.5 text-[14px] text-zinc-500">
            {tags.length} 个标签 · 覆盖 {totalNotes} 篇笔记
          </p>
        </div>
      </div>

      {tags.length === 0 ? (
        <div className="glass-card mt-12 flex flex-col items-center px-8 py-20 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-[#6366f1] to-[#a855f7] shadow-[0_8px_28px_rgba(139,92,246,0.4)]">
            <Tag className="h-8 w-8 text-white" strokeWidth={1.8} />
          </span>
          <h2 className="mt-6 text-xl font-semibold tracking-tight text-zinc-900">
            还没有标签
          </h2>
          <p className="mt-2 max-w-sm text-[14px] text-zinc-500">
            打开任意笔记，在标题下方添加标签，用它们来整理你的知识库。
          </p>
        </div>
      ) : (
        <div className="glass-card mt-10 flex flex-wrap items-center gap-3 p-10">
          {tags.map((tag) => {
            // 字号按使用量缩放（0.85em ~ 1.4em），形成标签云
            const scale = 0.85 + (tag._count.notes / maxCount) * 0.55;
            return (
              <Link
                key={tag.name}
                href={`/notes?tag=${encodeURIComponent(tag.name)}`}
                className="group inline-flex items-center gap-2 rounded-full bg-[#8b5cf6]/10 px-4 py-1.5 text-[#9333ea] transition-all duration-150 hover:-translate-y-0.5 hover:bg-[#8b5cf6]/20"
                style={{ fontSize: `${scale}em` }}
              >
                {tag.name}
                <span className="rounded-full bg-white/70 px-1.5 py-0.5 text-[0.75em] font-medium text-zinc-500 group-hover:text-[#9333ea]">
                  {tag._count.notes}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
