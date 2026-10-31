import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import type { Locale } from "@/i18n/routing";
import type { ShopSettings } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format/money";

function Tile({ value, label }: { value: string; label: string }) {
  return (
    <div className="ring-ink/5 rounded-lg bg-white/70 px-1 py-3.5 text-center ring-1">
      <span className="font-display block text-[1.75rem] leading-none tabular-nums sm:text-[2rem]">
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

const card =
  "glass-strong shadow-float text-ink relative rounded-2xl p-6 sm:p-7";
/** The dashed inner border: a ticket rather than a form. */
const ticket =
  "border-ink/15 pointer-events-none absolute inset-2 rounded-[24px] border-[1.5px] border-dashed";
const pill =
  "inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold tracking-[0.1em] uppercase";
const COLUMNS = ["", "grid-cols-1", "grid-cols-2", "grid-cols-3"];

/**
 * The ticket in the hero of the home page: the promise of the shop at a
 * glance. What the shop delivers in (the estimate of the settings), the
 * delivery fee, from where it is free and the days to return as three tiles,
 * how and where, and the "secure checkout" seal on its corner. Every number
 * comes from `GET /v1/store/settings`; a missing one leaves its tile out.
 */
export async function DeliveryPromiseCard({
  settings,
  locale,
}: {
  settings: ShopSettings | null;
  locale: Locale;
}) {
  const t = await getTranslations("home.card");
  const estimate = settings?.delivery.estimate[locale] ?? null;
  const fee = settings?.deliveryFee.tiers[0]?.fee ?? null;
  const freeFrom = settings?.deliveryFee.freeFrom ?? null;
  const returnDays = settings?.returns.windowDays ?? 0;

  const tiles: { value: string; label: string }[] = [];
  if (fee !== null) {
    tiles.push({ value: formatMoney(fee, locale), label: t("delivery") });
  }
  if (freeFrom !== null) {
    tiles.push({ value: formatMoney(freeFrom, locale), label: t("freeFrom") });
  }
  if (returnDays > 0) {
    tiles.push({
      value: String(returnDays),
      label: t("returnDays", { count: returnDays }),
    });
  }

  return (
    <section aria-label={t("ariaLabel")} className={card}>
      <span aria-hidden="true" className={ticket} />
      <div className="relative">
        <p className={`${pill} bg-leaf-50 text-leaf-700`}>
          <span
            aria-hidden="true"
            className="bg-leaf-600 size-2 rounded-full shadow-[0_0_0_3px_rgb(21_122_75_/_0.18)]"
          />
          {t("label")}
        </p>
        {/* Room on the right for the seal. */}
        <h2 className="font-display mt-4 pr-10 text-2xl leading-tight">
          {estimate ? t("headline", { estimate }) : t("headlineFallback")}
        </h2>
        {tiles.length > 0 && (
          <div className={cn("mt-5 grid gap-2", COLUMNS[tiles.length])}>
            {tiles.map((tile) => (
              <Tile key={tile.label} value={tile.value} label={tile.label} />
            ))}
          </div>
        )}
        <dl className="border-ink/15 mt-5 grid grid-cols-2 gap-4 border-t-[1.5px] border-dashed pt-4 text-[0.9375rem]">
          <Fact label={t("payment")} value={t("paymentValue")} />
          <Fact label={t("area")} value={t("areaValue")} />
        </dl>
      </div>
      {/* The promise of the shop, stamped on the corner of the ticket. */}
      <p className="leaf-gradient absolute -top-6 -right-2 grid size-28 -rotate-10 place-items-center rounded-full p-3 text-center text-[0.6875rem] leading-tight font-bold tracking-[0.06em] text-white uppercase shadow-[0_0_0_3px_#fff,0_0_0_5px_var(--color-leaf-600),0_12px_28px_-10px_rgb(21_122_75/0.6)] before:absolute before:inset-[0.45rem] before:rounded-full before:border-[1.5px] before:border-dashed before:border-white/70 sm:-top-7 sm:-right-3">
        {t("seal")}
      </p>
    </section>
  );
}
