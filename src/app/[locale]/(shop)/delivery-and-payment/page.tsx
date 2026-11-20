import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getSettings } from "@/features/catalogue/data";
import { Link } from "@/i18n/navigation";
import { localeOf } from "@/i18n/locale";
import { formatMoney } from "@/lib/format/money";
import { formatWeight } from "@/lib/format/weight";
import { alternates, sameHref } from "@/lib/seo/alternates";

type Props = PageProps<"/[locale]/delivery-and-payment">;

export const revalidate = 300;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await localeOf(params);
  const t = await getTranslations("help.delivery");
  return {
    title: t("title"),
    description: t("metaDescription"),
    alternates: alternates(locale, sameHref("/delivery-and-payment")),
  };
}

/**
 * Delivery and payment in one place. The numbers (delivery fee steps,
 * delivery time, return window) come from the API, so the page says what
 * the shop really charges; German price law wants the delivery costs
 * reachable from every price.
 *
 * Where the shop prices delivery by the box (`shipping.boxBased` of the
 * settings, doc/BOX_BASED_SHIPPING_WEB_INTEGRATION.md 3.1, 2026-11-20), the
 * fee section states that rule instead: what a box holds, the value of
 * goods that frees one box, and the fee of every other box by the value of
 * the goods. A fee "once per order" would be wrong there.
 */
export default async function DeliveryPage({ params }: Props) {
  const locale = await localeOf(params);
  const [t, settings] = await Promise.all([
    getTranslations("help.delivery"),
    getSettings(),
  ]);
  const tiers = [...(settings?.deliveryFee.tiers ?? [])].sort(
    (a, b) => a.minOrderValue - b.minOrderValue,
  );
  /** "under €50.00", "€20.00 to under €50.00", "from €50.00". */
  const feeStep = (from: number, next: number | null) => {
    if (next === null)
      return t("feeFrom", { amount: formatMoney(from, locale) });
    if (from === 0) return t("feeBelow", { amount: formatMoney(next, locale) });
    return t("feeBetween", {
      from: formatMoney(from, locale),
      to: formatMoney(next, locale),
    });
  };
  // The box rules, when they apply and are complete; else the flat fee.
  const shipping = settings?.shipping;
  const boxes =
    shipping?.boxBased && shipping.feeTiers && shipping.boxCapacity !== null
      ? {
          capacity: shipping.boxCapacity,
          freeFrom: shipping.freeThresholdPerBox,
          // In rising order, the tier without an upper limit last.
          tiers: [...shipping.feeTiers].sort(
            (a, b) =>
              (a.upTo ?? Number.POSITIVE_INFINITY) -
              (b.upTo ?? Number.POSITIVE_INFINITY),
          ),
        }
      : null;
  /** "up to €20.00", "above €20.00"; one tier alone covers every value. */
  const boxStep = (upTo: number | null, previous: number | null) => {
    if (upTo !== null) {
      return t("boxFeeUpTo", { amount: formatMoney(upTo, locale) });
    }
    return previous === null
      ? t("boxFeeAny")
      : t("boxFeeAbove", { amount: formatMoney(previous, locale) });
  };
  const estimate = settings?.delivery.estimate[locale] ?? null;
  const returnDays = settings?.returns.windowDays ?? 0;
  const title = "font-display text-xl text-ink";
  const section = "glass-strong space-y-3 rounded-2xl p-5 sm:p-6";

  return (
    <article className="container-page max-w-3xl space-y-6 py-6 sm:py-10">
      <header className="space-y-3">
        <h1 className="font-display text-ink text-3xl sm:text-4xl">
          {t("title")}
        </h1>
        <p className="text-lg">{t("intro")}</p>
      </header>

      <section aria-labelledby="delivery-area" className={section}>
        <h2 id="delivery-area" className={title}>
          {t("areaTitle")}
        </h2>
        <p>{t("areaText")}</p>
      </section>

      <section aria-labelledby="delivery-fee" className={section}>
        <h2 id="delivery-fee" className={title}>
          {t("feeTitle")}
        </h2>
        {boxes ? (
          <>
            <p>
              {boxes.freeFrom !== null
                ? t("boxIntro", {
                    weight: formatWeight(boxes.capacity, locale),
                    amount: formatMoney(boxes.freeFrom, locale),
                  })
                : t("boxIntroNoFree", {
                    weight: formatWeight(boxes.capacity, locale),
                  })}
            </p>
            <table className="w-full max-w-md text-left tabular-nums">
              <thead>
                <tr className="border-ink/15 border-b">
                  <th scope="col" className="py-2 pr-4 font-bold">
                    {t("feeOrderValue")}
                  </th>
                  <th scope="col" className="py-2 text-right font-bold">
                    {t("boxFeeFee")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {boxes.tiers.map((tier, index) => (
                  <tr
                    key={tier.upTo ?? "open"}
                    className="border-ink/8 border-b"
                  >
                    <td className="py-2.5 pr-4">
                      {boxStep(tier.upTo, boxes.tiers[index - 1]?.upTo ?? null)}
                    </td>
                    <td
                      className={
                        tier.fee === 0
                          ? "text-leaf-700 py-2.5 text-right font-bold"
                          : "py-2.5 text-right"
                      }
                    >
                      {tier.fee === 0
                        ? t("feeFree")
                        : formatMoney(tier.fee, locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-ink-muted">{t("boxNote")}</p>
          </>
        ) : (
          <>
            <p>{t("feeIntro")}</p>
            {tiers.length > 0 ? (
              <table className="w-full max-w-md text-left tabular-nums">
                <thead>
                  <tr className="border-ink/15 border-b">
                    <th scope="col" className="py-2 pr-4 font-bold">
                      {t("feeOrderValue")}
                    </th>
                    <th scope="col" className="py-2 text-right font-bold">
                      {t("feeFee")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tiers.map((tier, index) => (
                    <tr
                      key={tier.minOrderValue}
                      className="border-ink/8 border-b"
                    >
                      <td className="py-2.5 pr-4">
                        {feeStep(
                          tier.minOrderValue,
                          tiers[index + 1]?.minOrderValue ?? null,
                        )}
                      </td>
                      <td
                        className={
                          tier.fee === 0
                            ? "text-leaf-700 py-2.5 text-right font-bold"
                            : "py-2.5 text-right"
                        }
                      >
                        {tier.fee === 0
                          ? t("feeFree")
                          : formatMoney(tier.fee, locale)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-ink-muted">{t("feeUnknown")}</p>
            )}
          </>
        )}
      </section>

      <section aria-labelledby="delivery-time" className={section}>
        <h2 id="delivery-time" className={title}>
          {t("timeTitle")}
        </h2>
        <p>{estimate ? t("timeText", { estimate }) : t("timeUnknown")}</p>
        <p className="text-ink-muted">{t("timeNote")}</p>
      </section>

      <section aria-labelledby="delivery-pay" className={section}>
        <h2 id="delivery-pay" className={title}>
          {t("payTitle")}
        </h2>
        <p>{t("payText")}</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>{t("payCard")}</li>
          <li>{t("payPaypal")}</li>
        </ul>
        <p>{t("payConfirm")}</p>
      </section>

      <section aria-labelledby="delivery-cancel" className={section}>
        <h2 id="delivery-cancel" className={title}>
          {t("cancelTitle")}
        </h2>
        <p>{t("cancelText")}</p>
      </section>

      <section aria-labelledby="delivery-returns" className={section}>
        <h2 id="delivery-returns" className={title}>
          {t("returnsTitle")}
        </h2>
        <p>
          {returnDays > 0
            ? t("returnsText", { days: returnDays })
            : t("returnsOff")}
        </p>
        <Link
          href="/legal/withdrawal"
          className="text-leaf-700 rounded-xs font-semibold underline underline-offset-4"
        >
          {t("withdrawalLink")}
        </Link>
      </section>
    </article>
  );
}
