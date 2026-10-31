import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "./spinner";

export type ButtonVariant =
  "primary" | "secondary" | "quiet" | "wheat" | "ghost" | "pay" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

/*
 * Liquid-glass controls (2026-10-31): the primary is leaf, lit from above
 * and with a soft green glow that deepens on hover; the secondary is a
 * frosted white pill with the leaf word on it; quiet is text alone; wheat
 * and ghost stand on the dark band; pay is the deeper leaf; danger is a
 * white pill with a red word.
 */
const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "leaf-gradient text-white shadow-leaf hover:shadow-leaf-lg hover:brightness-[1.04]",
  secondary:
    "glass text-leaf-700 hover:bg-white/85 hover:text-leaf-800 hover:shadow-lift",
  quiet: "px-3 text-leaf-700 hover:bg-leaf-50/80",
  // The one action on a dark band: the highlight, with dark text.
  wheat:
    "bg-wheat-400 text-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.5)] hover:bg-wheat-500",
  ghost:
    "border-white/40 bg-white/10 text-white backdrop-blur-md hover:border-white/70 hover:bg-white/20",
  // Paying is good news: the deeper leaf, not the leaf of ordering.
  pay: "leaf-gradient-deep text-white shadow-leaf hover:shadow-leaf-lg hover:brightness-[1.04]",
  danger: "glass text-red-600 hover:bg-red-50/90",
};

/* Pills need a little more room at the sides than a box did. */
const SIZES: Record<ButtonSize, string> = {
  sm: "min-h-11 px-5 text-[0.9375rem]",
  md: "min-h-12 px-6 text-[0.9375rem]",
  lg: "min-h-13 px-7 text-base",
};

export interface ButtonStyleOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Full width of its container. */
  block?: boolean;
  className?: string;
}

/** The classes of a button, for links that should look like one. */
export function buttonStyles({
  variant = "primary",
  size = "md",
  block = false,
  className,
}: ButtonStyleOptions = {}): string {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-full border-[1.5px] border-transparent text-center leading-tight font-semibold transition-[background-color,border-color,color,box-shadow,transform,filter] duration-200 ease-[var(--ease-glass)] select-none active:scale-[0.98]",
    "disabled:cursor-not-allowed disabled:border-transparent disabled:bg-cloud disabled:bg-none disabled:text-ink-subtle disabled:shadow-none disabled:brightness-100 disabled:active:scale-100",
    "aria-disabled:cursor-not-allowed aria-disabled:border-transparent aria-disabled:bg-cloud aria-disabled:bg-none aria-disabled:text-ink-subtle aria-disabled:shadow-none",
    SIZES[size],
    VARIANTS[variant],
    block && "w-full",
    className,
  );
}

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, ButtonStyleOptions {
  /** Shows a spinner and blocks further clicks. */
  loading?: boolean;
  children: ReactNode;
}

export function Button({
  variant,
  size,
  block,
  loading = false,
  className,
  children,
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonStyles({ variant, size, block, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  );
}
