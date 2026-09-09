import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Markdown 渲染组件（Server Component）
// react-markdown 默认不渲染原始 HTML（XSS 安全），
// remark-gfm 提供表格、删除线、任务列表等 GitHub 风格扩展
export default function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="prose-note">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
