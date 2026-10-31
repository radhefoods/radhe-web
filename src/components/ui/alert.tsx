import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type AlertTone = "info" | "good" | "warn" | "bad";

/* Translucent tints with a faint outline of their own colour, so they sit
   on glass and on the canvas alike (2026-10-31). */
const TONES: Record<AlertTone, string> = {
  info: "bg-white/70 text-ink ring-ink/8",
  good: "bg-leaf-50/85 text-leaf-700 ring-leaf-600/15",
  warn: "bg-wheat-100/90 text-wheat-800 ring-wheat-800/15",
  bad: "bg-red-50/90 text-red-800 ring-red-600/20",
};

/**
 * A message that needs attention. `bad` and `warn` are announced by screen
 * readers at once; `info` and `good` politely.
 */
export function Alert({
  tone = "info",
  title,
  icon,
  className,
  children,
}: {
  tone?: AlertTone;
  title?: ReactNode;
  icon?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      role={tone === "bad" || tone === "warn" ? "alert" : "status"}
      className={cn(
        "flex gap-3 rounded-lg px-4 py-3.5 text-[0.9375rem] shadow-[inset_0_1px_0_rgb(255_255_255/0.6)] ring-1",
        TONES[tone],
        className,
      )}
    >
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0 space-y-1">
        {title && <p className="font-bold">{title}</p>}
        {children}
      </div>
    </div>
  );
}
