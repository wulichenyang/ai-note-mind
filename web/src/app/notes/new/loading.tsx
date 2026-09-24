import { SkeletonBar, SkeletonCard } from "@/components/skeleton";

/**
 * /notes/new 的加载骨架（点「新建笔记」时）
 * 几何对齐新建页：max-w-3xl、text-3xl 标题、glass-card 里是标题输入框 + 大文本域。
 * 同 /notes/[id]：不单独覆盖的话会先闪卡片网格骨架。
 */
export default function NewNoteLoading() {
  return (
    <section
      className="relative mx-auto max-w-3xl px-6 py-14"
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">正在加载编辑器…</span>

      <SkeletonBar className="h-9 w-32 rounded-lg" />

      <SkeletonCard className="mt-8 p-7">
        {/* 标题输入框（text-lg） */}
        <SkeletonBar className="h-12 w-full rounded-xl" />
        {/* 正文文本域（min-h-320px，与 NoteEditor 一致） */}
        <SkeletonBar className="mt-5 h-[320px] w-full rounded-xl" />
        {/* 创建按钮 + 返回 */}
        <div className="mt-5 flex items-center gap-3">
          <SkeletonBar className="h-11 w-32 rounded-full" />
          <SkeletonBar className="h-11 w-24 rounded-full" />
        </div>
      </SkeletonCard>
    </section>
  );
}
