"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { encrypt } from "@/lib/crypto";

/**
 * 更新用户 AI 设置（BYOK）
 * -------------------------------------------------
 * 只接受用户自己的 DeepSeek Key，AES-256-GCM 加密后存库。
 * - apiKey 留空：保留旧 Key 不变（配合"清除 Key"按钮使用）
 * - 传入新 Key：覆盖旧 Key
 * 服务端永远不回传明文 Key，前端只显示"已配置"状态。
 */

const settingsSchema = z.object({
  apiKey: z.string().trim().max(200).optional(),
  aiModel: z.string().trim().max(50).optional(),
  action: z.enum(["save", "clear"]),
});

export type SettingsState = { ok?: boolean; error?: string } | undefined;

export async function updateAiSettingsAction(
  prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const user = await getCurrentUser();
  if (!user) return { error: "未登录" };

  const parsed = settingsSchema.safeParse({
    apiKey: formData.get("apiKey") ?? undefined,
    aiModel: formData.get("aiModel") ?? undefined,
    action: formData.get("action") ?? "save",
  });
  if (!parsed.success) return { error: "参数格式不正确" };

  const { apiKey, aiModel, action } = parsed.data;

  if (action === "clear") {
    // 清除 Key：置空，该用户 AI 功能回到"请配置"状态
    await prisma.user.update({
      where: { id: user.userId },
      data: { aiApiKeyEncrypted: null, aiModel: null },
    });
    revalidatePath("/settings");
    return { ok: true };
  }

  // 加密用户自己的 Key 后存储（不填 Key 时保留原值，只更新模型）
  const data: { aiApiKeyEncrypted?: string; aiModel?: string | null } = {};
  if (apiKey) data.aiApiKeyEncrypted = encrypt(apiKey);
  if (aiModel) data.aiModel = aiModel;
  if (Object.keys(data).length === 0) return { error: "没有需要保存的更改" };

  await prisma.user.update({ where: { id: user.userId }, data });
  revalidatePath("/settings");
  return { ok: true };
}
