"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { KeyRound, Loader2, Check, Trash2, ExternalLink } from "lucide-react";
import { updateAiSettingsAction, type SettingsState } from "@/app/actions/settings";

// 设置页 AI 表单（Client Component）
// -------------------------------------------------
// 填自己的 DeepSeek Key（服务端加密存储，前端永不回显明文）。
// useActionState 驱动 Server Action；需要实时 loading / 提示状态。

const inputClass =
  "w-full rounded-xl border border-black/[0.07] bg-white/70 px-4 py-3 text-[14px] text-zinc-900 placeholder:text-zinc-400 outline-none transition-all duration-150 focus:border-[#8b5cf6]/40 focus:bg-white focus:ring-4 focus:ring-[#a855f7]/10 backdrop-blur";

const MODELS = [
  { value: "deepseek-chat", label: "deepseek-chat（V3，通用对话）" },
  { value: "deepseek-reasoner", label: "deepseek-reasoner（R1，深度推理）" },
];

function SubmitButton({
  label,
  disabled,
}: {
  label: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name="action"
      value="save"
      disabled={pending || disabled}
      className="btn-primary flex items-center justify-center gap-2 px-6 py-2.5 text-[14px] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Check className="h-4 w-4" strokeWidth={2.4} />
      )}
      {label}
    </button>
  );
}

export default function SettingsForm({
  hasKey,
  currentModel,
  defaultModel,
}: {
  hasKey: boolean;
  currentModel: string | null;
  defaultModel: string;
}) {
  const [state, formAction] = useActionState<SettingsState, FormData>(
    updateAiSettingsAction,
    undefined,
  );
  const [keyDraft, setKeyDraft] = useState("");
  const [clearDraft, setClearDraft] = useState(false);

  // 需要填写 Key 的模式（未配置 / 点过"更换 Key"）下，没填新 Key 不允许提交
  const changing = !hasKey || clearDraft;
  const saveDisabled = changing && keyDraft.trim().length === 0;

  return (
    <div className="glass-card mt-8 p-8">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#6366f1] to-[#a855f7] text-white shadow-[0_4px_14px_rgba(139,92,246,0.35)]">
          <KeyRound className="h-5 w-5" strokeWidth={2} />
        </span>
        <div>
          <h2 className="text-[17px] font-semibold tracking-tight text-zinc-900">
            DeepSeek API Key（用户自带）
          </h2>
          <p className="text-[12.5px] text-zinc-500">
            用自己的 Key，AI 调用消耗你自己的额度
          </p>
        </div>
      </div>

      {/* 状态提示 */}
      <div
        className={`mt-5 flex items-start gap-2.5 rounded-xl border px-4 py-3 text-[13px] ${
          hasKey
            ? "border-emerald-500/20 bg-emerald-50/70 text-emerald-700"
            : "border-amber-500/25 bg-amber-50/70 text-amber-700"
        }`}
      >
        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-current/15">
          {hasKey ? (
            <Check className="h-3 w-3" strokeWidth={3} />
          ) : (
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
          )}
        </span>
        {hasKey
          ? "已配置（Key 已加密保存，不会显示明文）。不填新 Key 直接保存，可只修改模型。"
          : "尚未配置。在下方粘贴你的 DeepSeek Key（https://platform.deepseek.com 获取），保存后即可使用 AI 功能。"}
      </div>

      {/* 表单 */}
      <form action={formAction} className="mt-6 space-y-5">
        {state?.error && (
          <p className="rounded-xl border border-red-500/20 bg-red-50/80 px-4 py-3 text-[13px] text-red-500">
            {state.error}
          </p>
        )}
        {state?.ok && (
          <p className="rounded-xl border border-emerald-500/20 bg-emerald-50/80 px-4 py-3 text-[13px] text-emerald-700">
            已保存。你的 Key 已加密存储，可立即使用 AI 功能。
          </p>
        )}

        {/* Key 输入区 */}
        {changing ? (
          <div>
            <label className="mb-1.5 block text-[12.5px] font-medium text-zinc-600">
              {hasKey ? "新 DeepSeek Key（覆盖旧 Key）" : "DeepSeek Key"}
            </label>
            <input
              type="password"
              name="apiKey"
              value={keyDraft}
              onChange={(e) => setKeyDraft(e.target.value)}
              placeholder="sk-…"
              autoComplete="off"
              className={`${inputClass} font-mono`}
            />
            <p className="mt-1.5 text-[12px] text-zinc-400">
              Key 仅加密保存到数据库，服务端调用时使用，不会显示或泄露。
            </p>
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-xl border border-black/[0.06] bg-white/50 px-4 py-3">
            <span className="text-[13px] text-zinc-500">
              Key 已配置（加密存储）
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setClearDraft(true)}
                className="inline-flex items-center gap-1 rounded-full border border-black/[0.08] bg-white/70 px-3 py-1.5 text-[12px] font-medium text-zinc-600 transition-all hover:bg-white active:scale-95"
              >
                更换 Key
              </button>
              <button
                type="submit"
                name="action"
                value="clear"
                className="inline-flex items-center gap-1 rounded-full border border-red-500/20 bg-red-50/70 px-3 py-1.5 text-[12px] font-medium text-red-500 transition-all hover:bg-red-50 active:scale-95"
              >
                <Trash2 className="h-3 w-3" strokeWidth={2.2} />
                清除
              </button>
            </div>
          </div>
        )}

        {/* 模型选择 */}
        <div>
          <label className="mb-1.5 block text-[12.5px] font-medium text-zinc-600">
            模型
          </label>
          <select
            name="aiModel"
            defaultValue={currentModel ?? defaultModel}
            className={`${inputClass} appearance-none`}
          >
            {MODELS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <SubmitButton
            label={hasKey && !changing ? "保存设置" : "保存 Key"}
            disabled={saveDisabled}
          />
          <a
            href="https://platform.deepseek.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[13px] font-medium text-[#8b5cf6] transition-opacity hover:opacity-70"
          >
            获取 DeepSeek Key
            <ExternalLink className="h-3.5 w-3.5" strokeWidth={2.2} />
          </a>
        </div>

        <p className="border-t border-black/[0.05] pt-4 text-[12px] leading-relaxed text-zinc-400">
          安全说明：Key 使用 AES-256-GCM 加密后存储，只有你自己调用 AI 时会在服务端
          解密使用；本站不提供共享 Key，也不会看到你的明文 Key。清除后 AI 功能将
          暂停，直到重新配置。
        </p>
      </form>
    </div>
  );
}
