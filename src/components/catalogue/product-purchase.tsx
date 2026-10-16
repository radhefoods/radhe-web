"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import {
  cappedByLimit,
  fewLeft,
  orderingReason,
} from "@/features/catalogue/availability";
import type { Locale } from "@/i18n/routing";
import { api } from "@/lib/api/browser";
import type { Id, Ordering, PriceView } from "@/lib/api/types";
import { formatMoney } from "@/lib/format/money";
import { AddToCart } from "./add-to-cart";

/**
 * The buying part of a product page: the add-to-cart control and the limits
 * of the product. The page itself is cached, so this part asks the API again
 * for the one thing that must be current: whether, and how much of, the
 * product can be ordered right now. Nothing is reserved before a payment,
 * so the stock can change at any moment.
 */
export function ProductPurchase({
  productId,
  slug,
  name,
  pricing,
  ordering: cachedOrdering,
}: {
  productId: Id;
  slug: string;
  /** Name with pack size, for spoken labels and the bar on phones. */
  name: string;
  pricing: PriceView;
  /** The answer rendered into the page, possibly minutes old. */
  ordering: Ordering | null;
}) {
  const t = useTranslations("product");
  const locale = useLocale() as Locale;

  const fresh = useQuery({
    queryKey: ["product-ordering", slug, locale],
    queryFn: async () => (await api.getProduct(slug)).product.ordering,
    staleTime: 30_000,
  });
  const ordering = fresh.data ?? cachedOrdering;
  const canOrder = orderingReason(ordering) === null;

  const hints: string[] = [];
  if (canOrder && ordering) {
    const left = fewLeft(ordering);
    if (left !== null) hints.push(t("onlyLeft", { count: left }));
    if (cappedByLimit(ordering)) {
      hints.push(t("maxPerOrder", { count: ordering.maxQuantity }));
    }
    if (ordering.minQuantity > 1) {
      hints.push(t("minPerOrder", { count: ordering.minQuantity }));
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <AddToCart
        productId={productId}
        name={name}
        ordering={ordering}
        className="sm:max-w-xs"
      />

      {hints.length > 0 && (
        <ul className="text-wheat-800 flex flex-col gap-0.5 text-sm font-semibold">
          {hints.map((hint) => (
            <li key={hint}>{hint}</li>
          ))}
        </ul>
      )}

      {/* On phones the same control stays in reach above the tab bar. */}
      <div className="shadow-header fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 flex items-center gap-3 bg-white px-4 py-2.5 md:hidden">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{name}</p>
          <p className="font-display text-lg tabular-nums">
            {formatMoney(pricing.price, locale)}
          </p>
        </div>
        <AddToCart
          productId={productId}
          name={name}
          ordering={ordering}
          size="sm"
          className="w-40 shrink-0"
        />
      </div>
    </div>
  );
}
