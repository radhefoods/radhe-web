"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";

/**
 * A message at the top of the window about something that just failed
 * (a product that did not get into the cart or onto the wishlist), with a
 * close button: a frosted panel with a red word (2026-10-31). Announced at
 * once; the caller decides how long it stays.
 */
export function ProblemToast({
  closeLabel,
  onClose,
  children,
}: {
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      role="alert"
      className="glass-strong shadow-float animate-dropdown-in fixed inset-x-3 top-3 z-50 flex items-start gap-3 rounded-2xl py-3 pr-2 pl-4 text-[0.9375rem] font-semibold text-red-800 ring-1 ring-red-600/15 sm:right-5 sm:left-auto sm:max-w-sm"
    >
      <p className="min-w-0 flex-1 py-1.5">{children}</p>
      <button
        type="button"
        aria-label={closeLabel}
        onClick={onClose}
        className="grid size-9 shrink-0 place-items-center rounded-full transition-colors duration-150 hover:bg-red-100/80"
      >
        <X aria-hidden="true" className="size-5" />
      </button>
    </div>
  );
}
