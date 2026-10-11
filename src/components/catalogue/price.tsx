import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import type { PriceView } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatBasePrice, formatMoney } from "@/lib/format/money";

/**
 * The price of a product: what it costs, the crossed-out regular price when
 * reduced, and the price per kilogram, litre or piece, which German law
 * asks for next to every price. The price is set in the display cut, like
 * a headline: it is what the eye looks for on a card.
 */
export function Price({
  pricing,
  size = "md",
  className,
}: {
  pricing: PriceView;
  size?: "md" | "lg";
  className?: string;
}) {
  const t = useTranslations("product");
  const locale = useLocale() as Locale;
  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2 tabular-nums">
        {pricing.onSale && (
          <span className="sr-only">{t("currentPrice")}:</span>
        )}
        <span
          className={cn(
            "font-display leading-none",
            size === "lg" ? "text-[2rem]" : "text-xl",
            pricing.onSale && "text-red-600",
          )}
        >
          {formatMoney(pricing.price, locale)}
        </span>
        {pricing.onSale && (
          <>
            <span className="sr-only">{t("regularPrice")}:</span>
            <s
              className={cn(
                "text-ink-subtle font-medium",
                size === "lg" ? "text-base" : "text-[0.8125rem]",
              )}
            >
              {formatMoney(pricing.regularPrice, locale)}
            </s>
          </>
        )}
      </p>
      <p
        className={cn(
          "text-ink-subtle tabular-nums",
          size === "lg" ? "text-sm" : "text-xs",
        )}
      >
        {formatBasePrice(pricing.basePrice, locale)}
      </p>
    </div>
  );
}
