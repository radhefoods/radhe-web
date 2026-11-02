import { Coins, Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import type { RewardsProgram } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format/dates";
import { formatMoney } from "@/lib/format/money";

const INTL_LOCALE: Record<Locale, string> = { en: "en-GB", de: "de-DE" };

/** `1` → "1%" / "1 %"; up to four decimals, as the admin may set them. */
function percent(value: number, locale: Locale): string {
  const number = new Intl.NumberFormat(INTL_LOCALE[locale], {
    maximumFractionDigits: 4,
  }).format(value);
  return locale === "de" ? `${number} %` : `${number}%`;
}

/**
 * The rules of the coins in words, from `GET /v1/store/rewards/program`
 * (REWARDS 8): what earns coins and what they are worth, with the caps
 * and minimums the admin set. A rule that is switched off is left out.
 * Used on the account's coins page and on the public "How it works"
 * page; renders on the server as well as in the browser.
 */
export function RewardsRules({
  program,
  className,
}: {
  program: RewardsProgram;
  className?: string;
}) {
  const t = useTranslations("rewards");
  const locale = useLocale() as Locale;
  const { earning, redemption, expiry } = program;
  const campaign = earning.campaign;

  const earn: string[] = [];
  if (earning.order) {
    earn.push(t("rules.order", { rate: earning.order.coinsPerEuro }));
  }
  if (campaign?.active) {
    earn.push(
      [
        t("rules.campaign", { multiplier: campaign.multiplier }),
        campaign.name ? `(${campaign.name})` : null,
        campaign.endsAt
          ? t("rules.campaignUntil", {
              date: formatDate(campaign.endsAt, locale),
            })
          : null,
      ]
        .filter(Boolean)
        .join(" ") + ".",
    );
  }
  if (earning.welcome)
    earn.push(t("rules.welcome", { coins: earning.welcome }));
  if (earning.referral.inviter) {
    earn.push(t("rules.inviter", { coins: earning.referral.inviter }));
  }
  if (earning.referral.invitee) {
    earn.push(t("rules.invitee", { coins: earning.referral.invitee }));
  }
  if (earning.review) earn.push(t("rules.review", { coins: earning.review }));

  const redeem: string[] = [];
  if (redemption) {
    redeem.push(
      t("rules.worth", {
        percent: percent(redemption.percentPerCoin * 100, locale),
      }),
    );
    if (redemption.maxDiscount) {
      redeem.push(
        t("rules.maxDiscount", {
          amount: formatMoney(redemption.maxDiscount, locale),
        }),
      );
    }
    if (redemption.maxCoinsPerOrder) {
      redeem.push(t("rules.maxCoins", { coins: redemption.maxCoinsPerOrder }));
    }
    if (redemption.minCoins) {
      redeem.push(t("rules.minCoins", { coins: redemption.minCoins }));
    }
    if (redemption.minRedeemValue) {
      redeem.push(
        t("rules.minValue", {
          amount: formatMoney(redemption.minRedeemValue, locale),
        }),
      );
    }
    if (redemption.minOrderValue) {
      redeem.push(
        t("rules.minOrder", {
          amount: formatMoney(redemption.minOrderValue, locale),
        }),
      );
    }
    redeem.push(
      t(
        redemption.combinableWithDiscountCodes
          ? "rules.combinable"
          : "rules.notCombinable",
      ),
    );
  } else {
    redeem.push(t("rules.noRedeem"));
  }
  if (expiry) {
    redeem.push(t("rules.expiry", { months: expiry.inactivityMonths }));
  }

  const column = "glass flex flex-col gap-3 rounded-2xl p-5";
  const heading = "flex items-center gap-2 text-lg font-bold";
  const icon = "text-leaf-700 size-5 shrink-0";
  const list =
    "text-ink-muted flex list-disc flex-col gap-1.5 pl-5 text-[0.9375rem]";
  return (
    <div className={cn("grid gap-3 sm:grid-cols-2 sm:gap-4", className)}>
      {earn.length > 0 && (
        <section className={column}>
          <h3 className={heading}>
            <Sparkles aria-hidden="true" className={icon} />
            {t("rules.earnTitle")}
          </h3>
          <ul className={list}>
            {earn.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      )}
      <section className={column}>
        <h3 className={heading}>
          <Coins aria-hidden="true" className={icon} />
          {t("rules.redeemTitle")}
        </h3>
        <ul className={list}>
          {redeem.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
