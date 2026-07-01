import { collectFragmentAction } from "@/app/actions"
import { FragmentComposeForm } from "@/components/fragment-compose-form"
import { getWorkspaceData } from "@/lib/data/demo-store"

export default async function NewFragmentPage() {
  const { schemes } = await getWorkspaceData()

  return (
    <div className="flex min-h-[calc(100svh-6rem)] flex-col gap-5">
      <header className="shrink-0">
        <h1 className="page-title">收集碎片</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          只管把一闪而过的内容放进来，标题会在收集后自己长出来。
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
