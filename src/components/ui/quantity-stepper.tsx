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
  size?: "sm" | "md";
  className?: string;
}

/** Minus, the number, plus. */
export function QuantityStepper({
  value,
  min = 1,
  max = null,
  onChange,
  labels,
  removeAtMin = true,
  size = "md",
  className,
}: QuantityStepperProps) {
  const atMin = value <= min;
  const atMax = max !== null && value >= max;
  const removes = atMin && removeAtMin;
  const button = cn(
    "grid shrink-0 place-items-center rounded-full text-white hover:bg-white/20 disabled:text-white/45 disabled:hover:bg-transparent",
    // Inside the pill, with a hair of green around each button.
    "m-0.5",
    size === "sm" ? "size-8" : "size-9",
  );
  return (
    <div
      role="group"
      aria-label={labels.quantity}
      className={cn(
        "bg-leaf-600 inline-flex w-full items-center justify-between rounded-full font-bold text-white",
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
          <Trash2 aria-hidden="true" className="size-4" />
        ) : (
          <Minus aria-hidden="true" className="size-4" />
        )}
      </button>
      <span aria-live="polite" className="min-w-8 text-center tabular-nums">
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
        <Plus aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}
