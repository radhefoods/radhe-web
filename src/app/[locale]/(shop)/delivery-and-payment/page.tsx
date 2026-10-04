import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PayLaterNote } from "@/components/cargo/pay-later-note";
import { getCargo, getSettings } from "@/features/catalogue/data";
import { Link } from "@/i18n/navigation";
import { localeOf } from "@/i18n/locale";
import { formatDayRange, formatDeadline } from "@/lib/format/dates";
import { formatMoney } from "@/lib/format/money";
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
 * return window, current deadline) come from the API, so the page says what
 * the shop really charges; German price law wants the delivery costs
 * reachable from every price.
 */
export default async function DeliveryPage({ params }: Props) {
  const locale = await localeOf(params);
  const [t, settings, cargo] = await Promise.all([
    getTranslations("help.delivery"),
    getSettings(),
    getCargo(locale),
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
  const returnDays = settings?.returns.windowDays ?? 0;
  const title = "font-display text-3xl text-blue-900";

  return (
    <article className="container-page max-w-3xl space-y-10 py-8 sm:py-12">
      <header className="space-y-3">
        <h1 className="font-display text-4xl text-blue-900 sm:text-6xl">
          {t("title")}
        </h1>
        <p className="text-lg">{t("intro")}</p>
      </header>

      <section aria-labelledby="delivery-area" className="space-y-3">
        <h2 id="delivery-area" className={title}>
          {t("areaTitle")}
        </h2>
        <p>{t("areaText")}</p>
      </section>

      <section aria-labelledby="delivery-fee" className="space-y-3">
        <h2 id="delivery-fee" className={title}>
          {t("feeTitle")}
        </h2>
        <p>{t("feeIntro")}</p>
        {tiers.length > 0 ? (
          <table className="w-full max-w-md text-left tabular-nums">
            <thead>
              <tr className="border-line-strong border-b">
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
                <tr key={tier.minOrderValue} className="border-line border-b">
                  <td className="py-2.5 pr-4">
                    {feeStep(
                      tier.minOrderValue,
                      tiers[index + 1]?.minOrderValue ?? null,
                    )}
                  </td>
                  <td
                    className={
                      tier.fee === 0
                        ? "py-2.5 text-right font-bold text-teal-700"
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
      </section>

      <section aria-labelledby="delivery-days" className="space-y-3">
        <h2 id="delivery-days" className={title}>
          {t("daysTitle")}
        </h2>
        <p>
          {cargo?.current
            ? t("daysOpen", {
                deadline: formatDeadline(cargo.current.orderCloseAt, locale),
                delivery: formatDayRange(
                  cargo.current.delivery.start,
                  cargo.current.delivery.end,
                  locale,
                ),
              })
            : t("daysClosed")}
        </p>
        <p className="text-ink-muted">{t("daysNote")}</p>
      </section>

      <section aria-labelledby="delivery-pay" className="space-y-3">
        <h2 id="delivery-pay" className={title}>
          {t("payTitle")}
        </h2>
        <p>{t("payText")}</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>{t("payCard")}</li>
          <li>{t("payCash")}</li>
        </ul>
        <p>{t("payDeadline")}</p>
        <PayLaterNote />
      </section>

      <section aria-labelledby="delivery-returns" className="space-y-3">
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
          className="rounded-xs font-semibold text-blue-700 underline underline-offset-4"
        >
          {t("withdrawalLink")}
        </Link>
      </section>
    </article>
  );
}
