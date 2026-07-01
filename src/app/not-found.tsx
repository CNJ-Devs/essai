import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
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
          <CardTitle>没有找到这一页</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          这条记录可能已经被删除，或链接不再可用。
        </CardContent>
        <CardFooter className="justify-center">
          <Link href="/fragments" className={buttonVariants()}>
            回到拾光集
          </Link>
        </CardFooter>
      </Card>
    </main>
  )
}
