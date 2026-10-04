"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarClock } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCargo, useOrderingOpen } from "@/features/cargo/cargo";
import type { Locale } from "@/i18n/routing";
import { api } from "@/lib/api/browser";
import type { Id, Ordering, PriceView } from "@/lib/api/types";
import { formatDayRange, formatDeadline } from "@/lib/format/dates";
import { formatMoney } from "@/lib/format/money";
import { AddToCart, orderingReason } from "./add-to-cart";

/** How few units count as "only a few left". */
const FEW_LEFT = 10;

/**
 * The buying part of a product page: the delivery promise, the add-to-cart
 * control, and the limits of the product. The page itself is cached, so
 * this part asks the API again for the one thing that must be current:
 * whether, and how much of, the product can be ordered right now.
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
  const tCargo = useTranslations("cargo");
  const locale = useLocale() as Locale;
  const { cargo } = useCargo();
  const open = useOrderingOpen();

  const fresh = useQuery({
    queryKey: ["product-ordering", slug, locale],
    queryFn: async () => (await api.getProduct(slug)).product.ordering,
    staleTime: 30_000,
  });
  const ordering = fresh.data ?? cachedOrdering;
  const canOrder = orderingReason(ordering, open) === null;

  const hints: string[] = [];
  if (canOrder && ordering) {
    if (ordering.remaining !== null && ordering.remaining <= FEW_LEFT) {
      hints.push(t("onlyLeft", { count: ordering.remaining }));
    } else if (ordering.maxQuantity !== null) {
      hints.push(t("maxPerOrder", { count: ordering.maxQuantity }));
    }
    if (ordering.minQuantity > 1) {
      hints.push(t("minPerOrder", { count: ordering.minQuantity }));
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {canOrder && cargo?.current && (
        <p className="flex items-start gap-2.5 text-[0.9375rem]">
          <CalendarClock
            aria-hidden="true"
            className="text-gold-500 mt-0.5 size-5 shrink-0"
          />
          {tCargo("promise", {
            deadline: formatDeadline(cargo.current.orderCloseAt, locale),
            delivery: formatDayRange(
              cargo.current.delivery.start,
              cargo.current.delivery.end,
              locale,
            ),
          })}
        </p>
      )}

      <AddToCart
        productId={productId}
        name={name}
        ordering={ordering}
        className="sm:max-w-xs"
      />

      {hints.length > 0 && (
        <ul className="text-gold-700 flex flex-col gap-0.5 text-sm font-semibold">
          {hints.map((hint) => (
            <li key={hint}>{hint}</li>
          ))}
        </ul>
      )}

      {/* On phones the same control stays in reach above the tab bar. */}
      <div className="border-line fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 flex items-center gap-3 border-t bg-white px-4 py-2.5 md:hidden">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{name}</p>
          <p className="text-[0.9375rem] font-bold tabular-nums">
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
