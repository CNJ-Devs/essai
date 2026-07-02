import type { ComponentProps } from "react"
import type { LucideIcon } from "lucide-react"
import { Trash2Icon } from "lucide-react"
import { copy } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogBody,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

type ButtonProps = ComponentProps<typeof Button>

export function ConfirmAction({
  action,
  hiddenFields,
  title,
  subtitle,
  confirmLabel,
  cancelLabel = copy.action.cancel,
  icon: Icon = Trash2Icon,
  triggerVariant = "ghost",
  triggerSize = "icon",
  triggerClassName,
}: {
  action: (formData: FormData) => void
  hiddenFields: Record<string, string>
  title: string
  subtitle: string
  confirmLabel: string
  cancelLabel?: string
  icon?: LucideIcon
  triggerVariant?: ButtonProps["variant"]
  triggerSize?: ButtonProps["size"]
  triggerClassName?: string
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant={triggerVariant}
            size={triggerSize}
            aria-label={title}
            className={triggerClassName}
          />
        }
      >
        <Icon aria-hidden="true" />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogBody>
          <AlertDialogDescription>{subtitle}</AlertDialogDescription>
        </AlertDialogBody>
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
          <form action={action}>
            {Object.entries(hiddenFields).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}
            <AlertDialogAction type="submit" variant="destructive">
              {confirmLabel}
            </AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
