"use client";

import { useRef } from "react";
import { Pin, Pencil, Trash2 } from "lucide-react";
import { deleteNoteAction, togglePinAction } from "@/app/actions/notes";

// 详情页操作栏（客户端组件）
// 置顶/删除是 form action，需要交互状态（confirm 弹窗）
export default function NoteDetailActions({
  noteId,
  pinned,
}: {
  noteId: string;
  pinned: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="flex items-center gap-2">
      {/* 置顶/取消置顶 */}
      <form action={togglePinAction}>
        <input type="hidden" name="noteId" value={noteId} />
        <button
          type="submit"
          className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium transition-all duration-150 active:scale-95 ${
            pinned
              ? "border-[#8b5cf6]/30 bg-[#8b5cf6]/10 text-[#9333ea]"
              : "border-black/[0.08] bg-white/60 text-zinc-600 hover:bg-white"
          }`}
        >
          <Pin className="h-3.5 w-3.5" strokeWidth={2.2} />
          {pinned ? "已置顶" : "置顶"}
        </button>
      </form>

      {/* 编辑 */}
      <a
        href={`/notes/${noteId}/edit`}
        className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.08] bg-white/60 px-3.5 py-1.5 text-[12.5px] font-medium text-zinc-600 transition-all duration-150 hover:bg-white active:scale-95"
      >
        <Pencil className="h-3.5 w-3.5" strokeWidth={2.2} />
        编辑
      </a>

      {/* 删除（带确认） */}
      <form ref={formRef} action={deleteNoteAction}>
        <input type="hidden" name="noteId" value={noteId} />
        <button
          type="submit"
          onClick={(e) => {
            if (!confirm("确定删除这篇笔记吗？此操作不可撤销。")) {
              e.preventDefault();
            }
          }}
          className="inline-flex items-center gap-1.5 rounded-full border border-red-500/20 bg-red-50/60 px-3.5 py-1.5 text-[12.5px] font-medium text-red-500 transition-all duration-150 hover:bg-red-50 active:scale-95"
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={2.2} />
          删除
        </button>
      </form>
    </div>
  );
}
