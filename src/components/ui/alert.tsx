import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type AlertTone = "info" | "good" | "warn" | "bad";

const TONES: Record<AlertTone, string> = {
  info: "border-blue-200 bg-blue-50 text-blue-800",
  good: "border-teal-100 bg-teal-50 text-teal-700",
  warn: "border-gold-200 bg-gold-100 text-gold-800",
  bad: "border-red-200 bg-red-50 text-red-800",
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
        "flex gap-3 rounded-md border px-4 py-3.5 text-[0.9375rem]",
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
