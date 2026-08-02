import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import NoteEditor from "@/components/note-editor";

export const metadata = { title: "编辑笔记 - NoteMind" };

// 编辑笔记页：加载已有数据回填到表单
export default async function EditNotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return null;

  const note = await prisma.note.findFirst({
    where: { id, authorId: user.userId },
    select: { id: true, title: true, content: true },
  });
  if (!note) notFound();

  return (
    <section className="relative mx-auto max-w-3xl px-6 py-14">
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
        编辑笔记
      </h1>
      <div className="glass-card mt-8 p-7">
        <NoteEditor note={note} />
      </div>
    </section>
  );
}
