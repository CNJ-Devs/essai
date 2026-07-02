import { collectFragmentAction } from "@/app/actions"
import { FragmentComposeForm } from "@/components/fragment-compose-form"
import { getWorkspaceData } from "@/lib/data/demo-store"
import { copy } from "@/lib/i18n"

export default async function NewFragmentPage() {
  const { schemes } = await getWorkspaceData()

  return (
    <div className="flex min-h-[calc(100svh-6rem)] flex-col gap-5">
      <header className="shrink-0">
        <h1 className="page-title">{copy.fragments.createTitle}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {copy.fragments.createSubtitle}
        </p>
      </header>
      <FragmentComposeForm
        action={collectFragmentAction}
        mode="create"
        schemes={schemes}
      />
    </div>
  )
}
