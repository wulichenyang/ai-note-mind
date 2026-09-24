/**
 * 骨架屏基础件
 * -------------------------------------------------
 * 为什么需要骨架屏？
 * Next.js 只对「静态路由」做完整预取；像本项目这样全部页面都要查库的动态路由，
 * 在没有 loading.tsx 时预取会被**完全跳过** —— 用户点 Tab 之后要干等一整个
 * 服务器往返（实测约 645ms），而这期间界面上没有任何变化，观感就是"点了没反应"。
 *
 * 补上 loading.tsx 之后：
 *   1. fallback 骨架会被提前预取，点击瞬间就出内容
 *   2. 导航可中断 —— 不用等上一个页面加载完就能切到下一个
 *   3. 共享布局保持可交互
 *
 * 这些是 Server Component（没有 "use client"），不向客户端发送任何 JS。
 * 骨架的几何尺寸刻意对齐真实页面（同样的 max-w、同样的卡片网格、同样的行高），
 * 这样骨架换成真内容时不会发生跳动。
 */

/**
 * 一条灰色占位条。
 * 刻意不给默认圆角：Tailwind 的同优先级类靠 CSS 输出顺序决定胜负，
 * 在 className 里再写 rounded-full 不一定能覆盖基类的 rounded-md。
 */
export function SkeletonBar({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-black/[0.07] ${className}`} />;
}

/**
 * 卡片占位容器。
 * 复用站点的毛玻璃 glass-card，但不加 animate-pulse ——
 * 整张卡片跟着呼吸会显得脏，只让内部的条动即可。
 */
export function SkeletonCard({
  className = "",
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return <div className={`glass-card ${className}`}>{children}</div>;
}

/**
 * 页头占位，对齐真实页面的 text-3xl 标题 + text-[14px] 副标题。
 */
export function SkeletonPageHeader({
  subtitleWidth = "w-40",
}: {
  subtitleWidth?: string;
}) {
  return (
    <div>
      <SkeletonBar className="h-8 w-32 rounded-lg" />
      <SkeletonBar className={`mt-2.5 h-4 rounded-md ${subtitleWidth}`} />
    </div>
  );
}
