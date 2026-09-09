"use client";

import { useCallback, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { addTagAction, removeTagAction, suggestTagsAction } from "@/app/actions/tags";

// 标签输入组件（客户端组件）
// 功能：回车添加标签、输入联想已有标签、点击标签移除
// 关键点：联想用 Server Action（suggestTagsAction）查库，但输入时防抖 200ms
type TagInputProps = {
  noteId: string;
  initialTags: string[];
};

export default function TagInput({ noteId, initialTags }: TagInputProps) {
  const [tags, setTags] = useState<string[]>(initialTags);
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 输入联想：防抖 200ms 后调 Server Action
  const handleInputChange = (value: string) => {
    setInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!value.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      const result = await suggestTagsAction(value);
      // 过滤掉已添加的标签
      setSuggestions(result.filter((t) => !tags.includes(t)));
      setShowSuggestions(true);
    }, 200);
  };

  // 添加标签
  const handleAdd = useCallback(
    async (name?: string) => {
      const tagName = (name ?? input).trim();
      if (!tagName || tags.includes(tagName)) {
        setInput("");
        setShowSuggestions(false);
        return;
      }

      const formData = new FormData();
      formData.set("noteId", noteId);
      formData.set("tagName", tagName);
      const result = await addTagAction(formData);
      setTags(result.tags);
      setInput("");
      setSuggestions([]);
      setShowSuggestions(false);
    },
    [input, tags, noteId]
  );

  // 移除标签
  const handleRemove = async (tagName: string) => {
    const formData = new FormData();
    formData.set("noteId", noteId);
    formData.set("tagName", tagName);
    const result = await removeTagAction(formData);
    setTags(result.tags);
  };

  return (
    <div className="relative">
      {/* 已添加的标签 */}
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-[#8b5cf6]/10 px-3 py-1 text-[12.5px] font-medium text-[#9333ea]"
          >
            {tag}
            <button
              type="button"
              onClick={() => handleRemove(tag)}
              className="transition-opacity hover:opacity-60"
              aria-label={`移除标签 ${tag}`}
            >
              <X className="h-3 w-3" strokeWidth={2.4} />
            </button>
          </span>
        ))}

        {/* 输入框 */}
        <input
          type="text"
          value={input}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
          onFocus={() => input.trim() && setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          placeholder={tags.length ? "＋ 添加标签" : "添加标签（回车确认）"}
          className="min-w-[120px] flex-1 rounded-lg border border-dashed border-black/[0.15] bg-transparent px-3 py-1 text-[13px] text-zinc-700 placeholder:text-zinc-400 outline-none transition-all duration-150 focus:border-[#8b5cf6]/50"
        />
      </div>

      {/* 联想下拉 */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute left-0 top-full z-20 mt-1.5 w-56 overflow-hidden rounded-xl border border-black/[0.06] bg-white/90 p-1.5 shadow-xl backdrop-blur-xl">
          {suggestions.map((tag) => (
            <button
              key={tag}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault(); // 防止 input 失焦
                handleAdd(tag);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] text-zinc-700 transition-colors hover:bg-[#8b5cf6]/10 hover:text-[#9333ea]"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.4} />
              {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
