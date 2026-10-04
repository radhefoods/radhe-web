"use client";

import { X } from "lucide-react";
import { Dialog } from "radix-ui";
import type { ReactNode, RefObject } from "react";
import { cn } from "@/lib/cn";

/**
 * A panel that slides over the page: from the bottom on phones, from the
 * right on larger screens. Focus stays inside, Escape closes it.
 */
export function Sheet({
  open,
  onOpenChange,
  trigger,
  title,
  closeLabel,
  returnFocusTo,
  children,
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
  className?: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-blue-900/45" />
        <Dialog.Content
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            if (!returnFocusTo?.current) return;
            event.preventDefault();
            returnFocusTo.current.focus();
          }}
          className={cn(
            "shadow-float fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] flex-col rounded-t-xl bg-white",
            "sm:inset-x-auto sm:inset-y-0 sm:right-0 sm:max-h-none sm:w-[26rem] sm:rounded-none sm:rounded-l-xl",
            className,
          )}
        >
          <div className="border-line flex items-center justify-between gap-4 border-b px-5 py-4">
            <Dialog.Title className="font-display text-2xl text-blue-900">
              {title}
            </Dialog.Title>
            <Dialog.Close
              aria-label={closeLabel}
              className="hover:bg-mist grid size-11 place-items-center rounded-sm"
            >
              <X aria-hidden="true" className="size-5" />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
