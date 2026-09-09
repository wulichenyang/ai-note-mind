"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { callAgentIngestNote } from "@/lib/agent";

/**
 * 笔记数据访问层（Server Actions）
 * -------------------------------------------------
 * 为什么用 Server Actions 而不是 API Route？
 * 1. 表单提交直接用 action 绑定 <form>，无额外 HTTP 跳转
 * 2. 逻辑在服务端执行，前端拿不到实现细节
 * 3. 每个 action 都是独立的后端函数，天然支持授权检查
 *
 * 安全核心 —— 所有权校验（多租户隔离）：
 * 所有写操作的第一步都是 getCurrentUser()，然后用 session 里的 userId
 * 作为查询条件的一部分（where: { id, authorId }）。
 * 这样即使有人猜测出别人的 noteId 也无法操作 —— 数据归属是服务端判断的。
 */

const noteSchema = z.object({
  title: z.string().trim().min(1, "标题不能为空").max(100, "标题最多 100 字"),
  content: z.string().min(1, "内容不能为空"),
});

export type NoteFormState = { error?: string } | undefined;

/**
 * 创建笔记
 * redirect 抛出的 NEXT_REDIRECT 是框架错误，不能 catch，
 * 所以函数返回类型不包含它。
 */
export async function createNoteAction(
  prevState: NoteFormState,
  formData: FormData
): Promise<NoteFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "请先登录" };

  const parsed = noteSchema.safeParse({
    title: formData.get("title"),
    content: formData.get("content"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "输入不合法" };
  }

  const { title, content } = parsed.data;

  // 创建笔记：authorId 来自 session（服务端可信），绝不用表单提交的 userId
  const note = await prisma.note.create({
    data: { title, content, authorId: user.userId },
  });

  // 同步重建该笔记的向量索引（AI 对话检索源）；失败不阻断保存，
  // 但打印错误便于排查 —— 知识索引落后于笔记内容
  await callAgentIngestNote(note.id).catch((e) => {
    console.error(`[notes] 笔记向量化失败 note=${note.id}`, e);
  });

  // 重新生成列表页的缓存，否则新笔记不显示
  revalidatePath("/notes");
  redirect(`/notes/${note.id}`);
}

/**
 * 更新笔记：update 里用 where: { id, authorId }，
 * 若笔记不属于当前用户，Prisma 找不到记录（返回 0 条），天然拦截越权。
 */
export async function updateNoteAction(
  noteId: string,
  prevState: NoteFormState,
  formData: FormData
): Promise<NoteFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "请先登录" };

  const parsed = noteSchema.safeParse({
    title: formData.get("title"),
    content: formData.get("content"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "输入不合法" };
  }

  const result = await prisma.note.updateMany({
    where: { id: noteId, authorId: user.userId },
    data: parsed.data,
  });

  // updateMany 返回 { count }，count === 0 说明笔记不存在或不属于当前用户
  if (result.count === 0) {
    return { error: "笔记不存在或无权修改" };
  }

  // 内容已变：同步重建向量索引，保证 AI 对话能检索到最新内容
  await callAgentIngestNote(noteId).catch((e) => {
    console.error(`[notes] 笔记向量化失败 note=${noteId}`, e);
  });

  revalidatePath("/notes");
  revalidatePath(`/notes/${noteId}`);
  redirect(`/notes/${noteId}`);
}

/**
 * 删除笔记：同样用 id + authorId 组合条件
 */
export async function deleteNoteAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;

  const noteId = formData.get("noteId")?.toString();
  if (!noteId) return;

  await prisma.note.deleteMany({
    where: { id: noteId, authorId: user.userId },
  });

  revalidatePath("/notes");
  redirect("/notes");
}

/**
 * 置顶/取消置顶：独立的轻量 action
 */
export async function togglePinAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;

  const noteId = formData.get("noteId")?.toString();
  if (!noteId) return;

  // 先查当前 pinned 状态（同样校验所有权）
  const note = await prisma.note.findFirst({
    where: { id: noteId, authorId: user.userId },
    select: { pinned: true },
  });
  if (!note) return;

  await prisma.note.updateMany({
    where: { id: noteId, authorId: user.userId },
    data: { pinned: !note.pinned },
  });

  revalidatePath("/notes");
}
