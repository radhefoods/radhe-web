import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ChipTone = "blue" | "navy" | "saffron" | "green" | "red" | "mute";

const TONES: Record<ChipTone, string> = {
  blue: "bg-blue-50 text-blue-800",
  navy: "bg-blue-900 text-white",
  saffron: "bg-saffron-100 text-saffron-800",
  green: "bg-green-50 text-green-700",
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
            tone === "navy" ? "bg-saffron-400" : "bg-current",
          )}
        />
      )}
      {children}
    </span>
  );
}
