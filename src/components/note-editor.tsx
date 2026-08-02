"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { createNoteAction, updateNoteAction } from "@/app/actions/notes";

const inputClass =
  "w-full rounded-xl border border-black/[0.07] bg-white/70 px-4 py-3 text-[15px] text-zinc-900 placeholder:text-zinc-400 outline-none transition-all duration-150 focus:border-[#8b5cf6]/40 focus:bg-white focus:ring-4 focus:ring-[#a855f7]/10 backdrop-blur";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-primary flex items-center gap-2 px-6 py-2.5 text-[14px] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {label}
    </button>
  );
}

type NoteEditorProps = {
  note?: { id: string; title: string; content: string };
};

// 笔记编辑表单：新建/编辑共用
// 通过是否存在 note.id 判断是 create 还是 update
export default function NoteEditor({ note }: NoteEditorProps) {
  const action = note
    ? updateNoteAction.bind(null, note.id)
    : createNoteAction;
  const [state, formAction] = useActionState(action, undefined);

  return (
    <form action={formAction} className="space-y-5">
      {state?.error && (
        <p className="rounded-xl border border-red-500/20 bg-red-50/80 px-4 py-3 text-[13px] text-red-500">
          {state.error}
        </p>
      )}

      <input
        type="text"
        name="title"
        defaultValue={note?.title}
        placeholder="标题"
        className={`${inputClass} text-lg font-medium`}
        required
      />

      <textarea
        name="content"
        defaultValue={note?.content}
        placeholder="用 Markdown 记录你的想法…（支持 **加粗**、`代码`、# 标题、- 列表）"
        className={`${inputClass} min-h-[320px] font-mono text-[14px] leading-relaxed`}
        required
      />

      <div className="flex items-center gap-3">
        <SubmitButton label={note ? "保存修改" : "创建笔记"} />
        <Link
          href="/notes"
          className="btn-secondary inline-flex items-center gap-1.5 px-5 py-2.5 text-[14px]"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.2} />
          返回列表
        </Link>
      </div>
    </form>
  );
}
