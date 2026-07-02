import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { copy } from "@/lib/i18n"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="max-w-md text-center">
        <CardHeader>
          <CardTitle>{copy.notFound.title}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {copy.notFound.description}
        </CardContent>
        <CardFooter className="justify-center">
          <Link href="/fragments" className={buttonVariants()}>
            {copy.notFound.action}
          </Link>
        </CardFooter>
      </Card>
    </main>
  )
}
