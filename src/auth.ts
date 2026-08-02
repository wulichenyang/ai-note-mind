import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/auth.config";

/**
 * 完整的 Auth.js 实例（Node 运行时）
 * -------------------------------------------------
 * 这里合并了两个东西，所以不能放在 edge-safe 的 auth.config.ts：
 * 1. Credentials Provider —— authorize 里要查数据库 + bcrypt 比对密码
 * 2. jwt/session 回调 —— Google 首次登录要在数据库里 upsert 用户
 */

// Zod 校验登录凭据（服务端必须校验，前端校验只是体验优化）
const credentialsSchema = z.object({
  email: z.string().email("邮箱格式不正确"),
  password: z.string().min(1, "请输入密码"),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    ...authConfig.providers,
    Credentials({
      credentials: {
        email: { label: "邮箱", type: "email" },
        password: { label: "密码", type: "password" },
      },
      // authorize 返回的对象会成为 session.user（JWT 里的 user 部分）
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        });
        // 用户不存在或没有密码（OAuth 注册的）→ 拒绝
        if (!user?.passwordHash) return null;

        // bcrypt.compare 自己会解析盐值，把哈希和明文比对
        const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    /**
     * jwt 回调：在 token 里持久化用户 id
     * - Credentials 登录：user 是 authorize 的返回值
     * - Google 首次登录：user 来自 OAuth，但数据库里还没有记录，
     *   这里用 upsert 把用户同步到 users 表，否则笔记无法归属
     */
    async jwt({ token, user, account, profile }) {
      if (user && account?.provider === "google" && profile?.email) {
        const dbUser = await prisma.user.upsert({
          where: { email: profile.email },
          update: { name: profile.name ?? undefined },
          create: {
            email: profile.email,
            name: profile.name ?? undefined,
          },
        });
        token.id = dbUser.id;
      } else if (user?.id) {
        // Credentials 登录，user.id 就是数据库里的用户 id
        token.id = user.id;
      }
      return token;
    },
    /**
     * session 回调：把 token 里的 id 暴露给客户端 session.user.id
     * （默认 Session.user 类型没有 id 字段，用 types/next-auth.d.ts 扩展）
     */
    async session({ session, token }) {
      if (token.id) session.user.id = token.id as string;
      return session;
    },
  },
});
