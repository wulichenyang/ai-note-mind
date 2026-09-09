import { NotebookPen } from "lucide-react";
import { RegisterForm } from "@/components/auth-forms";

export const metadata = { title: "注册 - NoteMind" };

// 浅色认证页：氛围光斑 + 居中毛玻璃卡片
export default function RegisterPage() {
  return (
    <section className="relative flex min-h-[calc(100vh-3rem)] items-center justify-center overflow-hidden px-6 py-16">
      {/* 氛围光斑 + 网格 */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="bg-grid absolute inset-0" />
        <div className="bg-scanline absolute inset-0" />
        <div className="animate-flow-a absolute -top-10 left-[5%] h-[480px] w-[480px] rounded-full bg-[#c4b5fd]/55 blur-3xl" />
        <div className="animate-flow-b absolute top-[20%] right-[5%] h-[420px] w-[420px] rounded-full bg-[#a5b4fc]/50 blur-3xl" />
        <div className="animate-flow-c absolute bottom-[10%] left-[15%] h-[360px] w-[360px] rounded-full bg-[#f0abfc]/40 blur-3xl" />
      </div>

      <div className="relative w-full max-w-[400px]">
        <div className="animate-fade-up text-center">
          <span className="mx-auto flex h-13 w-13 items-center justify-center rounded-[18px] bg-gradient-to-br from-[#6366f1] via-[#8b5cf6] to-[#a855f7] shadow-[0_8px_28px_rgba(139,92,246,0.45)]">
            <NotebookPen className="h-6.5 w-6.5 text-white" strokeWidth={2} />
          </span>
          <h1 className="mt-7 text-[30px] font-semibold tracking-tight text-zinc-900">
            创建你的账号
          </h1>
          <p className="mt-2.5 text-[14px] text-zinc-500">
            免费开始，30 秒上手
          </p>
        </div>

        <div
          className="animate-fade-up glass-card mt-9 p-8"
          style={{ animationDelay: "100ms" }}
        >
          <RegisterForm />
        </div>
      </div>
    </section>
  );
}
