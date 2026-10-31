"use client";

import { Tooltip as Radix } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * A small dark glass label under a control, on hover and on keyboard
 * focus, for the icon-only controls of the header whose meaning a sighted
 * visitor may want in words. The control keeps its own spoken label; the
 * tip is read as its description. A touch never opens it, as Radix
 * intends.
 */
export function Tooltip({
  label,
  children,
  className,
}: {
  label: ReactNode;
  /** The control; it must take a ref and the trigger's props. */
  children: ReactNode;
  className?: string;
}) {
  return (
    <Radix.Provider delayDuration={350} skipDelayDuration={400}>
      <Radix.Root>
        <Radix.Trigger asChild>{children}</Radix.Trigger>
        <Radix.Portal>
          <Radix.Content
            side="bottom"
            sideOffset={8}
            collisionPadding={8}
            className={cn(
              "glass-dark animate-tooltip-in z-50 rounded-full px-3 py-1.5 text-xs font-semibold text-white select-none",
              className,
            )}
          >
            {label}
          </Radix.Content>
        </Radix.Portal>
      </Radix.Root>
    </Radix.Provider>
  );
}
