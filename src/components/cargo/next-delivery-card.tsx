"use client";

import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { useCargo, useSecondsUntilClose } from "@/features/cargo/cargo";
import type { Locale } from "@/i18n/routing";
import {
  formatDayRange,
  formatDeadline,
  splitDuration,
} from "@/lib/format/dates";
import { formatMoney } from "@/lib/format/money";

function Tile({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-mist rounded-md px-1 py-3.5 text-center">
      <span className="font-display block text-[2rem] leading-none tabular-nums sm:text-[2.25rem]">
        {value}
      </span>
      <span className="text-ink-subtle mt-1.5 block text-[0.6875rem] font-bold tracking-[0.1em] uppercase">
        {label}
      </span>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-ink-subtle text-[0.6875rem] font-bold tracking-[0.1em] uppercase">
        {label}
      </dt>
      <dd className="mt-1.5 font-bold">{value}</dd>
    </div>
  );
}

const card = "shadow-float text-ink relative rounded-xl bg-white p-6 sm:p-7";
/** The dashed inner border: a ticket rather than a form. */
const ticket =
  "border-line-strong pointer-events-none absolute inset-2 rounded-[18px] border-[1.5px] border-dashed";
const pill =
  "inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold tracking-[0.1em] uppercase";

/**
 * The countdown card in the hero of the home page: that the pre-order is
 * open, the deadline, the time left in four tiles, the delivery days, the
 * free-delivery line, and the "nothing to pay today" seal on its corner.
 * The numbers show a dash until the browser has a fresh answer of the API.
 */
export function NextDeliveryCard({
  freeFrom,
}: {
  /** The order value from which delivery is free, or null when unknown. */
  freeFrom: number | null;
}) {
  const t = useTranslations("cargo");
  const locale = useLocale() as Locale;
  const { cargo } = useCargo();
  const seconds = useSecondsUntilClose();

  if (!cargo) return null;

  if (!cargo.current) {
    return (
      <section aria-label={t("label")} className={card}>
        <span aria-hidden="true" className={ticket} />
        <div className="relative">
          <p className={`${pill} bg-cloud text-ink-muted`}>
            <span
              aria-hidden="true"
              className="bg-ink-subtle size-2 rounded-full"
            />
            {t("nextDelivery")}
          </p>
          <h2 className="font-display mt-4 text-2xl leading-tight">
            {t("closed")}
          </h2>
          <p className="text-ink-muted mt-3 text-[0.9375rem]">
            {cargo.next
              ? t("nextOpens", {
                  date: formatDeadline(cargo.next.orderOpenAt, locale),
                })
              : t("nextUnknown")}
          </p>
        </div>
      </section>
    );
  }

  const parts = seconds === null ? null : splitDuration(seconds);
  const pad = (value: number) => String(value).padStart(2, "0");
  const { orderCloseAt, delivery } = cargo.current;

  return (
    <section aria-label={t("label")} className={card}>
      <span aria-hidden="true" className={ticket} />
      <div className="relative">
        <p className={`${pill} bg-leaf-50 text-leaf-700`}>
          <span
            aria-hidden="true"
            className="bg-leaf-600 size-2 rounded-full shadow-[0_0_0_3px_rgb(21_122_75_/_0.18)]"
          />
          {t("open")}
        </p>
        {/* Room on the right for the seal. */}
        <h2 className="font-display mt-4 pr-10 text-2xl leading-tight">
          {t("orderBy")}{" "}
          <time dateTime={orderCloseAt} className="whitespace-nowrap">
            {formatDeadline(orderCloseAt, locale)}
          </time>
        </h2>
        <div role="timer" className="mt-5 grid grid-cols-4 gap-2">
          <Tile
            value={parts ? String(parts.days) : "–"}
            label={t("days", { count: parts?.days ?? 2 })}
          />
          <Tile
            value={parts ? pad(parts.hours) : "–"}
            label={t("hours", { count: parts?.hours ?? 2 })}
          />
          <Tile value={parts ? pad(parts.minutes) : "–"} label={t("minutes")} />
          <Tile value={parts ? pad(parts.seconds) : "–"} label={t("seconds")} />
        </div>
        <dl className="border-line-strong mt-5 grid grid-cols-2 gap-4 border-t-[1.5px] border-dashed pt-4 text-[0.9375rem]">
          <Fact
            label={t("delivery")}
            value={formatDayRange(delivery.start, delivery.end, locale)}
          />
          {freeFrom !== null && (
            <Fact
              label={t("feeLabel")}
              value={t("freeFrom", { amount: formatMoney(freeFrom, locale) })}
            />
          )}
        </dl>
      </div>
      {/* The promise of the shop, stamped on the corner of the ticket. */}
      <p className="bg-leaf-600 absolute -top-6 -right-2 grid size-28 -rotate-10 place-items-center rounded-full p-3 text-center text-[0.6875rem] leading-tight font-bold tracking-[0.06em] text-white uppercase shadow-[0_0_0_3px_#fff,0_0_0_5px_var(--color-leaf-600)] before:absolute before:inset-[0.45rem] before:rounded-full before:border-[1.5px] before:border-dashed before:border-white/70 sm:-top-7 sm:-right-3">
        {t("payLaterTitle")}
      </p>
    </section>
  );
}
