"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";

export interface StepperLabels {
  decrease: string;
  increase: string;
  remove: string;
  quantity: string;
}

export interface QuantityStepperProps {
  value: number;
  min?: number;
  max?: number | null;
  onChange: (quantity: number) => void;
  labels: StepperLabels;
  /**
   * At the minimum, minus becomes "remove" and calls `onChange(0)`. Switch
   * it off where a separate remove button exists: minus then stops at the
   * minimum.
   */
  removeAtMin?: boolean;
  /** `xs`: the slim one of a cart line. */
  size?: "xs" | "sm" | "md";
  /**
   * `solid`: the leaf pill that takes the place of "Add to cart".
   * `outline`: a slim white pill with a hairline, for a line of the cart
   * where the number is one fact among others (owner, 2026-10-22).
   */
  look?: "solid" | "outline";
  className?: string;
}

const BUTTON_SIZE = { xs: "size-7", sm: "size-8", md: "size-9" } as const;

/** Minus, the number, plus. */
export function QuantityStepper({
  value,
  min = 1,
  max = null,
  onChange,
  labels,
  removeAtMin = true,
  size = "md",
  look = "solid",
  className,
}: QuantityStepperProps) {
  const atMin = value <= min;
  const atMax = max !== null && value >= max;
  const removes = atMin && removeAtMin;
  const outline = look === "outline";
  const button = cn(
    "grid shrink-0 place-items-center rounded-full transition-[background-color,color,transform] duration-150 active:scale-90 disabled:hover:bg-transparent disabled:active:scale-100",
    // Inside the pill, with a hair of the pill's colour around each button.
    "m-0.5",
    BUTTON_SIZE[size],
    outline
      ? "text-ink-muted hover:bg-mist hover:text-ink disabled:text-ink-subtle/50"
      : "text-white hover:bg-white/20 disabled:text-white/45",
  );
  const icon = size === "xs" ? "size-3.5" : "size-4";
  return (
    <div
      role="group"
      aria-label={labels.quantity}
      className={cn(
        "inline-flex w-full items-center justify-between rounded-full font-bold",
        outline
          ? "border-line-strong text-ink border-[1.5px] bg-white"
          : "bg-leaf-600 text-white",
        className,
      )}
    >
      <button
        type="button"
        className={button}
        aria-label={removes ? labels.remove : labels.decrease}
        disabled={atMin && !removeAtMin}
        onClick={() => onChange(removes ? 0 : value - 1)}
      >
        {removes ? (
          <Trash2 aria-hidden="true" className={icon} />
        ) : (
          <Minus aria-hidden="true" className={icon} />
        )}
      </button>
      <span
        aria-live="polite"
        className={cn(
          "text-center tabular-nums",
          size === "xs" ? "min-w-7 text-[0.9375rem]" : "min-w-8",
        )}
      >
        {/* Mounted afresh on every change, so the number pops each time. */}
        <span key={value} className="animate-count-pop inline-block">
          {value}
        </span>
      </span>
      <button
        type="button"
        className={button}
        aria-label={labels.increase}
        disabled={atMax}
        onClick={() => onChange(value + 1)}
      >
        <Plus aria-hidden="true" className={icon} />
      </button>
    </div>
  );
}
