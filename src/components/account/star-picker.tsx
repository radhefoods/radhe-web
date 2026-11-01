"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * One to five stars to choose from: five radio buttons drawn as stars, so
 * the arrow keys move between them and a screen reader hears "3 stars".
 */
export function StarPicker({
  name,
  legend,
  value,
  onChange,
  labelOf,
  error,
}: {
  name: string;
  legend: string;
  value: number | null;
  onChange: (value: number) => void;
  /** The spoken label of a star: "3 stars". */
  labelOf: (value: number) => string;
  error?: string | null;
}) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="text-sm font-semibold">{legend}</legend>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => {
          const filled = value !== null && star <= value;
          return (
            <label
              key={star}
              className="ease-glass has-focus-visible:outline-leaf-600 relative grid size-11 cursor-pointer place-items-center rounded-full transition-[background-color,transform] duration-150 hover:bg-white/70 active:scale-95 has-focus-visible:outline-2 has-focus-visible:outline-offset-1"
            >
              <input
                type="radio"
                name={name}
                value={star}
                checked={value === star}
                onChange={() => onChange(star)}
                aria-label={labelOf(star)}
                // Over the star, unseen: the tap and the focus land on it.
                className="absolute inset-0 size-full cursor-pointer opacity-0"
              />
              <Star
                aria-hidden="true"
                className={cn(
                  "size-7 transition-colors duration-150",
                  filled ? "text-wheat-800 fill-current" : "text-ink/20",
                )}
                strokeWidth={filled ? 0 : 1.5}
              />
            </label>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="text-sm font-semibold text-red-800">
          {error}
        </p>
      )}
    </fieldset>
  );
}
