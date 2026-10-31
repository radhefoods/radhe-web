import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * leaf: confirmed, in progress. forest: on its way. wheat: needs attention
 * (waiting for payment). green: a good outcome (delivered, paid), solid so
 * it stands apart from leaf. red: a payment that failed. mute: over.
 */
export type ChipTone = "leaf" | "forest" | "wheat" | "green" | "red" | "mute";

const TONES: Record<ChipTone, string> = {
  leaf: "bg-leaf-50 text-leaf-700 ring-leaf-600/12",
  forest: "bg-leaf-900 text-white ring-transparent",
  wheat: "bg-wheat-100 text-wheat-800 ring-wheat-800/12",
  green: "leaf-gradient text-white ring-transparent",
  red: "bg-red-50 text-red-800 ring-red-600/15",
  mute: "bg-ink/6 text-ink-muted ring-transparent",
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
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.8125rem] leading-none font-semibold whitespace-nowrap ring-1",
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
