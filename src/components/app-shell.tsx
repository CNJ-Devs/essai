"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  ArrowLeftIcon,
  BookOpenTextIcon,
  FileTextIcon,
  LibraryBigIcon,
  SparklesIcon,
} from "lucide-react"
import { copy } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const navItems = [
  {
    href: "/fragments",
    label: copy.nav.fragments,
    icon: FileTextIcon,
  },
  {
    href: "/schemes",
    label: copy.nav.schemes,
    icon: LibraryBigIcon,
  },
  {
    href: "/laws",
    label: copy.nav.laws,
    icon: BookOpenTextIcon,
  },
]

const primaryPages = new Set(["/fragments", "/schemes", "/laws"])

function getPageLabel(pathname: string) {
  if (pathname.startsWith("/fragments/new")) return copy.page.collectFragment
  if (pathname.endsWith("/edit") && pathname.startsWith("/fragments/")) {
    return copy.page.editFragment
  }
  if (pathname.startsWith("/fragments/")) return copy.page.fragmentDetail
  if (pathname.startsWith("/drafts/")) return copy.page.draftDetail
  if (pathname.startsWith("/schemes/")) return copy.page.schemeDetail
  if (pathname.startsWith("/laws/")) return copy.page.lawDetail
  return "EssAI"
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const isPrimaryPage = primaryPages.has(pathname)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        {copy.accessibility.skipToMain}
      </a>
      <div
        className={cn(
          "mx-auto min-h-screen w-full",
          isPrimaryPage &&
            "grid grid-cols-[64px_minmax(0,1fr)] transition-[grid-template-columns] duration-200 ease-out lg:grid-cols-[232px_minmax(0,1fr)] xl:grid-cols-[256px_minmax(0,1fr)]",
        )}
      >
        {isPrimaryPage ? <Sidebar pathname={pathname} /> : null}
        <div className="flex min-w-0 flex-col">
          <TopBar
            isPrimaryPage={isPrimaryPage}
            pageLabel={getPageLabel(pathname)}
            onBack={() => router.back()}
          />
          <main
            id="main-content"
            className={cn(
              "mx-auto w-full min-w-0 px-4 py-5 sm:px-6 lg:px-8",
              isPrimaryPage ? "max-w-[1600px]" : "max-w-6xl",
            )}
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}

function Sidebar({ pathname }: { pathname: string }) {
  return (
    <aside className="sticky top-0 flex h-screen flex-col border-r border-border/70 bg-sidebar text-sidebar-foreground">
      <Link
        href="/fragments"
        className="flex min-h-16 items-center justify-center px-0 transition-[padding] duration-200 ease-out focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 lg:justify-start lg:gap-3 lg:px-5"
        translate="no"
        aria-label="EssAI"
      >
        <span className="flex size-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
          <SparklesIcon aria-hidden="true" />
        </span>
        <span className="max-w-0 overflow-hidden whitespace-nowrap font-heading text-lg font-semibold opacity-0 transition-[max-width,opacity] duration-200 ease-out lg:max-w-32 lg:opacity-100">
          EssAI
        </span>
      </Link>
      <nav className="flex flex-col gap-1 p-2 transition-[padding] duration-200 ease-out lg:p-3">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
          const Icon = item.icon

          return (
            <Tooltip key={item.href}>
              <TooltipTrigger
                render={
                  <Link
                    href={item.href}
                    aria-label={item.label}
                    className={cn(
                      "flex min-h-10 items-center justify-center rounded-lg px-0 text-sm font-medium transition-[background-color,color,padding] duration-200 ease-out hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 lg:justify-start lg:gap-3 lg:px-3",
                      active
                        ? "bg-sidebar-primary text-sidebar-primary-foreground"
                        : "text-muted-foreground",
                    )}
                  />
                }
              >
                <Icon aria-hidden="true" />
                <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-[max-width,opacity] duration-200 ease-out lg:max-w-32 lg:opacity-100">
                  {item.label}
                </span>
              </TooltipTrigger>
              <TooltipContent
                side="inline-end"
                sideOffset={10}
                className="bg-popover text-popover-foreground shadow-md ring-1 ring-border lg:hidden"
              >
                {item.label}
              </TooltipContent>
            </Tooltip>
          )
        })}
      </nav>
    </aside>
  )
}

function TopBar({
  isPrimaryPage,
  pageLabel,
  onBack,
}: {
  isPrimaryPage: boolean
  pageLabel: string
  onBack: () => void
}) {
  return (
    <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
      <div
        className={cn(
          "mx-auto flex h-14 w-full max-w-[1600px] items-center gap-3 px-4 sm:px-6 lg:px-8",
          isPrimaryPage ? "justify-end" : "justify-between",
        )}
      >
        {isPrimaryPage ? null : (
          <div className="flex min-w-0 items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={copy.accessibility.back}
              onClick={onBack}
            >
              <ArrowLeftIcon aria-hidden="true" />
            </Button>
            <span className="truncate text-sm font-medium text-muted-foreground">
              {pageLabel}
            </span>
          </div>
        )}

        <div className="flex shrink-0 items-center gap-2">
          <div className="text-right text-sm">
            <div className="font-medium">Jiahao</div>
          </div>
          <Avatar>
            <AvatarFallback>JZ</AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  )
}
