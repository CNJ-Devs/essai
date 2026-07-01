import Link from "next/link"
import { PlusIcon } from "lucide-react"
import { AdaptiveMasonry } from "@/components/adaptive-masonry"
import { FragmentCard } from "@/components/fragment-card"
import { buttonVariants } from "@/components/ui/button"
import { getWorkspaceData } from "@/lib/data/demo-store"

export default async function FragmentsPage() {
  const { fragments, drafts } = await getWorkspaceData()

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="max-w-2xl text-xl font-medium leading-snug text-pretty sm:text-2xl">
            灵光乍现，也有去处。
          </h1>
        </div>
        <Link href="/fragments/new" className={buttonVariants()}>
          <PlusIcon data-icon="inline-start" aria-hidden="true" />
          收集碎片
        </Link>
      </header>

      {fragments.length > 0 ? (
        <AdaptiveMasonry minColumnWidth={172}>
          {fragments.map((fragment) => (
            <div key={fragment.id} className="masonry-item">
              <FragmentCard
                fragment={fragment}
                drafts={drafts.filter((draft) => draft.fragmentId === fragment.id)}
              />
            </div>
          ))}
        </AdaptiveMasonry>
      ) : (
        <div className="rounded-2xl border bg-card p-10 text-center">
          <h2 className="font-heading text-lg font-medium">还没有碎片</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            先收住一个念头，再让它慢慢长成稿。
          </p>
        </div>
      )}
    </div>
  )
}
