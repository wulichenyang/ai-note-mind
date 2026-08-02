"use client";

import { useEffect, useRef } from "react";
import { Search } from "lucide-react";

// 防抖搜索框（客户端组件）
// 输入停止 300ms 后才跳转更新 URL（?q=），由服务端重新查询
// 防抖的意义：避免每次按键都触发一次服务端查询，减少请求压力
export default function NotesSearch({ keyword }: { keyword: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 组件卸载时清理定时器，防止内存泄漏
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleChange = (value: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const url = new URL(window.location.href);
      if (value.trim()) url.searchParams.set("q", value.trim());
      else url.searchParams.delete("q");
      window.location.href = url.toString();
    }, 300);
  };

  return (
    <div className="relative flex-1">
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" strokeWidth={2} />
      <input
        ref={inputRef}
        type="text"
        defaultValue={keyword}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="搜索标题或内容…"
        className="w-full rounded-xl border border-black/[0.07] bg-white/70 py-3 pl-11 pr-4 text-[14px] text-zinc-900 placeholder:text-zinc-400 outline-none backdrop-blur transition-all duration-150 focus:border-[#8b5cf6]/40 focus:bg-white focus:ring-4 focus:ring-[#a855f7]/10"
      />
    </div>
  );
}
