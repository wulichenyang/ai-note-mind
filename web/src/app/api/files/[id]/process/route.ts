import { auth } from "@/auth";
import { callAgentIngest } from "@/lib/agent";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 60;

/** 重新解析文档：failed 重试 / 内容更新后重建分片与向量 */
export async function POST(
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
    select: { id: true },
  });
  if (!doc) {
    return Response.json({ error: "文件不存在" }, { status: 404 });
  }

  await prisma.document.update({
    where: { id },
    data: { status: "processing", error: null },
  });

  try {
    await callAgentIngest(id);
  } catch (err) {
    console.error("reprocess failed:", (err as Error).message);
  }

  const updated = await prisma.document.findUniqueOrThrow({ where: { id } });
  return Response.json({ document: updated });
}
