import { auth } from "@/auth";

/**
 * 服务端获取当前登录用户
 * -------------------------------------------------
 * 用法：在 Server Component / Server Action 中调用，
 * 返回 { userId, email, name } 或 null（未登录）。
 * 这是所有数据隔离（多租户）检查的起点 ——
 * 笔记的增删改查都要校验 session.userId 归属。
 */
export async function getCurrentUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    userId: session.user.id,
    email: session.user.email,
    name: session.user.name,
  };
}
