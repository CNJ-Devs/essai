"use client"

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PencilIcon,
  PlusIcon,
  SaveIcon,
} from "lucide-react"
import {
  createLawFromSchemeDialogAction,
} from "@/app/actions"
import { copy } from "@/lib/i18n"
import type { Law, Scheme } from "@/lib/types"
import { cn, summarize } from "@/lib/utils"
import { EmptyState } from "@/components/empty-state"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

function mergeLaws(primary: Law[], secondary: Law[]) {
  const seen = new Set<string>()

  return [...primary, ...secondary].filter((law) => {
    if (seen.has(law.id)) {
      return false
    }

    seen.add(law.id)
    return true
  })
}

export function SchemeEditorDialog({
  action,
  laws,
  scheme,
}: {
  action: (formData: FormData) => void
  laws: Law[]
  scheme?: Scheme
}) {
  const [open, setOpen] = useState(false)
  const [availableLaws, setAvailableLaws] = useState(laws)
  const schemeLawIds = useMemo(() => scheme?.lawIds ?? [], [scheme?.lawIds])
  const [selectedLawIds, setSelectedLawIds] = useState<string[]>(schemeLawIds)
  const [newLawName, setNewLawName] = useState("")
  const [newLawPrompt, setNewLawPrompt] = useState("")
  const [newLawTags, setNewLawTags] = useState("")
  const [newLawError, setNewLawError] = useState<string | null>(null)
  const [isCreatingLaw, startCreateLawTransition] = useTransition()
  const isEdit = Boolean(scheme)

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setOpen(false)
      return
    }

    setAvailableLaws((current) => mergeLaws(current, laws))
    setSelectedLawIds(schemeLawIds)
    setNewLawName("")
    setNewLawPrompt("")
    setNewLawTags("")
    setNewLawError(null)
    setOpen(true)
  }

  function setLawSelected(lawId: string, checked: boolean) {
    setSelectedLawIds((current) => {
      if (!checked) {
        return current.filter((id) => id !== lawId)
      }

      return current.includes(lawId) ? current : [...current, lawId]
    })
  }

  function handleCreateLaw() {
    const name = newLawName.trim()
    const prompt = newLawPrompt.trim()

    if (!name || !prompt) {
      setNewLawError(copy.schemes.quickLawMissingError)
      return
    }

    setNewLawError(null)
    startCreateLawTransition(() => {
      void createLawFromSchemeDialogAction({
        name,
        prompt,
        tags: newLawTags,
      })
        .then((law) => {
          setAvailableLaws((current) => mergeLaws([law], current))
          setSelectedLawIds((current) =>
            current.includes(law.id)
              ? current
              : [law.id, ...current]
          )
          setNewLawName("")
          setNewLawPrompt("")
          setNewLawTags("")
        })
        .catch(() => {
          setNewLawError(copy.schemes.quickLawFailedError)
        })
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant={isEdit ? "outline" : "default"} />}>
        {isEdit ? (
          <PencilIcon data-icon="inline-start" aria-hidden="true" />
        ) : (
          <PlusIcon data-icon="inline-start" aria-hidden="true" />
        )}
        {isEdit ? copy.schemes.editTrigger : copy.schemes.createTrigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? copy.schemes.editTitle : copy.schemes.createTitle}
          </DialogTitle>
          <DialogDescription>{copy.schemes.editorDescription}</DialogDescription>
        </DialogHeader>
        <form action={action} className="contents">
          {scheme ? <input type="hidden" name="id" value={scheme.id} /> : null}
          {selectedLawIds.map((lawId, index) => (
            <Fragment key={lawId}>
              <input type="hidden" name="lawId" value={lawId} />
              <input type="hidden" name={`order_${lawId}`} value={index} />
            </Fragment>
          ))}
          <DialogBody>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="scheme-name">{copy.schemes.nameLabel}</FieldLabel>
                <Input
                  id="scheme-name"
                  name="name"
                  autoComplete="off"
                  placeholder={copy.schemes.namePlaceholder}
                  defaultValue={scheme?.name}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="scheme-description">
                  {copy.schemes.descriptionLabel}
                </FieldLabel>
                <Textarea
                  id="scheme-description"
                  name="description"
                  autoComplete="off"
                  placeholder={copy.schemes.descriptionPlaceholder}
                  defaultValue={scheme?.description}
                  className="min-h-44"
                  required
                />
              </Field>
              <FieldSet>
                <FieldTitle>{copy.schemes.lawsTitle}</FieldTitle>
                <FieldDescription>{copy.schemes.lawsDescription}</FieldDescription>
                <LawPickerScroller
                  laws={availableLaws}
                  selectedLawIds={selectedLawIds}
                  onLawSelected={setLawSelected}
                />
              </FieldSet>
              <FieldSet className="gap-3 rounded-2xl border bg-muted/35 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <FieldTitle>{copy.schemes.quickLawTitle}</FieldTitle>
                    <FieldDescription>
                      {copy.schemes.quickLawDescription}
                    </FieldDescription>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    disabled={
                      isCreatingLaw ||
                      !newLawName.trim() ||
                      !newLawPrompt.trim()
                    }
                    onClick={handleCreateLaw}
                  >
                    <PlusIcon data-icon="inline-start" aria-hidden="true" />
                    {isCreatingLaw
                      ? copy.schemes.quickLawCollecting
                      : copy.schemes.quickLawCollect}
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_14rem]">
                  <Field>
                    <FieldLabel htmlFor="new-law-name">
                      {copy.schemes.quickLawNameLabel}
                    </FieldLabel>
                    <Input
                      id="new-law-name"
                      value={newLawName}
                      onChange={(event) => setNewLawName(event.target.value)}
                      autoComplete="off"
                      placeholder={copy.schemes.quickLawNamePlaceholder}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="new-law-tags">
                      {copy.schemes.quickLawTagsLabel}
                    </FieldLabel>
                    <Input
                      id="new-law-tags"
                      value={newLawTags}
                      onChange={(event) => setNewLawTags(event.target.value)}
                      autoComplete="off"
                      placeholder={copy.schemes.quickLawTagsPlaceholder}
                    />
                  </Field>
                </div>
                <Field>
                  <FieldLabel htmlFor="new-law-prompt">
                    {copy.schemes.quickLawPromptLabel}
                  </FieldLabel>
                  <Textarea
                    id="new-law-prompt"
                    value={newLawPrompt}
                    onChange={(event) => setNewLawPrompt(event.target.value)}
                    autoComplete="off"
                    placeholder={copy.schemes.quickLawPromptPlaceholder}
                    className="min-h-24"
                  />
                  {newLawError ? (
                    <FieldDescription className="text-destructive">
                      {newLawError}
                    </FieldDescription>
                  ) : null}
                </Field>
              </FieldSet>
            </FieldGroup>
          </DialogBody>
          <DialogFooter>
            <Button type="submit">
              <SaveIcon data-icon="inline-start" aria-hidden="true" />
              {isEdit ? copy.schemes.editSubmit : copy.schemes.createSubmit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function LawPickerScroller({
  laws,
  selectedLawIds,
  onLawSelected,
}: {
  laws: Law[]
  selectedLawIds: string[]
  onLawSelected: (lawId: string, checked: boolean) => void
}) {
  const [scrollState, setScrollState] = useState({
    canScrollLeft: false,
    canScrollRight: false,
  })
  const scrollerRef = useRef<HTMLDivElement>(null)

  const getScrollState = useCallback((node: HTMLDivElement, scrollLeft: number) => {
    const maxScrollLeft = node.scrollWidth - node.clientWidth
    const threshold = 2

    return {
      canScrollLeft: scrollLeft > threshold,
      canScrollRight: maxScrollLeft - scrollLeft > threshold,
    }
  }, [])

  const updateScrollState = useCallback(() => {
    const node = scrollerRef.current

    if (!node) return

    setScrollState(getScrollState(node, node.scrollLeft))
  }, [getScrollState])

  const handleScroll = useCallback(() => {
    const node = scrollerRef.current

    if (!node) return

    setScrollState(getScrollState(node, node.scrollLeft))
  }, [getScrollState])

  useEffect(() => {
    const node = scrollerRef.current

    if (!node) return

    updateScrollState()

    const resizeObserver = new ResizeObserver(updateScrollState)

    resizeObserver.observe(node)
    if (node.firstElementChild) {
      resizeObserver.observe(node.firstElementChild)
    }

    node.addEventListener("scroll", handleScroll, { passive: true })

    return () => {
      resizeObserver.disconnect()
      node.removeEventListener("scroll", handleScroll)
    }
  }, [handleScroll, laws.length, updateScrollState])

  function scrollByPage(direction: "left" | "right") {
    const node = scrollerRef.current
    if (!node) return

    const maxScrollLeft = Math.max(0, node.scrollWidth - node.clientWidth)
    const pageWidth = node.clientWidth * 0.75
    const nextScrollLeft = Math.min(
      maxScrollLeft,
      Math.max(0, node.scrollLeft + (direction === "right" ? pageWidth : -pageWidth)),
    )

    setScrollState(getScrollState(node, nextScrollLeft))

    node.scrollTo({
      left: nextScrollLeft,
      behavior: "smooth",
    })
  }

  if (laws.length === 0) {
    return (
      <div className="relative min-w-0 max-w-full overflow-hidden bg-transparent">
        <EmptyState
          title={copy.schemes.noSelectableLawsTitle}
          description={copy.schemes.noSelectableLawsDescription}
          className="h-[13.5rem] rounded-xl border border-dashed bg-card/60 p-5"
        />
      </div>
    )
  }

  return (
    <div className="relative min-w-0 max-w-full overflow-hidden bg-transparent">
      {scrollState.canScrollLeft ? (
        <Button
          type="button"
          variant="secondary"
          size="icon"
          aria-label={copy.accessibility.scrollLawsLeft}
          className="absolute left-2 top-1/2 z-[1] -translate-y-1/2 shadow-sm"
          onClick={() => scrollByPage("left")}
        >
          <ChevronLeftIcon aria-hidden="true" />
        </Button>
      ) : null}
      <div
        ref={scrollerRef}
        className="scroll-fade-x grid h-[13.5rem] w-full min-w-0 auto-cols-[minmax(17rem,40%)] grid-flow-col grid-rows-[6.25rem_6.25rem] gap-3 overflow-x-auto pb-1"
      >
        {laws.map((law) => {
          const isSelected = selectedLawIds.includes(law.id)

          return (
            <FieldLabel
              key={law.id}
              htmlFor={`scheme-law-${law.id}`}
              className={cn(
                "h-[6.25rem] cursor-pointer rounded-xl border bg-card transition-colors",
                isSelected ? "border-primary" : "border-border",
              )}
            >
              <Field
                orientation="horizontal"
                className="h-full min-w-0 items-start overflow-hidden"
              >
                <Checkbox
                  id={`scheme-law-${law.id}`}
                  checked={isSelected}
                  onCheckedChange={(checked) =>
                    onLawSelected(law.id, checked === true)
                  }
                />
                <FieldContent className="min-w-0 overflow-hidden">
                  <span className="line-clamp-1 max-w-full break-all text-sm font-medium leading-snug">
                    {law.name}
                  </span>
                  <span className="line-clamp-3 max-w-full break-words text-xs leading-4 text-muted-foreground">
                    {summarize(law.prompt, 120)}
                  </span>
                </FieldContent>
              </Field>
            </FieldLabel>
          )
        })}
      </div>
      {scrollState.canScrollRight ? (
        <Button
          type="button"
          variant="secondary"
          size="icon"
          aria-label={copy.accessibility.scrollLawsRight}
          className="absolute right-2 top-1/2 z-[1] -translate-y-1/2 shadow-sm"
          onClick={() => scrollByPage("right")}
        >
          <ChevronRightIcon aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  )
}
