import { del } from "@vercel/blob";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/** 删除知识库文件（先删 Blob 对象，再删 DB 行；chunks 由外键级联清除） */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "未登录" }, { status: 401 });
  }
  const { id } = await params;

  const doc = await prisma.document.findFirst({
    where: { id, ownerId: session.user.id },
  });
  if (!doc) {
    return Response.json({ error: "文件不存在" }, { status: 404 });
  }

  // Blob 对象删除失败不阻断（孤儿对象不影响功能，可后续清理）
  try {
    await del(doc.storageKey);
  } catch (err) {
    console.error("blob delete failed:", (err as Error).message);
  }

  await prisma.document.delete({ where: { id } });
  return Response.json({ ok: true });
}
