"use client";

import { CheckCircle2, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

/** Long enough to read one line, short enough not to be in the way. */
const VISIBLE_MS = 4000;
/** The fade at the end, inside `VISIBLE_MS`. */
const LEAVE_MS = 250;

/**
 * A quiet word at the top of the window that something was saved
 * (owner, 2026-11-02: a toast in place of a "Saved." beside the button):
 * a frosted panel with a green tick, slid in the way the dropdowns are,
 * gone by itself after a few seconds or with its close button. Announced
 * politely. Rendered on the body, so a frosted ancestor (whose backdrop
 * filter would pin a fixed child) cannot hold it.
 */
export function SuccessToast({
  closeLabel,
  onClose,
  children,
}: {
  closeLabel: string;
  /** Called when the toast is done; keep it stable, it restarts the clock. */
  onClose: () => void;
  children: ReactNode;
}) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const fade = window.setTimeout(
      () => setLeaving(true),
      VISIBLE_MS - LEAVE_MS,
    );
    const done = window.setTimeout(onClose, VISIBLE_MS);
    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(done);
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      role="status"
      className={cn(
        "glass-strong shadow-float animate-dropdown-in ring-leaf-600/15 text-ink fixed inset-x-3 top-3 z-50 flex items-start gap-3 rounded-2xl py-3 pr-2 pl-4 text-[0.9375rem] font-semibold ring-1 transition-[opacity,transform] duration-200 ease-out sm:right-5 sm:left-auto sm:max-w-sm",
        leaving && "-translate-y-1 opacity-0",
      )}
    >
      <span
        aria-hidden="true"
        className="bg-leaf-50 text-leaf-700 mt-1 grid size-8 shrink-0 place-items-center rounded-full"
      >
        <CheckCircle2 className="size-5" />
      </span>
      <p className="min-w-0 flex-1 py-1.5">{children}</p>
      <button
        type="button"
        aria-label={closeLabel}
        onClick={onClose}
        className="text-ink-muted hover:text-ink grid size-9 shrink-0 place-items-center rounded-full transition-colors duration-150 hover:bg-white/80"
      >
        <X aria-hidden="true" className="size-5" />
      </button>
    </div>,
    document.body,
  );
}
