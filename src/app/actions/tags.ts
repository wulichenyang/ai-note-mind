"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

/**
 * 标签数据访问层
 * -------------------------------------------------
 * Tag 与 Note 是多对多（隐式关系表 _NoteToTag）。
 * 关键设计：Tag 表用 @@unique([ownerId, name]) 保证
 * "同一用户下标签名不重复"，但不同用户可以拥有同名标签（数据隔离）。
 *
 * 关联笔记与标签的三种操作：
 * 1. connectOrCreate：标签不存在则创建，存在则复用 —— 幂等且防重复
 * 2. connect：只关联已存在的标签
 * 3. disconnect：解除关联（不删除标签本身）
 */

/**
 * 给笔记添加标签（回车时调用）
 * 返回当前笔记的所有标签名，用于前端刷新标签列表
 */
export async function addTagAction(formData: FormData): Promise<{ tags: string[] }> {
  const user = await getCurrentUser();
  if (!user) return { tags: [] };

  const noteId = formData.get("noteId")?.toString();
  const tagName = formData.get("tagName")?.toString().trim();

  if (!noteId || !tagName) return { tags: [] };
  if (tagName.length > 20) return { tags: [] };

  // 第一步：确认笔记属于当前用户（所有权）
  const note = await prisma.note.findFirst({
    where: { id: noteId, authorId: user.userId },
    select: { id: true },
  });
  if (!note) return { tags: [] };

  // 第二步：connectOrCreate —— 隐式多对多的经典写法
  // 自动在 Tag 表和 _NoteToTag 关系表插入记录
  await prisma.note.update({
    where: { id: noteId },
    data: {
      tags: {
        connectOrCreate: {
          where: { ownerId_name: { ownerId: user.userId, name: tagName } },
          create: { name: tagName, ownerId: user.userId },
        },
      },
    },
  });

  revalidatePath("/notes");
  revalidatePath(`/notes/${noteId}`);

  // 返回最新标签列表
  const updated = await prisma.note.findUnique({
    where: { id: noteId },
    select: { tags: { select: { name: true }, orderBy: { name: "asc" } } },
  });
  return { tags: updated?.tags.map((t) => t.name) ?? [] };
}

/**
 * 从笔记移除标签
 */
export async function removeTagAction(formData: FormData): Promise<{ tags: string[] }> {
  const user = await getCurrentUser();
  if (!user) return { tags: [] };

  const noteId = formData.get("noteId")?.toString();
  const tagName = formData.get("tagName")?.toString();
  if (!noteId || !tagName) return { tags: [] };

  // 先校验所有权
  const note = await prisma.note.findFirst({
    where: { id: noteId, authorId: user.userId },
    select: { id: true },
  });
  if (!note) return { tags: [] };

  await prisma.note.update({
    where: { id: noteId },
    data: {
      tags: {
        disconnect: {
          ownerId_name: { ownerId: user.userId, name: tagName },
        },
      },
    },
  });

  revalidatePath("/notes");
  revalidatePath(`/notes/${noteId}`);

  const updated = await prisma.note.findUnique({
    where: { id: noteId },
    select: { tags: { select: { name: true }, orderBy: { name: "asc" } } },
  });
  return { tags: updated?.tags.map((t) => t.name) ?? [] };
}

/**
 * 联想：根据输入前缀返回当前用户的标签（最多 8 个）
 * 用 startsWith 匹配，比 contains 更适合联想场景
 */
export async function suggestTagsAction(input: string): Promise<string[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const trimmed = input.trim();
  if (!trimmed) return [];

  const tags = await prisma.tag.findMany({
    where: { ownerId: user.userId, name: { startsWith: trimmed } },
    select: { name: true },
    orderBy: { name: "asc" },
    take: 8,
  });
  return tags.map((t) => t.name);
}
