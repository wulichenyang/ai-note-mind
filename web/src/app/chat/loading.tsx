import { SkeletonBar } from "@/components/skeleton";

/**
 * /chat 的加载骨架
 * 几何对齐 ChatShell + ChatSidebar + ChatWindow：
 * 外层 flex h-[calc(100dvh-3rem)] pt-12，左侧固定 w-72 侧栏（md 以上才显示），右侧消息流。
 * 侧栏宽度和断点必须与真实组件一致，否则骨架换成真内容时会横向跳一下。
 */
export default function ChatLoading() {
  return (
    <div
      className="flex h-[calc(100dvh-3rem)] pt-12"
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">正在加载对话…</span>

      {/* 左侧会话列表（与 ChatSidebar 同宽同底色） */}
      <aside className="hidden w-72 shrink-0 flex-col border-r border-black/[0.05] bg-white/40 p-4 backdrop-blur-2xl md:flex">
        <SkeletonBar className="h-10 w-full rounded-xl" />
        <div className="mt-4 flex-1 space-y-1 overflow-hidden pr-1">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 rounded-xl px-3 py-2.5">
              <SkeletonBar className="h-3.5 w-3.5 shrink-0 rounded" />
              <SkeletonBar
                className={`h-3.5 rounded-md ${i % 3 === 0 ? "w-32" : i % 3 === 1 ? "w-40" : "w-24"}`}
              />
            </div>
          ))}
        </div>
      </aside>

      {/* 右侧对话区 */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* 顶部标题栏 */}
        <div className="flex items-center justify-between border-b border-black/[0.05] px-6 py-3.5">
          <SkeletonBar className="h-4 w-36 rounded-md" />
          <SkeletonBar className="h-4 w-4 rounded" />
        </div>

        {/* 消息流：用户气泡靠右、助手气泡靠左，与 ChatWindow 一致 */}
        <div className="flex-1 space-y-5 overflow-hidden px-6 py-6">
          <div className="flex justify-end">
            <SkeletonBar className="h-11 w-1/2 rounded-2xl rounded-br-md" />
          </div>
          <div className="flex justify-start">
            <div className="w-3/4 space-y-2.5">
              <SkeletonBar className="h-3.5 w-full rounded-md" />
              <SkeletonBar className="h-3.5 w-11/12 rounded-md" />
              <SkeletonBar className="h-3.5 w-4/5 rounded-md" />
            </div>
          </div>
          <div className="flex justify-end">
            <SkeletonBar className="h-11 w-2/5 rounded-2xl rounded-br-md" />
          </div>
          <div className="flex justify-start">
            <div className="w-2/3 space-y-2.5">
              <SkeletonBar className="h-3.5 w-full rounded-md" />
              <SkeletonBar className="h-3.5 w-3/4 rounded-md" />
            </div>
          </div>
        </div>

        {/* 底部输入框 */}
        <div className="border-t border-black/[0.05] px-6 py-4">
          <SkeletonBar className="h-12 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
