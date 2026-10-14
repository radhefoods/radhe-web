import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "./spinner";

export type ButtonVariant =
  "primary" | "secondary" | "quiet" | "lime" | "ghost" | "pay" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-leaf-600 text-white hover:bg-leaf-700",
  secondary:
    "border-line-strong bg-white text-leaf-700 hover:border-leaf-600 hover:bg-leaf-50",
  quiet: "px-3 text-leaf-700 hover:bg-leaf-50",
  // The one action on a dark band: the highlight, with dark text.
  lime: "bg-lime-400 text-ink hover:bg-lime-500",
  ghost: "border-white/50 text-white hover:border-white/80 hover:bg-white/10",
  // Paying is good news: the deeper leaf, not the leaf of ordering.
  pay: "bg-leaf-700 text-white hover:bg-leaf-800",
  danger: "border-red-600 bg-white text-red-600 hover:bg-red-50",
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
    "inline-flex items-center justify-center gap-2 rounded-full border-[1.5px] border-transparent text-center leading-tight font-bold transition-colors duration-150 select-none active:translate-y-px",
    "disabled:cursor-not-allowed disabled:border-line disabled:bg-cloud disabled:text-ink-subtle disabled:active:translate-y-0",
    "aria-disabled:cursor-not-allowed aria-disabled:border-line aria-disabled:bg-cloud aria-disabled:text-ink-subtle",
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
