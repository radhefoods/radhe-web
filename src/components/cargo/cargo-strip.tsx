"use client";

import { Clock } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCargo } from "@/features/cargo/cargo";
import { usePathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatDayRange, formatDeadline } from "@/lib/format/dates";
import { CountdownText } from "./countdown-text";

/**
 * The state of the pre-order under the header of every shop page: the
 * order deadline, the delivery days and the time left; or, when ordering
 * is closed, when it opens again. Customer words, never "cargo". A quiet
 * mist line with the time left in leaf, so it reads as information and
 * not as an alarm.
 *
 * Phones get two short lines (deadline; delivery and time left), wide
 * screens one.
 */
export function CargoStrip() {
  const t = useTranslations("cargo");
  const locale = useLocale() as Locale;
  const { cargo } = useCargo();
  const pathname = usePathname();

  // The home page says all of this in its countdown card, right under the
  // header: no need to say it twice.
  if (pathname === "/") return null;
  // The API could not be reached: say nothing rather than something wrong.
  if (!cargo) return null;

  if (cargo.current) {
    const { orderCloseAt, delivery } = cargo.current;
    return (
      <section
        aria-label={t("label")}
        className="border-line text-ink-muted bg-mist border-b"
      >
        <div className="container-page grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-0.5 py-2 text-sm font-medium sm:flex sm:gap-x-3 sm:text-[0.9375rem]">
          <p className="col-span-2 flex items-center gap-2">
            <Clock
              aria-hidden="true"
              className="text-leaf-600 size-4 shrink-0"
            />
            <span>
              <span className="font-bold">{t("orderBy")}</span>{" "}
              <span className="text-ink font-semibold">
                {formatDeadline(orderCloseAt, locale)}
              </span>
            </span>
          </p>
          <span aria-hidden="true" className="hidden opacity-40 sm:inline">
            |
          </span>
          <p className="pl-6 sm:pl-0">
            <span className="font-bold">{t("delivery")}</span>{" "}
            <span className="text-ink font-semibold">
              {formatDayRange(delivery.start, delivery.end, locale)}
            </span>
          </p>
          <CountdownText className="text-leaf-700 justify-self-end font-bold whitespace-nowrap tabular-nums sm:ml-auto" />
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label={t("label")}
      className="border-line text-ink bg-mist border-b"
    >
      <p className="container-page py-2 text-sm font-medium sm:text-[0.9375rem]">
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
