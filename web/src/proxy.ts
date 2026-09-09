import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

/**
 * 路由守卫（Next.js 16 将 middleware 重命名为 proxy）
 * -------------------------------------------------
 * 注意：这里使用 auth.config.ts（edge-safe 版本），不包含
 * Credentials Provider 和数据库访问 —— proxy 只解析 JWT cookie，
 * 通过 authorized 回调判断是否放行/重定向到 /login。
 *
 * 为什么不用完整 auth.ts？
 * proxy 部署在 CDN/边缘，不能做数据库查询，所以必须用轻量配置。
 */
export const { auth } = NextAuth(authConfig);

export { auth as proxy };

export const config = {
  // 只拦截需要登录的路由；排除静态资源和图片
  matcher: ["/notes/:path*", "/tags/:path*", "/chat/:path*", "/settings/:path*"],
};
