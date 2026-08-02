import type { DefaultSession } from "next-auth";

/**
 * 类型扩展（declaration merging）
 * -------------------------------------------------
 * Auth.js 默认 Session.user 只有 name/email/image，
 * 我们需要在客户端/服务端到处使用 user.id，
 * 所以通过模块扩展给 Session.user 和 JWT 加 id 字段。
 */

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
  }
}
