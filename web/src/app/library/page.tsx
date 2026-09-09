import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import LibraryClient from "@/components/library-client";

export const metadata = { title: "知识库 - NoteMind" };

// 知识库页（服务端壳）：上传 + 管理 + 单文件问答
// 初始文档列表在服务端取一次传给客户端，客户端负责后续动作与状态刷新
export default async function LibraryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [documents, aiUser] = await Promise.all([
    prisma.document.findMany({
      where: { ownerId: user.userId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        contentType: true,
        sizeBytes: true,
        status: true,
        error: true,
        chunkCount: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.user.findUnique({
      where: { id: user.userId },
      select: { aiApiKeyEncrypted: true },
    }),
  ]);

  return (
    <section className="relative mx-auto max-w-4xl px-6 py-14">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
            知识库
          </h1>
          <p className="mt-1.5 text-[14px] text-zinc-500">
            上传 PDF / Word / PPT / Excel / Markdown / 图片，AI 解析后即可按内容问答
          </p>
        </div>
      </div>

      <LibraryClient
        initialDocs={documents.map((d) => ({
          ...d,
          createdAt: d.createdAt.toISOString(),
          updatedAt: d.updatedAt.toISOString(),
        }))}
        aiConfigured={!!aiUser?.aiApiKeyEncrypted}
      />
    </section>
  );
}
