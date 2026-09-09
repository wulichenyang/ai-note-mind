import { randomUUID } from "node:crypto";
import { put } from "@vercel/blob";
import { auth } from "@/auth";
import { callAgentIngest } from "@/lib/agent";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 60; // 上传后会同步等待 agent 解析+向量化（小文档几秒内）

/**
 * 文件上传路由（知识库 RAG 的入口）
 * POST /api/files   multipart/form-data: file=<原始文件>
 * -------------------------------------------------
 * 流程：
 * 1. 登录鉴权（BYOK 体系：所有数据先按 user 隔离）
 * 2. 白名单校验类型 + 4MB 大小上限（Vercel Serverless body 硬限制 ~4.5MB）
 * 3. 原文件上传到 Vercel Blob（public store，key 带 UUID 不可枚举）
 * 4. 在 documents 表写一条 status='uploaded' 的元数据
 *
 * 后续由 agent(Python) 轮询/回调处理：读取原文件 → 多模态解析
 * → 分片 → DashScope 向量化 → 写回 chunks 表，并把 status 置为 ready/failed。
 *
 * 注：大文件（>4MB）后续走 Vercel Blob 客户端直传方案，当前 MVP 先限流。
 */

// 允许的类型白名单：MIME → 可接受的扩展名
// 后续 agent 端据此路由到不同解析器（PDF/Office/纯文本/图片走 qwen-vl）
const ALLOWED: Record<string, readonly string[]> = {
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "text/markdown": [".md"],
  "text/html": [".html"],
  "text/plain": [".txt", ".log"],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/webp": [".webp"],
};

const MAX_SIZE = 4 * 1024 * 1024; // 4MB（Vercel Functions body 上限约 4.5MB）

/** 我的知识库文件列表（不含 chunk 明细，轻量展示用） */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "未登录" }, { status: 401 });
  }
  const documents = await prisma.document.findMany({
    where: { ownerId: session.user.id },
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
  });
  return Response.json({ documents });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "未登录" }, { status: 401 });
  }
  const userId = session.user.id;

  // 引导配置：本地/Vercel 都需提供 Blob store 的读写 token
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return Response.json(
      {
        error:
          "BLOB_READ_WRITE_TOKEN 未配置。请在 Vercel Dashboard → Storage 创建 Blob store，把读写 token 填入环境变量。",
      },
      { status: 500 },
    );
  }

  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return Response.json({ error: "缺少 file 字段" }, { status: 400 });
  }
  if (file.size === 0) {
    return Response.json({ error: "文件为空" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return Response.json(
      { error: "文件超过 4MB 上限，MVP 阶段请压缩后重试" },
      { status: 400 },
    );
  }

  const ext = "." + (file.name.split(".").pop()?.toLowerCase() ?? "");
  const allowedExts = ALLOWED[file.type];
  if (!allowedExts || !allowedExts.includes(ext)) {
    return Response.json(
      {
        error: `不支持的文件类型（${file.type}）。支持：PDF / Word / PPT / Excel / Markdown / HTML / TXT / 图片`,
      },
      { status: 400 },
    );
  }

  // 清洗文件名中的路径/特殊字符，避免注入；key 带 UUID 保证不可枚举且不覆盖
  const safeName = file.name.replace(/[^\w.\-\u4e00-\u9fa5]+/g, "_");
  const key = `uploads/${randomUUID()}-${safeName}`;

  const blob = await put(key, file, {
    access: "public",
    addRandomSuffix: false,
    contentType: file.type,
  });

  const document = await prisma.document.create({
    data: {
      ownerId: userId,
      name: file.name,
      contentType: file.type,
      sizeBytes: file.size,
      storageKey: blob.url,
      status: "uploaded", // 上传完成即触发 agent 解析，成功后置 ready/failed
    },
  });

  // 同步调用 agent 解析：下载原文件 → 分片 → DashScope 向量化 → 写回 pgvector
  // agent 未配置/失败时保持 failed 或 uploaded，前端提供"重新解析"入口
  let parsed = document;
  try {
    await callAgentIngest(document.id);
    parsed = await prisma.document.findUniqueOrThrow({
      where: { id: document.id },
    });
  } catch (err) {
    // agent 侧失败会把 status 置为 failed；这里仅记录，仍返回文档结构
    console.error("ingest trigger failed:", (err as Error).message);
  }

  return Response.json({ document: parsed });
}
