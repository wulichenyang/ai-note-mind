"use client";

import { memo } from "react";
import dynamic from "next/dynamic";
import remarkGfm from "remark-gfm";

/**
 * 懒加载的 Markdown 渲染（客户端专用）
 * -------------------------------------------------
 * 为什么动态导入？（bundle-dynamic-imports）
 * react-markdown 及其底层 unified/mdast 依赖体积不小，且只在"助手消息"
 * 渲染时用到。静态 import 会打进聊天主 bundle，首屏/交互都要下载。
 * 动态导入把它拆成独立 chunk，首次出现助手消息时才按需下载。
 *
 * remark-gfm 只是个小函数，静态导入成本极低，不必拆。
 * ssr: false —— 聊天消息是流式动态渲染的，无需服务端预渲染。
 */

const ReactMarkdown = dynamic(
  () => import("react-markdown").then((m) => m.default),
  {
    ssr: false,
    loading: () => <span className="animate-pulse text-zinc-400">渲染中…</span>,
  },
);

function ChatMarkdownInner({ content }: { content: string }) {
  return (
    <div className="prose-note">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

// memo：同一段 content 不重复解析 markdown
export default memo(ChatMarkdownInner);
