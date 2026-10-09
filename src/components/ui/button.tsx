import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-paper border-ink hover:bg-ink/85",
  secondary: "bg-paper text-ink border-line hover:border-ink",
  ghost: "bg-transparent text-ink border-transparent hover:bg-surface",
  danger: "bg-critical text-paper border-critical hover:bg-critical/85",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-sm",
};

type ButtonProps = ComponentProps<"button"> & { variant?: Variant; size?: Size };

/** Classes do botão, também para links que se apresentam como botão. */
export function buttonClasses({ variant = "primary", size = "md" }: { variant?: Variant; size?: Size } = {}) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] border font-semibold",
    "transition-colors duration-150 ease-[var(--ease-brand)] disabled:pointer-events-none disabled:opacity-40",
    variants[variant],
    sizes[size],
  );
}

export function Button({ variant = "primary", size = "md", className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={cn(buttonClasses({ variant, size }), className)} {...props} />;
}
