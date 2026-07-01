import { notFound } from "next/navigation"
import { updateFragmentAction } from "@/app/actions"
import { FragmentComposeForm } from "@/components/fragment-compose-form"
import { getFragmentPageData } from "@/lib/data/demo-store"

type EditFragmentPageProps = {
  params: Promise<{ id: string }>
}

export default async function EditFragmentPage({ params }: EditFragmentPageProps) {
  const { id } = await params
  const { fragment, schemes } = await getFragmentPageData(id)

  if (!fragment) {
    notFound()
  }

  return (
    <div className="flex min-h-[calc(100svh-6rem)] flex-col gap-5">
      <header className="shrink-0">
        <h1 className="page-title">调整碎片</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          这里专心调整内容；标题可以回到碎片札记里单独改。
        </p>
      </header>
      <FragmentComposeForm
        action={updateFragmentAction}
        fragment={fragment}
        mode="edit"
        schemes={schemes}
      />
    </div>
  )
}
