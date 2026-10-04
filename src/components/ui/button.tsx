import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "./spinner";

export type ButtonVariant =
  "primary" | "secondary" | "quiet" | "gold" | "ghost" | "pay" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-blue-600 text-white hover:bg-blue-700",
  secondary: "border-blue-600 bg-white text-blue-700 hover:bg-blue-50",
  quiet: "px-3 text-blue-700 underline underline-offset-4 hover:bg-blue-50",
  // On the dark bands only.
  gold: "bg-gold-300 text-blue-900 hover:bg-gold-400",
  ghost: "border-white/45 text-white hover:bg-white/10",
  // Paying is good news: teal, not the blue of ordering.
  pay: "bg-teal-600 text-white hover:bg-teal-700",
  danger: "border-red-600 bg-white text-red-600 hover:bg-red-50",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "min-h-11 px-4 text-[0.9375rem]",
  md: "min-h-12 px-5 text-base",
  lg: "min-h-14 px-6 text-[1.0625rem]",
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
    "inline-flex items-center justify-center gap-2 rounded-md border-[1.5px] border-transparent text-center leading-tight font-bold transition-colors duration-150 select-none active:translate-y-px",
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
