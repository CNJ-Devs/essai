import Link from "next/link"
import { createSchemeAction, deleteSchemeAction } from "@/app/actions"
import { ConfirmAction } from "@/components/confirm-action"
import { SchemeEditorDialog } from "@/components/scheme-editor-dialog"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getWorkspaceData } from "@/lib/data/demo-store"
import { formatDate, summarize } from "@/lib/utils"

export default async function SchemesPage() {
  const { schemes, laws } = await getWorkspaceData()

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="max-w-2xl text-xl font-medium leading-snug text-pretty sm:text-2xl">
            给灵感一条路，让同一种表达方式可以反复被调用。
          </h1>
        </div>
        <SchemeEditorDialog action={createSchemeAction} laws={laws} />
      </header>

      <section className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(250px,1fr))]">
        {schemes.map((scheme) => (
          <Card
            key={scheme.id}
            className="h-full min-h-48 transition-colors hover:ring-primary/25"
          >
            <CardHeader>
              <Link
                href={`/schemes/${scheme.id}`}
                className="min-w-0 rounded-md focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <CardTitle className="line-clamp-2 transition-colors hover:text-primary">
                  {scheme.name}
                </CardTitle>
              </Link>
            </CardHeader>
            <Link
              href={`/schemes/${scheme.id}`}
              className="flex flex-1 flex-col focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <CardContent className="flex-1">
                <p className="line-clamp-5 text-sm leading-6 text-muted-foreground">
                  {summarize(scheme.description, 180)}
                </p>
              </CardContent>
            </Link>
            <CardFooter className="justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                {formatDate(scheme.updatedAt)}
              </span>
              <ConfirmAction
                action={deleteSchemeAction}
                hiddenFields={{ id: scheme.id }}
                title={`删除「${scheme.name}」`}
                subtitle={`「${scheme.name}」会从方案簿中移除。已经生成的旧成稿不会受影响，但之后不能再选择这个方案。`}
                confirmLabel="删除"
                triggerSize="icon-xs"
                triggerClassName="text-muted-foreground hover:text-destructive"
              />
            </CardFooter>
          </Card>
        ))}
      </section>
    </div>
  )
}
