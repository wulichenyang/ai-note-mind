"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Mail, Lock, User, Loader2 } from "lucide-react";
import { loginAction, registerAction } from "@/app/actions/auth";

/**
 * 认证表单（客户端组件）
 * -------------------------------------------------
 * 为什么必须是 client component？
 * useActionState + useFormStatus 都是 React 客户端钩子，
 * 需要实时显示错误、loading、禁用态。
 */

const inputClass =
  "w-full rounded-xl border border-black/[0.07] bg-white/70 pl-11 pr-4 py-3 text-[15px] text-zinc-900 placeholder:text-zinc-400 outline-none transition-all duration-150 focus:border-[#8b5cf6]/40 focus:bg-white focus:ring-4 focus:ring-[#a855f7]/10 backdrop-blur";

function Field({
  icon: Icon,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-zinc-400" strokeWidth={1.8} />
      <input {...props} className={inputClass} />
    </div>
  );
}

function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-primary mt-2 flex w-full items-center justify-center gap-2 py-3.5 text-[15px] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function LoginForm() {
  const [state, formAction] = useActionState(loginAction, undefined);

  return (
    <form action={formAction} className="mt-8 space-y-4">
      {state?.error && (
        <p className="rounded-xl border border-red-500/20 bg-red-50/80 px-4 py-3 text-[13px] text-red-500 backdrop-blur">
          {state.error}
        </p>
      )}

      <Field
        icon={Mail}
        type="email"
        name="email"
        placeholder="邮箱地址"
        autoComplete="email"
        required
      />
      <Field
        icon={Lock}
        type="password"
        name="password"
        placeholder="密码"
        autoComplete="current-password"
        required
      />

      <SubmitButton>登录</SubmitButton>

      <p className="pt-2 text-center text-[13px] text-zinc-500">
        还没有账号？
        <Link
          href="/register"
          className="ml-1 font-medium text-[#8b5cf6] hover:underline"
        >
          免费注册
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm() {
  const [state, formAction] = useActionState(registerAction, undefined);

  return (
    <form action={formAction} className="mt-8 space-y-4">
      {state?.error && (
        <p className="rounded-xl border border-red-500/20 bg-red-50/80 px-4 py-3 text-[13px] text-red-500 backdrop-blur">
          {state.error}
        </p>
      )}

      <Field
        icon={User}
        type="text"
        name="name"
        placeholder="昵称"
        autoComplete="nickname"
        required
      />
      <Field
        icon={Mail}
        type="email"
        name="email"
        placeholder="邮箱地址"
        autoComplete="email"
        required
      />
      <Field
        icon={Lock}
        type="password"
        name="password"
        placeholder="密码（至少 8 位）"
        autoComplete="new-password"
        required
      />

      <SubmitButton>创建账号</SubmitButton>

      <p className="pt-2 text-center text-[13px] text-zinc-500">
        已有账号？
        <Link
          href="/login"
          className="ml-1 font-medium text-[#8b5cf6] hover:underline"
        >
          直接登录
        </Link>
      </p>
    </form>
  );
}
