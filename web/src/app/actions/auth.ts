"use server";

import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { signIn } from "@/auth";

/**
 * 认证 Server Actions
 * -------------------------------------------------
 * 为什么用 Server Actions 而不是 API Route？
 * 注册/登录是表单提交，Server Actions 可以直接绑定到 <form>，
 * 少一次 HTTP 往返，且逻辑天然在服务端执行（前端拿不到实现）。
 *
 * useActionState 的约定：action(prevState, formData) -> newState
 */

// 注册表单校验：Zod 是服务端校验的权威，前端校验只是体验优化
const registerSchema = z.object({
  name: z.string().min(1, "请输入昵称").max(30, "昵称最多 30 个字符"),
  email: z.string().email("邮箱格式不正确"),
  password: z.string().min(8, "密码至少 8 位"),
});

export type AuthState = { error?: string } | undefined;

/**
 * 注册：校验 → 查重 → bcrypt 哈希 → 建用户 → 自动登录
 */
export async function registerAction(
  prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "输入不合法" };
  }

  const { name, email, password } = parsed.data;

  // 邮箱唯一性检查（数据库也有 unique 约束，这里是提前友好报错）
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "该邮箱已被注册" };

  // bcrypt 加盐 10 轮：慢哈希，抵御暴力破解
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.create({
    data: { email, name, passwordHash },
  });

  // 注册成功后直接登录（credentials 是刚创建的真实凭据）
  await signIn("credentials", { email, password, redirectTo: "/notes" });
}

/**
 * 登录：交给 Credentials Provider 的 authorize 验证
 * signIn 成功后会抛出 NEXT_REDIRECT 错误（不是真正的错误），
 * 所以 catch 里只处理 AuthError，其余必须重新抛出。
 */
export async function loginAction(
  prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = formData.get("email")?.toString() ?? "";
  const password = formData.get("password")?.toString() ?? "";

  try {
    await signIn("credentials", { email, password, redirectTo: "/notes" });
  } catch (error) {
    if (error instanceof AuthError) {
      // CredentialsSignin 是通用的"凭据无效"错误（Auth.js 出于安全考虑
      // 不区分"用户不存在"和"密码错误"，避免攻击者探测邮箱是否注册）
      return { error: "邮箱或密码错误" };
    }
    throw error; // NEXT_REDIRECT 等框架错误必须继续抛
  }
}
