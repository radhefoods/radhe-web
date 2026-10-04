"use client";

import { useTranslations } from "next-intl";
import { useSecondsUntilClose } from "@/features/cargo/cargo";
import { splitDuration } from "@/lib/format/dates";

const pad = (value: number) => String(value).padStart(2, "0");

/**
 * "Closes in 2d 14h 05m", live. Renders nothing until the browser has a
 * fresh answer of the API: a cached page never shows a remaining time.
 */
export function CountdownText({ className }: { className?: string }) {
  const t = useTranslations("cargo");
  const seconds = useSecondsUntilClose();
  if (seconds === null || seconds <= 0) return null;
  const parts = splitDuration(seconds);
  const text =
    parts.days > 0
      ? t("closesInDays", {
          days: parts.days,
          hours: pad(parts.hours),
          minutes: pad(parts.minutes),
        })
      : parts.hours > 0
        ? t("closesInHours", {
            hours: parts.hours,
            minutes: pad(parts.minutes),
          })
        : t("closesInMinutes", {
            minutes: parts.minutes,
            seconds: pad(parts.seconds),
          });
  return (
    // A timer: screen readers read it on request, not every second.
    <span role="timer" className={className}>
      {text}
    </span>
  );
}
