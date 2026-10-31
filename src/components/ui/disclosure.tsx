import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * A section that folds open: the title with a chevron that turns, the
 * content underneath. A native `details`, so it works without scripts, the
 * summary is a button to assistive technology, and the content is in the
 * HTML the server sends whether open or not. The content glides open and
 * shut where the browser can animate `details` (`disclosure-fold`); else
 * it simply appears. Two looks: a glass card (`card`), or a flat row
 * between hairlines that stacks with its neighbours (`row`, the texts of
 * the product page since 2026-10-21). The title is a heading of the page;
 * its level follows the heading above it (`h2` by default).
 */
export function Disclosure({
  id,
  title,
  defaultOpen = false,
  look = "card",
  headingLevel = "h2",
  className,
  children,
}: {
  id: string;
  title: string;
  defaultOpen?: boolean;
  look?: "card" | "row";
  headingLevel?: "h2" | "h3";
  className?: string;
  children: ReactNode;
}) {
  const row = look === "row";
  const Heading = headingLevel;
  return (
    <details
      id={id}
      open={defaultOpen}
      className={cn(
        "group disclosure-fold",
        row ? "border-ink/8 border-t last:border-b" : "glass rounded-xl",
        className,
      )}
    >
      <summary
        className={cn(
          "flex cursor-pointer list-none items-center justify-between gap-4 select-none [&::-webkit-details-marker]:hidden",
          row ? "rounded-xs py-4" : "rounded-xl px-5 py-4 sm:px-6",
        )}
      >
        <Heading
          className={cn(
            "font-display text-ink",
            row ? "text-[1.0625rem] sm:text-lg" : "text-lg sm:text-xl",
          )}
        >
          {title}
        </Heading>
        <span
          aria-hidden="true"
          className="bg-ink/6 text-ink-subtle group-hover:bg-ink/10 grid size-8 shrink-0 place-items-center rounded-full transition-[transform,background-color] duration-200 ease-[var(--ease-glass)] group-open:rotate-180"
        >
          <ChevronDown className="size-4" strokeWidth={2.25} />
        </span>
      </summary>
      <div className={row ? "pb-5" : "px-5 pb-5 sm:px-6 sm:pb-6"}>
        {children}
      </div>
    </details>
  );
}
