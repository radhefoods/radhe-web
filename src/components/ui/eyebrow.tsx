import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * A short line above a headline: tracked small caps behind a short rule.
 * Lime on the dark bands, leaf on white.
 */
export function Eyebrow({
  tone = "lime",
  className,
  children,
}: {
  tone?: "lime" | "leaf";
  className?: string;
  children: ReactNode;
}) {
  return (
    <p
      className={cn(
        "inline-flex items-center gap-2.5 text-xs font-bold tracking-[0.14em] uppercase before:h-0.5 before:w-7 before:shrink-0 before:rounded-full before:bg-current",
        tone === "lime" ? "text-lime-400" : "text-leaf-700",
        className,
      )}
    >
      {children}
    </p>
  );
}
