"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/** A filter as a pill: mist at rest, a leaf tint while it narrows the list. */
export const pill =
  "flex min-h-11 cursor-pointer items-center gap-2 rounded-full border-2 px-4 text-sm font-bold whitespace-nowrap select-none transition-colors duration-150 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-leaf-600";
export const pillIdle = "border-transparent bg-mist hover:bg-cloud";
export const pillActive = "border-leaf-600 bg-leaf-50 text-leaf-700";

/**
 * A pill that opens a panel under it. A native `details`, so it works
 * without scripts and the summary is a button to assistive technology;
 * with scripts the panel closes on Escape and on a click outside, and
 * only one panel is open at a time.
 */
export function FacetPopover({
  label,
  count = 0,
  align = "left",
  width = "w-72",
  children,
}: {
  label: ReactNode;
  /** Values chosen in this facet: shown as a badge, the pill turns leaf. */
  count?: number;
  align?: "left" | "right";
  width?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const details = ref.current;
    if (!details) return;
    const close = () => {
      details.open = false;
    };
    const onToggle = () => {
      if (!details.open) return;
      for (const other of document.querySelectorAll<HTMLDetailsElement>(
        "details[data-popover]",
      )) {
        if (other !== details && other.open) other.open = false;
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (details.open && !details.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !details.open) return;
      close();
      details.querySelector("summary")?.focus();
    };
    details.addEventListener("toggle", onToggle);
    details.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      details.removeEventListener("toggle", onToggle);
      details.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, []);

  return (
    <details ref={ref} data-popover className="group relative">
      <summary
        className={cn(
          pill,
          count > 0 ? pillActive : pillIdle,
          "list-none [&::-webkit-details-marker]:hidden",
        )}
      >
        {label}
        {count > 0 && (
          <span className="bg-leaf-600 grid size-5 place-items-center rounded-full text-[0.6875rem] leading-none text-white tabular-nums">
            {count}
          </span>
        )}
        <ChevronDown
          aria-hidden="true"
          className="size-4 shrink-0 transition-transform duration-150 group-open:rotate-180"
        />
      </summary>
      <div
        className={cn(
          "border-line shadow-float absolute top-full z-30 mt-2 max-w-[calc(100vw-2rem)] rounded-lg border bg-white p-2",
          width,
          align === "right" ? "right-0" : "left-0",
        )}
      >
        {children}
      </div>
    </details>
  );
}
