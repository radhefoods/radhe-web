import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import type { PriceView } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatBasePrice, formatMoney } from "@/lib/format/money";

/**
 * The price of a product: what it costs, the crossed-out regular price when
 * reduced, and the price per kilogram, litre or piece, which German law
 * asks for next to every price.
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
    <div className={cn("flex flex-col", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2 tabular-nums">
        {pricing.onSale && (
          <span className="sr-only">{t("currentPrice")}:</span>
        )}
        <span
          className={cn(
            "leading-tight font-bold",
            size === "lg" ? "text-3xl" : "text-xl",
            pricing.onSale && "text-chili",
          )}
        >
          {formatMoney(pricing.price, locale)}
        </span>
        {pricing.onSale && (
          <>
            <span className="sr-only">{t("regularPrice")}:</span>
            <s
              className={cn(
                "text-ink-muted font-medium",
                size === "lg" ? "text-lg" : "text-sm",
              )}
            >
              {formatMoney(pricing.regularPrice, locale)}
            </s>
          </>
        )}
      </p>
      <p
        className={cn(
          "text-ink-muted tabular-nums",
          size === "lg" ? "text-sm" : "text-[0.8125rem]",
        )}
      >
        {formatBasePrice(pricing.basePrice, locale)}
      </p>
    </div>
  );
}
