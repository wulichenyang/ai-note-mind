import {
  SkeletonBar,
  SkeletonCard,
  SkeletonPageHeader,
} from "@/components/skeleton";

/**
 * /notes 的加载骨架
 * 几何对齐 NotesPage：max-w-5xl、页头 + 新建按钮、搜索行、3 列卡片网格。
 */
export default function NotesLoading() {
  return (
    <section
      className="relative mx-auto max-w-5xl px-6 py-14"
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">正在加载笔记…</span>

      {/* 页头：标题 + 统计文案，右侧「新建笔记」按钮 */}
      <div className="flex items-end justify-between">
        <SkeletonPageHeader subtitleWidth="w-44" />
        <SkeletonBar className="h-10 w-28 rounded-full" />
      </div>

      {/* 搜索框 + 标签筛选下拉 */}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SkeletonBar className="h-11 flex-1 rounded-xl" />
        <SkeletonBar className="h-11 w-36 rounded-xl" />
      </div>

      {/* 卡片网格：3 列 × 2 行 */}
      <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} className="flex flex-col p-6">
            {/* 标题（真实卡片是 2 行截断的 16px 标题） */}
            <SkeletonBar className="h-4 w-3/4 rounded-md" />
            {/* 正文摘要 */}
            <SkeletonBar className="mt-4 h-3 w-full rounded-md" />
            <SkeletonBar className="mt-2 h-3 w-5/6 rounded-md" />
            {/* 标签胶囊 */}
            <div className="mt-6 flex items-center gap-2">
              <SkeletonBar className="h-5 w-14 rounded-full" />
              <SkeletonBar className="h-5 w-12 rounded-full" />
            </div>
            {/* 底部日期 */}
            <div className="mt-5 flex items-center justify-between border-t border-black/[0.05] pt-3">
              <SkeletonBar className="h-3 w-20 rounded-md" />
              <SkeletonBar className="h-3 w-3 rounded-md" />
            </div>
          </SkeletonCard>
        ))}
      </div>
    </section>
  );
}
