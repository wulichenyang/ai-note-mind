"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { NotebookPen, LogOut, User as UserIcon, Menu, X, Settings as SettingsIcon } from "lucide-react";
import { signOut } from "next-auth/react";

const links = [
  { href: "/", label: "首页" },
  { href: "/notes", label: "笔记" },
  { href: "/tags", label: "标签" },
  { href: "/chat", label: "AI 对话" },
];

type NavbarClientProps = {
  user: { name?: string | null; email?: string | null } | null;
};

// iOS 毛玻璃导航条（浅色）：半透明白 + 强模糊 + 细腻底边
export default function NavbarClient({ user }: NavbarClientProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/60 bg-white/65 backdrop-blur-2xl">
      <nav className="mx-auto flex h-12 max-w-6xl items-center justify-between px-6">
        {/* Logo：iOS 应用图标风（渐变圆角方块） */}
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="flex h-6.5 w-6.5 items-center justify-center rounded-[8px] bg-gradient-to-br from-[#6366f1] via-[#8b5cf6] to-[#a855f7] shadow-[0_2px_10px_rgba(139,92,246,0.4)] transition-shadow duration-200 group-hover:shadow-[0_4px_16px_rgba(139,92,246,0.55)]">
            <NotebookPen className="h-3.5 w-3.5 text-white" strokeWidth={2.2} />
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-zinc-900">
            NoteMind
          </span>
        </Link>

        {/* 桌面端导航链接 */}
        <div className="hidden items-center gap-8 md:flex">
          {links.map((link) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative text-[13px] transition-colors duration-150 ${
                  active ? "text-zinc-900" : "text-zinc-500 hover:text-zinc-900"
                }`}
              >
                {link.label}
                <span
                  className={`absolute -bottom-1.5 left-0 h-[2px] rounded-full bg-gradient-to-r from-[#6366f1] to-[#a855f7] transition-all duration-200 ${
                    active ? "w-full" : "w-0"
                  }`}
                />
              </Link>
            );
          })}
        </div>

        {/* 右侧：桌面端登录态 */}
        <div className="hidden items-center gap-3 md:flex">
          {user ? (
            <>
              <span className="flex items-center gap-1.5 text-[13px] font-medium text-zinc-700">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-[#6366f1] to-[#a855f7]">
                  <UserIcon className="h-3 w-3 text-white" strokeWidth={2.4} />
                </span>
                <span className="hidden max-w-[100px] truncate lg:inline">
                  {user.name ?? user.email}
                </span>
              </span>
              <Link
                href="/settings"
                className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 transition-all duration-150 hover:bg-black/5 hover:text-zinc-900 active:scale-95"
                aria-label="设置"
              >
                <SettingsIcon className="h-4 w-4" strokeWidth={2.2} />
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="flex items-center gap-1 rounded-full border border-black/[0.08] bg-white/60 px-3 py-1.5 text-[12px] font-medium text-zinc-600 transition-all duration-150 hover:bg-white hover:text-zinc-900 active:scale-95 backdrop-blur"
              >
                <LogOut className="h-3.5 w-3.5" strokeWidth={2.2} />
                退出
              </button>
            </>
          ) : (
            <Link href="/login" className="btn-primary px-4 py-1.5 text-[13px]">
              登录
            </Link>
          )}
        </div>

        {/* 移动端：汉堡按钮 */}
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-700 transition-colors hover:bg-black/5 active:scale-95 md:hidden"
          aria-label="菜单"
        >
          {menuOpen ? (
            <X className="h-5 w-5" strokeWidth={2.2} />
          ) : (
            <Menu className="h-5 w-5" strokeWidth={2.2} />
          )}
        </button>
      </nav>

      {/* 移动端下拉菜单（毛玻璃面板） */}
      {menuOpen && (
        <div className="border-t border-white/60 bg-white/80 backdrop-blur-2xl md:hidden">
          <div className="mx-auto max-w-6xl px-6 py-3">
            {links.map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center justify-between rounded-xl px-4 py-3 text-[15px] transition-colors ${
                    active
                      ? "bg-gradient-to-r from-[#6366f1]/12 to-[#a855f7]/12 font-semibold text-zinc-900"
                      : "text-zinc-700 hover:bg-black/[0.04]"
                  }`}
                >
                  {link.label}
                  {active && (
                    <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-[#6366f1] to-[#a855f7]" />
                  )}
                </Link>
              );
            })}
            <div className="mt-2 border-t border-black/[0.05] pt-3">
              {user ? (
                <div className="space-y-2 px-4 py-2">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-[13px] text-zinc-600">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-[#6366f1] to-[#a855f7]">
                        <UserIcon className="h-3 w-3 text-white" strokeWidth={2.4} />
                      </span>
                      <span className="max-w-[140px] truncate">
                        {user.name ?? user.email}
                      </span>
                    </span>
                    <button
                      onClick={() => signOut({ callbackUrl: "/" })}
                      className="flex items-center gap-1 rounded-full border border-black/[0.08] bg-white/60 px-3 py-1.5 text-[12px] font-medium text-zinc-600 active:scale-95"
                    >
                      <LogOut className="h-3.5 w-3.5" strokeWidth={2.2} />
                      退出
                    </button>
                  </div>
                  <Link
                    href="/settings"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 rounded-xl px-2 py-2 text-[14px] text-zinc-700 transition-colors hover:bg-black/[0.04]"
                  >
                    <SettingsIcon className="h-4 w-4" strokeWidth={2.2} />
                    设置（DeepSeek Key）
                  </Link>
                </div>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setMenuOpen(false)}
                  className="btn-primary mx-4 mb-2 flex items-center justify-center px-4 py-2.5 text-[14px]"
                >
                  登录
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
