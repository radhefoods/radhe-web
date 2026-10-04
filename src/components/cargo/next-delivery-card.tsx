"use client";

import { Check } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCargo, useSecondsUntilClose } from "@/features/cargo/cargo";
import type { Locale } from "@/i18n/routing";
import {
  formatDayRange,
  formatDeadline,
  splitDuration,
} from "@/lib/format/dates";

function Tile({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-mist flex flex-col items-center gap-0.5 rounded-md px-1.5 py-3">
      <span className="text-3xl leading-none font-bold text-blue-900 tabular-nums">
        {value}
      </span>
      <span className="text-ink-muted text-xs font-semibold">{label}</span>
    </div>
  );
}

/**
 * The card in the hero of the home page: the time left to order, the order
 * deadline, the delivery days, and that nothing is paid today. The numbers
 * show a dash until the browser has a fresh answer of the API.
 */
export function NextDeliveryCard() {
  const t = useTranslations("cargo");
  const locale = useLocale() as Locale;
  const { cargo } = useCargo();
  const seconds = useSecondsUntilClose();

  if (!cargo) return null;

  if (!cargo.current) {
    return (
      <div className="text-ink shadow-float flex flex-col gap-2 rounded-xl bg-white p-6">
        <h2 className="text-ink-muted text-xs font-bold tracking-wider uppercase">
          {t("nextDelivery")}
        </h2>
        <p className="font-display text-3xl text-blue-900">{t("closed")}</p>
        <p className="text-ink-muted">
          {cargo.next
            ? t("nextOpens", {
                date: formatDeadline(cargo.next.orderOpenAt, locale),
              })
            : t("nextUnknown")}
        </p>
      </div>
    );
  }

  const parts = seconds === null ? null : splitDuration(seconds);
  const pad = (value: number) => String(value).padStart(2, "0");
  const { orderCloseAt, delivery } = cargo.current;

  return (
    <div className="text-ink shadow-float flex flex-col gap-4 rounded-xl bg-white p-5 sm:p-6">
      <h2 className="text-ink-muted text-xs font-bold tracking-wider uppercase">
        {t("nextDelivery")}
      </h2>
      <div role="timer" className="grid grid-cols-3 gap-2">
        <Tile
          value={parts ? String(parts.days) : "–"}
          label={t("days", { count: parts?.days ?? 2 })}
        />
        <Tile
          value={parts ? pad(parts.hours) : "–"}
          label={t("hours", { count: parts?.hours ?? 2 })}
        />
        <Tile value={parts ? pad(parts.minutes) : "–"} label={t("minutes")} />
      </div>
      <dl className="flex flex-col gap-2 text-[0.9375rem]">
        <div className="flex justify-between gap-4">
          <dt className="text-ink-muted">{t("orderBy")}</dt>
          <dd className="text-right font-bold">
            {formatDeadline(orderCloseAt, locale)}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ink-muted">{t("delivery")}</dt>
          <dd className="text-right font-bold">
            {formatDayRange(delivery.start, delivery.end, locale)}
          </dd>
        </div>
      </dl>
      <p className="flex items-center gap-2 rounded-sm bg-teal-50 px-3 py-2.5 text-sm font-semibold text-teal-700">
        <Check
          aria-hidden="true"
          className="size-4.5 shrink-0"
          strokeWidth={2.6}
        />
        {t("payLaterShort")}
      </p>
    </div>
  );
}
