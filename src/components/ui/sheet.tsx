"use client";

import { X } from "lucide-react";
import { Dialog } from "radix-ui";
import type { ReactNode, RefObject } from "react";
import { cn } from "@/lib/cn";

/**
 * A panel that slides over the page: from the bottom on phones, from the
 * right on larger screens. Frosted glass over a dimmed, softly blurred
 * page (2026-10-31), with a grab handle at the top on phones. Focus stays
 * inside, Escape closes it.
 */
export function Sheet({
  open,
  onOpenChange,
  trigger,
  title,
  closeLabel,
  returnFocusTo,
  children,
  footer,
  className,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
  /**
   * Without a `trigger`: the control that opened the sheet. Focus goes back
   * to it when the sheet closes, instead of being lost.
   */
  returnFocusTo?: RefObject<HTMLElement | null>;
  title: ReactNode;
  closeLabel: string;
  children: ReactNode;
  /** Stays in view under the scrolling body: the buttons of a form. */
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}
      <Dialog.Portal>
        <Dialog.Overlay className="bg-ink/35 animate-overlay-in fixed inset-0 z-50 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            if (!returnFocusTo?.current) return;
            event.preventDefault();
            returnFocusTo.current.focus();
          }}
          className={cn(
            "glass-strong shadow-float animate-sheet-up fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] flex-col rounded-t-3xl",
            "sm:animate-sheet-in sm:inset-x-auto sm:inset-y-2 sm:right-2 sm:max-h-none sm:w-[26rem] sm:rounded-3xl",
            className,
          )}
        >
          {/* The handle: a hint that the sheet can be pulled shut (phones). */}
          <span
            aria-hidden="true"
            className="bg-ink/15 mx-auto mt-2.5 block h-1.5 w-10 rounded-full sm:hidden"
          />
          <div className="flex items-center justify-between gap-4 px-5 pt-3 pb-3 sm:pt-5">
            <Dialog.Title className="font-display text-ink text-xl">
              {title}
            </Dialog.Title>
            <Dialog.Close
              aria-label={closeLabel}
              className="bg-ink/6 hover:bg-ink/10 grid size-10 place-items-center rounded-full transition-colors duration-150 active:scale-95"
            >
              <X aria-hidden="true" className="size-5" />
            </Dialog.Close>
          </div>
          <div
            className={cn(
              "min-h-0 flex-1 overflow-y-auto px-5 pt-1 pb-5",
              !footer && "pb-[calc(1.25rem+env(safe-area-inset-bottom))]",
            )}
          >
            {children}
          </div>
          {footer && (
            <div className="border-ink/6 border-t px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-4">
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
