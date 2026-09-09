"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, Loader2, Square, PenLine, ChevronDown } from "lucide-react";

// 笔记 AI 助手组件（客户端组件）
// 功能：AI 摘要 / AI 续写，流式渲染结果，可停止
// 为什么是客户端？需要 fetch + 读取 ReadableStream 实时渲染流式文本
type NoteAIProps = {
  noteId: string;
  title: string;
  content: string;
  enabled: boolean; // AI 是否已配置
};

export default function NoteAI({ noteId, enabled }: NoteAIProps) {
  const [output, setOutput] = useState("");
  const [mode, setMode] = useState<"summary" | "continue">("summary");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // 组件卸载时中止请求
  useEffect(() => () => abortRef.current?.abort(), []);

  const runAI = async (action: "summary" | "continue") => {
    setMode(action);
    setLoading(true);
    setError("");
    setOutput("");
    setOpen(true);
    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/ai/note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId, action }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `请求失败（${res.status}）`);
      }

      // 流式读取：res.body 是 ReadableStream
      // 逐块解析 text 流并追加到 output，实现打字机效果
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        // SSE 格式：以 "data: " 开头，以换行分隔
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? ""; // 保留未完成的行
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === "[DONE]") continue;
          try {
            const json = JSON.parse(payload);
            const delta = json.choices?.[0]?.delta?.content ?? "";
            if (delta) setOutput((prev) => prev + delta);
          } catch {
            // 忽略无法解析的行
          }
        }
      }
    } catch (err: unknown) {
      if ((err as Error).name === "AbortError") return;
      setError((err as Error).message || "AI 调用失败");
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  const stop = () => abortRef.current?.abort();

  return (
    <div className="mt-8">
      {/* 控制条 */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => runAI("summary")}
          disabled={!enabled || loading}
          className="inline-flex items-center gap-1.5 rounded-full border border-[#8b5cf6]/30 bg-[#8b5cf6]/10 px-4 py-2 text-[13px] font-medium text-[#9333ea] transition-all duration-150 hover:bg-[#8b5cf6]/20 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading && mode === "summary" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" strokeWidth={2.2} />
          )}
          AI 摘要
        </button>
        <button
          type="button"
          onClick={() => runAI("continue")}
          disabled={!enabled || loading}
          className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.08] bg-white/60 px-4 py-2 text-[13px] font-medium text-zinc-600 transition-all duration-150 hover:bg-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading && mode === "continue" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <PenLine className="h-3.5 w-3.5" strokeWidth={2.2} />
          )}
          AI 续写
        </button>
        {!enabled && (
          <a
            href="/settings"
            className="text-[12px] text-zinc-400 underline decoration-dotted underline-offset-2 transition-colors hover:text-[#8b5cf6]"
          >
            未配置 Key，去设置页填写你的 DeepSeek Key
          </a>
        )}
      </div>

      {/* 结果面板 */}
      {open && (
        <div className="glass-card relative mt-4 overflow-hidden p-6">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#8b5cf6]/40 to-transparent" />
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[12px] font-semibold uppercase tracking-wider text-zinc-400">
              {mode === "summary" ? "AI 摘要" : "AI 续写"}
            </span>
            <div className="flex items-center gap-2">
              {loading && (
                <button
                  type="button"
                  onClick={stop}
                  className="inline-flex items-center gap-1 rounded-full border border-red-500/20 bg-red-50/60 px-3 py-1 text-[12px] font-medium text-red-500 transition-colors hover:bg-red-50"
                >
                  <Square className="h-3 w-3 fill-current" strokeWidth={2.4} />
                  停止
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-1 text-zinc-400 transition-colors hover:text-zinc-600"
                aria-label="收起"
              >
                <ChevronDown className="h-4 w-4" strokeWidth={2.2} />
              </button>
            </div>
          </div>

          {error && (
            <p className="rounded-xl border border-red-500/20 bg-red-50/80 px-4 py-3 text-[13px] text-red-500">
              {error}
            </p>
          )}

          <div className="whitespace-pre-wrap text-[14px] leading-relaxed text-zinc-700">
            {output}
            {loading && (
              <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-[#8b5cf6] align-middle" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
