"use client";

// 标签筛选下拉框（客户端组件）
// Server Component 不能传事件处理器，所以下拉框必须抽成客户端组件
// onChange 时更新 URL 的 ?tag= 参数，由服务端重新查询
type TagsFilterProps = {
  allTags: { name: string; _count: { notes: number } }[];
  currentTag: string;
};

export default function TagsFilter({ allTags, currentTag }: TagsFilterProps) {
  return (
    <select
      defaultValue={currentTag}
      onChange={(e) => {
        const url = new URL(window.location.href);
        if (e.target.value) url.searchParams.set("tag", e.target.value);
        else url.searchParams.delete("tag");
        window.location.href = url.toString();
      }}
      className="rounded-xl border border-black/[0.07] bg-white/70 px-4 py-3 text-[14px] text-zinc-700 outline-none backdrop-blur transition-all duration-150 focus:border-[#8b5cf6]/40 focus:ring-4 focus:ring-[#a855f7]/10"
    >
      <option value="">全部标签</option>
      {allTags.map((t) => (
        <option key={t.name} value={t.name}>
          {t.name}（{t._count.notes}）
        </option>
      ))}
    </select>
  );
}
