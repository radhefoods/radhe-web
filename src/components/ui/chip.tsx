import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * leaf: confirmed, in progress. forest: on its way. wheat: needs attention
 * (preparing, payment due). green: a good outcome (delivered, paid), solid
 * so it stands apart from leaf. red: failed, overdue. mute: over.
 */
export type ChipTone = "leaf" | "forest" | "wheat" | "green" | "red" | "mute";

const TONES: Record<ChipTone, string> = {
  leaf: "bg-leaf-50 text-leaf-700",
  forest: "bg-leaf-900 text-white",
  wheat: "bg-wheat-100 text-wheat-800",
  green: "bg-leaf-600 text-white",
  red: "bg-red-50 text-red-800",
  mute: "bg-cloud text-ink-muted",
};

/** A status in a few words: the state of an order, a payment, a return. */
export function Chip({
  tone = "mute",
  dot = true,
  className,
  children,
}: {
  tone?: ChipTone;
  dot?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.8125rem] leading-none font-bold whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      {dot && (
        <span
          aria-hidden="true"
          className={cn(
            "size-1.5 rounded-full",
            tone === "forest" ? "bg-wheat-400" : "bg-current",
          )}
        />
      )}
      {children}
    </span>
  );
}
