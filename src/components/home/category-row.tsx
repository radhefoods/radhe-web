"use client";

import { useCallback, useRef, useState, type ComponentProps } from "react";
import { ProductCard } from "@/components/catalogue/product-card";
import { Skeleton } from "@/components/ui/skeleton";
import { moreRowCards, nextRowPage, rowQuery } from "@/features/catalogue/home";
import type { Locale } from "@/i18n/routing";
import { api } from "@/lib/api/browser";
import type { ProductSummary } from "@/lib/api/types";
import { ProductRow, ProductRowItem } from "./product-row";

/** How many grey cards stand in for a page that is on its way. */
const PLACEHOLDERS = 4;

/**
 * The row of a category on the home page: the server's first cards, and
 * behind them, page by page as the visitor scrolls or turns towards the
 * end, the rest of the category in the same rounds of pack sizes (owner,
 * 2026-10-24: the row must not stop after the smallest sizes). The browser
 * asks the API for the next page of the row's own query (`rowQuery`), so
 * the cards carry the price and the stock of the moment; while a page is
 * on its way, grey cards hold its place at the end of the row and keep the
 * forward arrow alive. A page that cannot be fetched is asked for again at
 * the next scroll or turn. A card the row already shows is not shown
 * twice, should the order change between two answers.
 */
export function CategoryRow({
  category,
  locale,
  pages,
  shown,
  imageSizes,
  labels,
  children,
  ...row
}: Omit<ComponentProps<typeof ProductRow>, "more" | "labels"> & {
  /** The slug of the category. */
  category: string;
  locale: Locale;
  /** How many pages the row's query has; the server rendered the first. */
  pages: number;
  /** The `variantId` of every card the server rendered. */
  shown: string[];
  /** The `sizes` of the pictures of the cards the browser adds. */
  imageSizes: string;
  labels: { back: string; forward: string; loading: string };
}) {
  const [items, setItems] = useState<ProductSummary[]>([]);
  const [next, setNext] = useState<number | null>(pages > 1 ? 2 : null);
  const [loading, setLoading] = useState(false);
  // One page at a time, whatever the scroll events ask for meanwhile.
  const busy = useRef(false);

  const load = useCallback(() => {
    if (busy.current || next === null) return;
    busy.current = true;
    setLoading(true);
    api
      .listProducts(rowQuery(category, next), { locale })
      .then((list) => {
        setItems((previous) => moreRowCards(shown, previous, list.items));
        setNext(nextRowPage(list));
      })
      .catch(() => {
        // The page stays due: the next scroll or turn asks again.
      })
      .finally(() => {
        busy.current = false;
        setLoading(false);
      });
  }, [category, locale, next, shown]);

  return (
    <ProductRow
      {...row}
      labels={{ back: labels.back, forward: labels.forward }}
      more={{ hasMore: next !== null, load }}
    >
      {children}
      {items.map((product) => (
        // Two cards of a row can be one product (doc 7); the size is unique.
        <ProductRowItem key={product.variantId}>
          <ProductCard product={product} imageSizes={imageSizes} />
        </ProductRowItem>
      ))}
      {loading &&
        Array.from({ length: PLACEHOLDERS }, (_, index) => (
          <ProductRowItem key={`placeholder-${index}`}>
            <div
              role={index === 0 ? "status" : undefined}
              className="surface flex h-full flex-col rounded-xl p-2"
            >
              {index === 0 && <span className="sr-only">{labels.loading}</span>}
              <Skeleton className="aspect-square rounded-lg" />
              <div className="flex flex-col gap-2 px-2 pt-3 pb-2">
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="mt-2 h-5 w-1/3" />
              </div>
            </div>
          </ProductRowItem>
        ))}
    </ProductRow>
  );
}
