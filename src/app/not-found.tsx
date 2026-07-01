import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--app-bg)] p-6">
      <div className="card max-w-md p-6 text-center">
        <h1 className="text-2xl font-semibold">没有找到这一页</h1>
        <p className="mt-3 text-sm text-[var(--muted)]">
          这条记录可能已经被删除，或链接不再可用。
        </p>
        <Link
          href="/fragments"
          className="mt-5 inline-flex min-h-11 items-center rounded-md bg-[var(--ink)] px-4 text-sm font-semibold text-white"
        >
          回到拾光集
        </Link>
      </div>
    </main>
  );
}
