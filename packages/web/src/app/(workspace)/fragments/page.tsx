import Link from "next/link"
import { PlusIcon } from "lucide-react"
import { AdaptiveMasonry } from "@/components/adaptive-masonry"
import { EmptyState } from "@/components/empty-state"
import { FragmentCard } from "@/components/fragment-card"
import { buttonVariants } from "@/components/ui/button"
import { getWorkspaceData } from "@/lib/data/demo-store"
import { copy } from "@/lib/i18n"

export default async function FragmentsPage() {
  const { fragments, drafts } = await getWorkspaceData()

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="max-w-2xl text-xl font-medium leading-snug text-pretty sm:text-2xl">
            {copy.fragments.slogan}
          </h1>
        </div>
        <Link href="/fragments/new" className={buttonVariants()}>
          <PlusIcon data-icon="inline-start" aria-hidden="true" />
          {copy.fragments.createAction}
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
        <EmptyState
          title={copy.fragments.emptyTitle}
          description={copy.fragments.emptyDescription}
          className="min-h-[42svh] justify-start pt-16"
        />
      )}
    </div>
  )
}
