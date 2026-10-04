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
    "grid shrink-0 place-items-center rounded-sm text-blue-800 hover:bg-blue-100 disabled:text-ink-subtle disabled:hover:bg-transparent",
    size === "sm" ? "size-9" : "size-11",
  );
  return (
    <div
      role="group"
      aria-label={labels.quantity}
      className={cn(
        "inline-flex w-full items-center justify-between rounded-md border-[1.5px] border-blue-600 bg-blue-50 font-bold text-blue-800",
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
        {value}
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
