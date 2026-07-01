"use client";

import {
  LoaderCircle,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  WandSparkles,
} from "lucide-react";
import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";

const iconMap = {
  plus: Plus,
  refresh: RefreshCw,
  save: Save,
  sparkles: Sparkles,
  trash: Trash2,
  wand: WandSparkles,
};

type FormSubmitButtonProps = {
  children: React.ReactNode;
  icon?: keyof typeof iconMap;
  variant?: "primary" | "secondary" | "danger";
  className?: string;
  title?: string;
};

export function FormSubmitButton({
  children,
  icon,
  variant = "primary",
  className,
  title,
}: FormSubmitButtonProps) {
  const { pending } = useFormStatus();
  const Icon = icon ? iconMap[icon] : null;

  return (
    <button
      type="submit"
      disabled={pending}
      title={title}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        variant === "primary" &&
          "bg-[var(--ink)] text-white hover:bg-[var(--ink-2)]",
        variant === "secondary" &&
          "border border-[var(--line)] bg-white text-[var(--ink)] hover:bg-[var(--soft)]",
        variant === "danger" &&
          "bg-[var(--danger)] text-white hover:bg-[var(--danger-2)]",
        className,
      )}
    >
      {pending ? (
        <LoaderCircle className="animate-spin" size={17} aria-hidden="true" />
      ) : Icon ? (
        <Icon size={17} aria-hidden="true" />
      ) : null}
      <span>{pending ? "处理中" : children}</span>
    </button>
  );
}
