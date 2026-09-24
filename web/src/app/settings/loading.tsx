import { SkeletonBar, SkeletonCard } from "@/components/skeleton";

/**
 * /settings 的加载骨架
 * 几何对齐 SettingsPage：max-w-2xl、返回链接、带图标的页头、表单卡片。
 */
export default function SettingsLoading() {
  return (
    <section
      className="relative mx-auto max-w-2xl px-6 py-14"
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">正在加载设置…</span>

      {/* 返回链接 */}
      <SkeletonBar className="h-4 w-20 rounded-md" />

      {/* 页头：图标方块 + 标题 + 说明 */}
      <div className="mt-6 flex items-center gap-3">
        <SkeletonBar className="h-10 w-10 shrink-0 rounded-xl" />
        <div>
          <SkeletonBar className="h-6 w-28 rounded-md" />
          <SkeletonBar className="mt-2 h-3 w-52 rounded-md" />
        </div>
      </div>

      {/* 表单卡片 */}
      <SkeletonCard className="mt-10 space-y-7 p-8">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i}>
            <SkeletonBar className="h-3.5 w-24 rounded-md" />
            <SkeletonBar className="mt-3 h-11 w-full rounded-xl" />
            <SkeletonBar className="mt-2.5 h-3 w-64 rounded-md" />
          </div>
        ))}
        <SkeletonBar className="h-11 w-32 rounded-full" />
      </SkeletonCard>
    </section>
  );
}
