import { SkeletonBar, SkeletonCard, SkeletonPageHeader } from "@/components/skeleton";

/**
 * /tags 的加载骨架
 * 几何对齐 TagsPage：max-w-4xl、页头、单个大玻璃卡片里铺满标签胶囊。
 * 胶囊宽度刻意做成参差不齐，贴近标签云的真实观感。
 */
const PILL_WIDTHS = ["w-16", "w-24", "w-20", "w-14", "w-28", "w-20", "w-16", "w-24", "w-18", "w-20"];

export default function TagsLoading() {
  return (
    <section
      className="relative mx-auto max-w-4xl px-6 py-14"
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">正在加载标签…</span>

      <div className="flex items-end justify-between">
        <SkeletonPageHeader subtitleWidth="w-56" />
      </div>

      <SkeletonCard className="mt-10 flex flex-wrap items-center gap-3 p-10">
        {PILL_WIDTHS.map((w, i) => (
          <SkeletonBar
            key={i}
            className={`h-9 rounded-full ${w}`}
            // 标签云里的字号有大小之分，用高度微差模拟
          />
        ))}
      </SkeletonCard>
    </section>
  );
}
