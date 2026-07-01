"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpenText,
  FileText,
  LibraryBig,
  ScrollText,
  Sparkles,
} from "lucide-react";
import { zhCN } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const navItems = [
  {
    href: "/fragments",
    label: zhCN.nav.fragments,
    icon: FileText,
  },
  {
    href: "/schemes",
    label: zhCN.nav.schemes,
    icon: LibraryBig,
  },
  {
    href: "/laws",
    label: zhCN.nav.laws,
    icon: BookOpenText,
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[var(--ink)]">
      <div className="mx-auto flex min-h-screen w-full max-w-[1440px] flex-col lg:flex-row">
        <aside className="border-b border-[var(--line)] bg-[var(--panel)] px-4 py-3 lg:sticky lg:top-0 lg:h-screen lg:w-72 lg:border-b-0 lg:border-r lg:px-5 lg:py-6">
          <Link
            href="/fragments"
            className="flex items-center gap-3 rounded-md px-2 py-2"
            title="EssAI"
          >
            <span className="flex size-10 items-center justify-center rounded-md bg-[var(--ink)] text-white">
              <Sparkles size={20} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-lg font-semibold">EssAI</span>
              <span className="block text-sm text-[var(--muted)]">
                灵光乍现，也有去处。
              </span>
            </span>
          </Link>

          <nav className="mt-4 flex gap-2 overflow-x-auto lg:mt-8 lg:flex-col lg:overflow-visible">
            {navItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex min-h-11 shrink-0 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
                    active
                      ? "bg-[var(--ink)] text-white"
                      : "text-[var(--muted)] hover:bg-[var(--soft)] hover:text-[var(--ink)]",
                  )}
                  title={item.label}
                >
                  <Icon size={18} aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-8 hidden rounded-md border border-[var(--line)] bg-[var(--soft)] p-4 text-sm text-[var(--muted)] lg:block">
            <div className="mb-2 flex items-center gap-2 font-medium text-[var(--ink)]">
              <ScrollText size={16} aria-hidden="true" />
              <span>第一阶段</span>
            </div>
            <p>碎片、出稿方案、创作法则、成稿卷和稿次历史。</p>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <main className="w-full px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
