import NoteEditor from "@/components/note-editor";

export const metadata = { title: "新建笔记 - NoteMind" };

// 新建笔记页（Server Component，直接渲染编辑器表单）
export default function NewNotePage() {
  return (
    <section className="relative mx-auto max-w-3xl px-6 py-14">
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
        新建笔记
      </h1>
      <p className="mt-1.5 text-[14px] text-zinc-500">
        支持 Markdown 语法，记录你的每一个想法
      </p>
      <div className="glass-card mt-8 p-7">
        <NoteEditor />
      </div>
    </section>
  );
}
