import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * A section that folds open: the title with a chevron that turns, the
 * content underneath. A native `details`, so it works without scripts, the
 * summary is a button to assistive technology, and the content is in the
 * HTML the server sends whether open or not. Two looks: a white card
 * (`card`), or a flat row between hairlines that stacks with its
 * neighbours (`row`, the texts of the product page since 2026-10-21).
 */
export function Disclosure({
  id,
  title,
  defaultOpen = false,
  look = "card",
  className,
  children,
}: {
  id: string;
  title: string;
  defaultOpen?: boolean;
  look?: "card" | "row";
  className?: string;
  children: ReactNode;
}) {
  const row = look === "row";
  return (
    <details
      id={id}
      open={defaultOpen}
      className={cn(
        "group",
        row
          ? "border-line border-t last:border-b"
          : "border-line rounded-xl border bg-white",
        className,
      )}
    >
      <summary
        className={cn(
          "flex cursor-pointer list-none items-center justify-between gap-4 select-none [&::-webkit-details-marker]:hidden",
          row ? "rounded-xs py-4" : "rounded-xl px-5 py-4 sm:px-6",
        )}
      >
        <h2
          className={cn(
            "font-display text-ink",
            row ? "text-[1.0625rem] sm:text-lg" : "text-lg sm:text-xl",
          )}
        >
          {title}
        </h2>
        <ChevronDown
          aria-hidden="true"
          className="text-ink-subtle size-5 shrink-0 transition-transform duration-200 group-open:rotate-180"
        />
      </summary>
      <div className={row ? "pb-5" : "px-5 pb-5 sm:px-6 sm:pb-6"}>
        {children}
      </div>
    </details>
  );
}
