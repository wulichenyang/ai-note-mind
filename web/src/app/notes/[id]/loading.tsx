import { SkeletonBar, SkeletonCard } from "@/components/skeleton";

/**
 * /notes/[id] 的加载骨架（点开某篇笔记时）
 * 几何对齐笔记详情页：max-w-3xl、返回+操作栏、大标题正文、AI 卡片。
 * 为什么要单独写：app/notes/loading.tsx 会自动包裹子路由，
 * 若不覆盖，点开笔记时会先闪一下「卡片网格」骨架再变成详情页，视觉跳变很明显。
 */
export default function NoteDetailLoading() {
  return (
    <section
      className="relative mx-auto max-w-3xl px-6 py-14"
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">正在加载笔记…</span>

      {/* 返回列表 + 置顶/编辑/删除 */}
      <div className="flex items-center justify-between">
        <SkeletonBar className="h-4 w-20 rounded-md" />
        <div className="flex items-center gap-2">
          <SkeletonBar className="h-8 w-8 rounded-lg" />
          <SkeletonBar className="h-8 w-16 rounded-lg" />
          <SkeletonBar className="h-8 w-16 rounded-lg" />
        </div>
      </div>

      <article className="mt-8">
        {/* 标题（text-3xl，可能两行） */}
        <SkeletonBar className="h-9 w-2/3 rounded-lg" />

        {/* 更新日期 + 标签 */}
        <div className="mt-4 flex items-center gap-3">
          <SkeletonBar className="h-4 w-32 rounded-md" />
          <SkeletonBar className="h-5 w-14 rounded-full" />
        </div>

        {/* 正文段落 */}
        <div className="mt-8 space-y-3">
          <SkeletonBar className="h-4 w-full rounded-md" />
          <SkeletonBar className="h-4 w-11/12 rounded-md" />
          <SkeletonBar className="h-4 w-full rounded-md" />
          <SkeletonBar className="h-4 w-4/5 rounded-md" />
          <SkeletonBar className="mt-6 h-4 w-full rounded-md" />
          <SkeletonBar className="h-4 w-3/4 rounded-md" />
        </div>

        {/* AI 摘要 / 续写卡片 */}
        <SkeletonCard className="mt-8 p-8">
          <div className="flex items-center gap-2">
            <SkeletonBar className="h-4 w-4 rounded" />
            <SkeletonBar className="h-4 w-20 rounded-md" />
          </div>
          <div className="mt-5 space-y-2.5">
            <SkeletonBar className="h-3.5 w-full rounded-md" />
            <SkeletonBar className="h-3.5 w-5/6 rounded-md" />
          </div>
        </SkeletonCard>
      </article>
    </section>
  );
}
