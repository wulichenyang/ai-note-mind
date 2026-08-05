import { cache } from "react";
import { auth } from "@/auth";

/**
 * 服务端获取当前登录用户
 * -------------------------------------------------
 * 用法：在 Server Component / Server Action 中调用，
 * 返回 { userId, email, name } 或 null（未登录）。
 * 这是所有数据隔离（多租户）检查的起点 ——
 * 笔记的增删改查都要校验 session.userId 归属。
 *
 * 为什么用 React.cache()？（server-cache-react）
 * 同一个请求渲染期间，可能有多处调用 getCurrentUser()
 * （比如父组件 + 子组件都拿登录态）。auth() 内部每次都要解析
 * JWT cookie。cache() 保证同一请求内只真正执行一次，
 * 后续调用直接命中缓存返回值，避免重复解析。
 */
export const getCurrentUser = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    userId: session.user.id,
    email: session.user.email,
    name: session.user.name,
  };
});
