"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  UploadCloud,
  Loader2,
  Trash2,
  RefreshCw,
  FileText,
  FileImage,
  FileSpreadsheet,
  File as FileIcon,
  CheckCircle2,
  XCircle,
  Clock,
  MessageSquareText,
} from "lucide-react";

type DocItem = {
  id: string;
  name: string;
  contentType: string;
  sizeBytes: number;
  status: string; // uploaded | processing | ready | failed
  error: string | null;
  chunkCount: number;
  createdAt: string;
  updatedAt: string;
};

const ACCEPT = [
  ".pdf",
  ".docx",
  ".pptx",
  ".xlsx",
  ".md",
  ".html",
  ".txt",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
].join(",");

const STATUS_META: Record<string, { label: string; icon: typeof Clock; cls: string }> = {
  uploaded: { label: "排队解析", icon: Clock, cls: "text-amber-600 bg-amber-500/10" },
  processing: { label: "解析中", icon: Loader2, cls: "text-indigo-600 bg-indigo-500/10" },
  ready: { label: "已就绪", icon: CheckCircle2, cls: "text-emerald-600 bg-emerald-500/10" },
  failed: { label: "解析失败", icon: XCircle, cls: "text-rose-600 bg-rose-500/10" },
};

function fileKind(contentType: string) {
  if (contentType.startsWith("image/")) return "image";
  if (contentType.includes("spreadsheet")) return "sheet";
  if (contentType === "application/pdf") return "pdf";
  return "doc";
}

function kindIcon(kind: string) {
  const cls = "h-4 w-4";
  if (kind === "image") return <FileImage className={cls} />;
  if (kind === "sheet") return <FileSpreadsheet className={cls} />;
  if (kind === "pdf") return <FileText className={cls} />;
  return <FileIcon className={cls} />;
}

function humanSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function LibraryClient({
  initialDocs,
  aiConfigured,
}: {
  initialDocs: DocItem[];
  aiConfigured: boolean;
}) {
  const [docs, setDocs] = useState<DocItem[]>(initialDocs);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const upsertDoc = (doc: DocItem) =>
    setDocs((prev) => [doc, ...prev.filter((d) => d.id !== doc.id)]);

  // ---------- 上传 ----------
  const handleFile = async (file: File) => {
    if (file.size > 4 * 1024 * 1024) {
      setUploadError("文件超过 4MB 上限，MVP 阶段请压缩后重试");
      return;
    }
    setUploading(true);
    setUploadError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/files", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `上传失败（${res.status}）`);
      upsertDoc(data.document);
    } catch (err) {
      setUploadError((err as Error).message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  // ---------- 删除 / 重试 ----------
  const removeDoc = async (doc: DocItem) => {
    if (!window.confirm(`删除《${doc.name}》？其向量分片将一并清除。`)) return;
    setBusyId(doc.id);
    try {
      const res = await fetch(`/api/files/${doc.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("删除失败");
      setDocs((prev) => prev.filter((d) => d.id !== doc.id));
    } catch (err) {
      window.alert((err as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const reprocess = async (doc: DocItem) => {
    setBusyId(doc.id);
    try {
      const res = await fetch(`/api/files/${doc.id}/process`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "重试失败");
      upsertDoc(data.document);
    } catch (err) {
      window.alert((err as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const readyCount = docs.filter((d) => d.status === "ready").length;

  return (
    <div className="mt-8 space-y-6">
      {/* 上传区 */}
      <div
        className="glass-card group relative cursor-pointer overflow-hidden p-6 text-center transition-all duration-200 hover:shadow-lg active:scale-[0.995]"
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#8b5cf6]/40 to-transparent" />
        {uploading ? (
          <div className="flex flex-col items-center gap-2 py-2 text-zinc-500">
            <Loader2 className="h-6 w-6 animate-spin text-[#8b5cf6]" />
            <span className="text-[13px]">上传并解析中…（AI 读取→分片→向量化，稍候）</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-2">
            <UploadCloud className="h-6 w-6 text-[#8b5cf6] transition-transform duration-200 group-hover:-translate-y-0.5" />
            <span className="text-[13px] font-medium text-zinc-600">
              点击上传文件，AI 自动解析入库
            </span>
            <span className="text-[11px] text-zinc-400">
              PDF / Word / PPT / Excel / Markdown / HTML / TXT / 图片 · 单个 ≤ 4MB
            </span>
          </div>
        )}
        {uploadError && <p className="mt-2 text-[12px] text-rose-500">{uploadError}</p>}
      </div>

      {/* 概览 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] text-zinc-500">
          共 {docs.length} 个文件 · {readyCount} 个已就绪
        </p>
        {!aiConfigured && (
          <a
            href="/settings"
            className="text-[12px] text-zinc-400 underline decoration-dotted underline-offset-2 transition-colors hover:text-[#8b5cf6]"
          >
            未配置 DeepSeek Key，去设置页填写后即可在 AI 对话中引用这些资料
          </a>
        )}
      </div>

      {/* 文件列表 */}
      {docs.length === 0 ? (
        <div className="glass-card py-14 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#6366f1]/10 to-[#a855f7]/10">
            <FileIcon className="h-5 w-5 text-zinc-400" />
          </div>
          <p className="text-[14px] text-zinc-500">还没有上传文件</p>
          <p className="mt-1 text-[12px] text-zinc-400">上传后 AI 会切分并建立向量索引，AI 对话会自动引用这些资料</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {docs.map((doc) => {
            const kind = fileKind(doc.contentType);
            const meta = STATUS_META[doc.status] ?? STATUS_META.uploaded;
            const StatusIcon = meta.icon;
            const busy = busyId === doc.id;
            return (
              <li key={doc.id} className="glass-card relative overflow-hidden">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#8b5cf6]/30 to-transparent" />
                <div className="flex items-center gap-3 p-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#6366f1]/10 to-[#a855f7]/10 text-[#8b5cf6]">
                    {kindIcon(kind)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium text-zinc-800">{doc.name}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.cls}`}
                      >
                        <StatusIcon
                          className={`h-3 w-3 ${doc.status === "processing" ? "animate-spin" : ""}`}
                        />
                        {meta.label}
                      </span>
                      <span className="text-[11px] text-zinc-400">
                        {humanSize(doc.sizeBytes)}
                        {doc.status === "ready" ? ` · ${doc.chunkCount} 个分片` : ""}
                      </span>
                    </div>
                    {doc.status === "failed" && doc.error && (
                      <p className="mt-1 truncate text-[11px] text-rose-400" title={doc.error}>
                        {doc.error}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {doc.status === "ready" && aiConfigured && (
                      <Link
                        href="/chat"
                        className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#6366f1] to-[#a855f7] px-3 py-1.5 text-[12px] font-medium text-white shadow-[0_2px_8px_rgba(139,92,246,0.35)] transition-all hover:shadow-[0_4px_12px_rgba(139,92,246,0.45)] active:scale-95"
                      >
                        <MessageSquareText className="h-3.5 w-3.5" strokeWidth={2.2} />
                        去对话提问
                      </Link>
                    )}
                    {doc.status === "failed" && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => reprocess(doc)}
                        className="inline-flex items-center gap-1 rounded-full border border-[#8b5cf6]/30 bg-[#8b5cf6]/10 px-3 py-1.5 text-[12px] font-medium text-[#7c3aed] transition-all hover:bg-[#8b5cf6]/20 active:scale-95 disabled:opacity-50"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
                        重新解析
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busy || uploading}
                      onClick={() => removeDoc(doc)}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-rose-500/10 hover:text-rose-500 active:scale-95 disabled:opacity-40"
                      aria-label="删除"
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={2} />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
