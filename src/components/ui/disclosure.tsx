import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * A section that folds open: the title in a white panel, a chevron that
 * turns, the content underneath. A native `details`, so it works without
 * scripts, the summary is a button to assistive technology, and the
 * content is in the HTML the server sends whether open or not. Used for
 * the texts of the product page (owner, 2026-10-19: accordions).
 */
export function Disclosure({
  id,
  title,
  defaultOpen = false,
  className,
  children,
}: {
  id: string;
  title: string;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <details
      id={id}
      open={defaultOpen}
      className={cn("group border-line rounded-xl border bg-white", className)}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-xl px-5 py-4 select-none sm:px-6 [&::-webkit-details-marker]:hidden">
        <h2 className="font-display text-ink text-lg sm:text-xl">{title}</h2>
        <ChevronDown
          aria-hidden="true"
          className="text-ink-subtle size-5 shrink-0 transition-transform duration-200 group-open:rotate-180"
        />
      </summary>
      <div className="px-5 pb-5 sm:px-6 sm:pb-6">{children}</div>
    </details>
  );
}
