import Link from "next/link";
import { ArrowLeft, Settings as SettingsIcon } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { DEFAULT_MODEL } from "@/lib/ai";
import SettingsForm from "@/components/settings-form";

export const metadata = { title: "设置 - NoteMind" };

// 设置页（Server Component）
// 只读取"是否已配置 Key + 当前模型"给表单展示，绝不读取 Key 明文
export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const dbUser = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { aiApiKeyEncrypted: true, aiModel: true },
  });

  return (
    <section className="relative mx-auto max-w-2xl px-6 py-14">
      <Link
        href="/notes"
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-zinc-500 transition-colors hover:text-zinc-900"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2.2} />
        返回笔记
      </Link>

      <div className="mt-6 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#6366f1] to-[#a855f7] text-white shadow-[0_4px_14px_rgba(139,92,246,0.35)]">
          <SettingsIcon className="h-5 w-5" strokeWidth={2} />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            设置
          </h1>
          <p className="text-[13px] text-zinc-500">
            管理你的账号与 AI 配置
          </p>
        </div>
      </div>

      <SettingsForm
        hasKey={Boolean(dbUser?.aiApiKeyEncrypted)}
        currentModel={dbUser?.aiModel ?? null}
        defaultModel={DEFAULT_MODEL}
      />
    </section>
  );
}
