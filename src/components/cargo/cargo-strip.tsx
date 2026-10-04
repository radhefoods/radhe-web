"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCargo } from "@/features/cargo/cargo";
import type { Locale } from "@/i18n/routing";
import { formatDayRange, formatDeadline } from "@/lib/format/dates";
import { CountdownText } from "./countdown-text";

/**
 * The state of the pre-order under the header of every shop page: the
 * order deadline, the delivery days and the time left; or, when ordering
 * is closed, when it opens again. Customer words, never "cargo".
 *
 * Phones get two short lines (deadline; delivery and time left), wide
 * screens one.
 */
export function CargoStrip() {
  const t = useTranslations("cargo");
  const locale = useLocale() as Locale;
  const { cargo } = useCargo();

  // The API could not be reached: say nothing rather than something wrong.
  if (!cargo) return null;

  if (cargo.current) {
    const { orderCloseAt, delivery } = cargo.current;
    return (
      <section aria-label={t("label")} className="bg-blue-900 text-white">
        <div className="container-page grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-0.5 py-2 text-sm sm:flex sm:gap-x-3 sm:py-2.5 sm:text-[0.9375rem]">
          <p className="col-span-2 flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="bg-gold-300 ring-gold-300/25 size-2 shrink-0 rounded-full ring-4"
            />
            <span>
              <span className="font-bold">{t("orderBy")}</span>{" "}
              {formatDeadline(orderCloseAt, locale)}
            </span>
          </p>
          <span aria-hidden="true" className="hidden text-white/40 sm:inline">
            |
          </span>
          <p className="pl-[1.125rem] sm:pl-0">
            <span className="font-bold">{t("delivery")}</span>{" "}
            {formatDayRange(delivery.start, delivery.end, locale)}
          </p>
          <CountdownText className="text-gold-300 justify-self-end font-bold whitespace-nowrap tabular-nums sm:ml-auto" />
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label={t("label")}
      className="border-line bg-mist text-ink border-b"
    >
      <p className="container-page py-2.5 text-sm sm:text-[0.9375rem]">
        <span className="font-bold">{t("closed")}</span>{" "}
        {cargo.next
          ? t("nextOpens", {
              date: formatDeadline(cargo.next.orderOpenAt, locale),
            })
          : t("nextUnknown")}
      </p>
    </section>
  );
}
