"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useLocale } from "next-intl";
import { useEffect, useState } from "react";
import { api } from "@/lib/api/browser";
import type { Bill, CartItemInput } from "@/lib/api/types";
import { cartQueryKey, useCart } from "./cart";

/** How long changes are collected before the API is asked for prices. */
const PREVIEW_DELAY_MS = 350;

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export interface BillState {
  /** `null`: the cart is empty, or the bill is not there yet. */
  bill: Bill | null;
  /** The first bill is on its way. */
  loading: boolean;
  /** The cart changed and the bill on screen is not the latest yet. */
  updating: boolean;
  error: unknown;
  refetch: () => void;
}

/**
 * The bill of the cart: prices, delivery fee, VAT and totals, always from
 * the API. A visitor's cart is priced with `POST /cart/preview` (a short
 * moment after the last change, the endpoint is rate-limited); a customer's
 * cart answers with its bill anyway.
 *
 * @param enabled set to false where the bill is not shown
 */
export function useBill({ enabled = true } = {}): BillState {
  const locale = useLocale();
  const cart = useCart();
  const guestItems = useDebounced<readonly CartItemInput[]>(
    cart.items,
    PREVIEW_DELAY_MS,
  );
  const isGuest = cart.mode === "guest";

  const preview = useQuery({
    queryKey: ["bill", "guest", locale, guestItems],
    queryFn: () => api.previewCart([...guestItems]),
    enabled: enabled && cart.ready && isGuest && guestItems.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
  const stored = useQuery({
    queryKey: cartQueryKey(locale),
    queryFn: () => api.getCart(),
    enabled: enabled && cart.ready && !isGuest,
    staleTime: 30_000,
  });

  const query = isGuest ? preview : stored;
  const empty = cart.items.length === 0;
  const bill = empty ? null : (query.data ?? null);
  const inSync =
    bill !== null &&
    bill.lines.length === cart.items.length &&
    bill.lines.every(
      (line) => cart.quantityOf(line.productId) === line.quantity,
    );

  return {
    bill,
    loading: !cart.ready || (!empty && bill === null && !query.isError),
    updating: !empty && bill !== null && (!inSync || query.isFetching),
    error: empty ? null : query.error,
    refetch: () => void query.refetch(),
  };
}
