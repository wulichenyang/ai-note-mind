import {
  SkeletonBar,
  SkeletonCard,
  SkeletonPageHeader,
} from "@/components/skeleton";

/**
 * /library 的加载骨架
 * 几何对齐 LibraryPage：max-w-4xl、页头、上传区、文件列表。
 */
export default function LibraryLoading() {
  return (
    <section
      className="relative mx-auto max-w-4xl px-6 py-14"
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">正在加载知识库…</span>

      <div className="flex items-end justify-between">
        <SkeletonPageHeader subtitleWidth="w-72" />
      </div>

      <div className="mt-8 space-y-6">
        {/* 上传区卡片 */}
        <SkeletonCard className="p-6 text-center">
          <div className="flex flex-col items-center">
            <SkeletonBar className="h-12 w-12 rounded-2xl" />
            <SkeletonBar className="mt-4 h-4 w-40 rounded-md" />
            <SkeletonBar className="mt-2.5 h-3 w-64 rounded-md" />
          </div>
        </SkeletonCard>

        {/* 文件列表 */}
        <ul className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i}>
              <SkeletonCard className="flex items-center gap-4 p-6">
                <SkeletonBar className="h-10 w-10 shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1">
                  <SkeletonBar className="h-4 w-1/3 rounded-md" />
                  <div className="mt-2.5 flex items-center gap-2">
                    <SkeletonBar className="h-3 w-16 rounded-md" />
                    <SkeletonBar className="h-3 w-20 rounded-md" />
                  </div>
                </div>
                <SkeletonBar className="h-6 w-16 shrink-0 rounded-full" />
              </SkeletonCard>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
