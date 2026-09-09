import Link from "next/link";
import {
  Sparkles,
  MessageSquareText,
  Search,
  Tag,
  ArrowRight,
  Zap,
} from "lucide-react";
import ProductPreview from "@/components/product-preview";

export default function Home() {
  return (
    <section className="relative overflow-hidden">
      {/* ===== 氛围光斑：毛玻璃的"磨砂对象"（iOS 桌面壁纸气质） ===== */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        {/* 细网格背景（设计感） */}
        <div className="bg-grid absolute inset-0" />
        {/* 扫描光线（动态设计感） */}
        <div className="bg-scanline absolute inset-0" />
        {/* 大光斑全部放在可视区域内流动，透明度更高更明显 */}
        <div className="animate-flow-a absolute -top-10 left-[10%] h-[600px] w-[600px] rounded-full bg-[#c4b5fd]/60 blur-3xl" />
        <div
          className="animate-flow-b absolute top-[15%] right-[5%] h-[540px] w-[540px] rounded-full bg-[#a5b4fc]/55 blur-3xl"
          style={{ animationDelay: "-4s" }}
        />
        <div
          className="animate-flow-c absolute top-[45%] left-[20%] h-[480px] w-[480px] rounded-full bg-[#f0abfc]/45 blur-3xl"
          style={{ animationDelay: "-8s" }}
        />
        <div
          className="animate-flow-b absolute bottom-[5%] right-[25%] h-[400px] w-[400px] rounded-full bg-[#a7f3d0]/40 blur-3xl"
          style={{ animationDelay: "-10s" }}
        />
      </div>

      {/* ===== Hero 区 ===== */}
      <div className="relative mx-auto max-w-5xl px-6 pb-24 pt-28 text-center sm:pt-36">
        {/* 小徽章：白色毛玻璃胶囊 */}
        <span className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/50 px-4 py-1.5 text-[13px] font-medium text-zinc-600 shadow-sm backdrop-blur-xl">
          <Sparkles className="h-3.5 w-3.5 text-[#8b5cf6]" />
          AI 驱动的知识库 · 基于 DeepSeek
        </span>

        {/* 大标题：深色 + 渐变关键词（移动端 34px 起步，避免 320px 溢出） */}
        <h1
          className="animate-fade-up mx-auto mt-9 max-w-4xl text-[34px] font-semibold leading-[1.1] tracking-tight text-zinc-900 sm:text-5xl lg:text-7xl"
          style={{ animationDelay: "80ms" }}
        >
          记录每一个想法，
          <br />
          让 <span className="text-gradient">AI</span> 帮你思考。
        </h1>

        <p
          className="animate-fade-up mx-auto mt-7 max-w-xl text-[17px] leading-relaxed text-zinc-500 sm:text-lg"
          style={{ animationDelay: "160ms" }}
        >
          NoteMind 是一款 AI 知识库笔记应用。写笔记、打标签、全文搜索，
          还能与你的笔记对话。
        </p>

        {/* 按钮：渐变主按钮 + 白色毛玻璃次级按钮（移动端竖排，避免溢出） */}
        <div
          className="animate-fade-up mt-11 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4"
          style={{ animationDelay: "240ms" }}
        >
          <Link
            href="/register"
            className="btn-primary w-full px-8 py-3.5 text-[15px] sm:w-auto"
          >
            免费开始使用
            <ArrowRight className="ml-1.5 inline h-4 w-4" strokeWidth={2.4} />
          </Link>
          <Link
            href="/notes"
            className="btn-secondary w-full px-8 py-3.5 text-[15px] sm:w-auto"
          >
            浏览示例
          </Link>
        </div>

        {/* 产品展示 */}
        <div
          className="animate-fade-up relative mt-24"
          style={{ animationDelay: "320ms" }}
        >
          <ProductPreview />
        </div>
      </div>

      {/* ===== 特性区 ===== */}
      <div className="relative mx-auto max-w-5xl px-6 py-28">
        <p className="text-center text-[12px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
          能力一览
        </p>
        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-3">
          {[
            {
              icon: MessageSquareText,
              title: "与笔记对话",
              desc: "DeepSeek 驱动，基于你的笔记内容回答、摘要、续写，知识库真正“活”起来。",
              color: "linear-gradient(135deg, #6366f1, #a855f7)",
              glow: "rgba(139,92,246,0.35)",
            },
            {
              icon: Search,
              title: "全文秒搜",
              desc: "基于 PostgreSQL 全文检索，标题与内容实时匹配，再多的笔记也不怕找不到。",
              color: "linear-gradient(135deg, #a855f7, #e879f9)",
              glow: "rgba(168,85,247,0.35)",
            },
            {
              icon: Tag,
              title: "标签体系",
              desc: "灵活的标签分类 + 置顶 + Markdown，像整理书架一样整理你的灵感。",
              color: "linear-gradient(135deg, #8b5cf6, #6366f1)",
              glow: "rgba(139,92,246,0.35)",
            },
          ].map((feature, i) => (
            <div
              key={feature.title}
              className="glass-card group p-8 text-left transition-all duration-200 hover:-translate-y-1.5 hover:shadow-[0_16px_48px_rgba(0,0,0,0.1)]"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-2xl shadow-lg transition-transform duration-200 group-hover:scale-110`}
                style={{
                  background: feature.color,
                  boxShadow: `0 8px 24px ${feature.glow}`,
                }}
              >
                <feature.icon className="h-5.5 w-5.5 text-white" strokeWidth={2} />
              </div>
              <h3 className="mt-6 text-[17px] font-semibold tracking-tight text-zinc-900">
                {feature.title}
              </h3>
              <p className="mt-2.5 text-[14px] leading-relaxed text-zinc-500">
                {feature.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ===== 底部 CTA ===== */}
      <div className="mx-auto max-w-5xl px-6 pb-32">
        <div className="glass-panel relative overflow-hidden p-16 text-center">
          <div className="pointer-events-none absolute -bottom-32 left-1/2 h-[300px] w-[500px] -translate-x-1/2 rounded-full bg-[#c4b5fd]/35 blur-3xl" />
          <Zap className="relative mx-auto h-9 w-9 text-[#8b5cf6]" strokeWidth={1.8} />
          <h2 className="relative mt-6 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
            开始构建你的第二大脑
          </h2>
          <p className="relative mx-auto mt-3 max-w-md text-[15px] text-zinc-500">
            免费注册，30 秒上手。让 AI 成为你思考的搭档。
          </p>
          <Link
            href="/register"
            className="btn-primary relative mt-9 inline-flex px-9 py-3.5 text-[15px]"
          >
            立即开始
            <ArrowRight className="ml-1.5 inline h-4 w-4" strokeWidth={2.4} />
          </Link>
        </div>
      </div>
    </section>
  );
}
