import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

/**
 * Auth.js 核心配置（edge-safe）
 * -------------------------------------------------
 * 为什么拆成 auth.config.ts 和 auth.ts 两个文件？
 * 这是 Auth.js v5 官方推荐的 "split config" 模式：
 * - auth.config.ts：只放不依赖数据库/Node 运行时的配置（OAuth、回调、页面），
 *   用于 Next.js 16 的 proxy.ts（路由守卫）中。
 * - auth.ts：合并 Credentials Provider（需要查数据库验证密码），
 *   用于 Server Components / Server Actions / API Route。
 *
 * 为什么要 JWT 会话策略？
 * - JWT：会话信息加密后存在浏览器 cookie 里，服务端无状态、天然适合 serverless
 *   （Vercel 部署的每个函数实例都能独立验证，不需要查数据库）。
 * - 数据库会话：需要每请求查库，重且慢，只有"主动踢人下线"这种需求才值得。
 */

// Google OAuth：只有在环境变量配置了凭据时才启用
// （未配置时页面不显示 Google 按钮，不影响邮箱密码登录）
const googleProvider = process.env.AUTH_GOOGLE_ID
  ? [
      Google({
        clientId: process.env.AUTH_GOOGLE_ID,
        clientSecret: process.env.AUTH_GOOGLE_SECRET,
      }),
    ]
  : [];

export const authConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login", // 未登录访问受保护页面时跳到这里
  },
  providers: [...googleProvider],
  callbacks: {
    /**
     * authorized：proxy.ts 路由守卫的核心判断
     * 返回 false 时，Auth.js 会自动把用户重定向到 pages.signIn
     */
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isProtected = ["/notes", "/tags", "/chat"].some((p) =>
        nextUrl.pathname.startsWith(p)
      );
      if (isProtected && !isLoggedIn) return false;
      return true;
    },
  },
} satisfies NextAuthConfig;
