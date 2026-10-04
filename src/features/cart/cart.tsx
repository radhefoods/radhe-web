"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale } from "next-intl";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useSession } from "@/features/session/session";
import { api } from "@/lib/api/browser";
import { isApiError, type ApiError } from "@/lib/api/errors";
import type { Bill, CartItemInput, Id } from "@/lib/api/types";
import {
  GUEST_CART_KEY,
  clearGuestCart,
  loadGuestCart,
  saveGuestCart,
  setQuantity as setGuestQuantity,
  totalUnits,
} from "@/lib/cart/guest-cart";

// The cart, wherever it lives. A visitor's cart is a list of product ids and
// quantities in the browser; a signed-in customer's cart is stored by the
// API. Components only see quantities and one `setQuantity`; the bill (prices
// and totals) is a separate question, always answered by the API.

export const cartQueryKey = (locale: string) => ["cart", locale] as const;

export type CartProblem = "cart_full" | ApiError;

interface CartContextValue {
  /** False until the browser's cart is read (first paint has no cart). */
  ready: boolean;
  /** Where the cart lives. */
  mode: "guest" | "customer";
  items: readonly CartItemInput[];
  /** Sum of all units, for the badge on the cart icon. */
  units: number;
  quantityOf: (productId: Id) => number;
  /** `0` removes the product. Resolves when stored; rejects never. */
  setQuantity: (productId: Id, quantity: number) => void;
  /** The last change that failed, until the next change. */
  problem: CartProblem | null;
  clearProblem: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

// --- The visitor's cart in localStorage --------------------------------------

const GUEST_EVENT = "rf:guest-cart";
const EMPTY: readonly CartItemInput[] = [];
let guestSnapshot: readonly CartItemInput[] = EMPTY;
let guestSnapshotRaw: string | null | undefined;

function readGuestSnapshot(): readonly CartItemInput[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(GUEST_CART_KEY);
  } catch {
    raw = null;
  }
  // The same stored text gives the same array, so React sees no change.
  if (raw !== guestSnapshotRaw) {
    guestSnapshotRaw = raw;
    guestSnapshot = raw ? loadGuestCart() : EMPTY;
  }
  return guestSnapshot;
}

function subscribeGuest(onChange: () => void): () => void {
  // `storage` fires for changes made in other tabs.
  window.addEventListener("storage", onChange);
  window.addEventListener(GUEST_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(GUEST_EVENT, onChange);
  };
}

function writeGuest(items: readonly CartItemInput[]): void {
  saveGuestCart(items);
  window.dispatchEvent(new Event(GUEST_EVENT));
}

// --- Provider ---------------------------------------------------------------

/** How long quick taps on plus and minus are collected into one request. */
const DEBOUNCE_MS = 300;

export function CartProvider({ children }: { children: ReactNode }) {
  const locale = useLocale();
  const client = useQueryClient();
  const session = useSession();
  const isCustomer = session.status === "customer";
  const [problem, setProblem] = useState<CartProblem | null>(null);
  const clearProblem = useCallback(() => setProblem(null), []);

  const guestItems = useSyncExternalStore(
    subscribeGuest,
    readGuestSnapshot,
    () => EMPTY,
  );
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const serverCart = useQuery({
    queryKey: cartQueryKey(locale),
    queryFn: () => api.getCart(),
    enabled: isCustomer,
    staleTime: 30_000,
  });

  // After sign-in the visitor's cart is handed to the server once (doc 8):
  // for a product in both carts the larger quantity wins.
  const merging = useRef(false);
  const [mergeFailed, setMergeFailed] = useState(false);
  useEffect(() => {
    if (!isCustomer || merging.current) return;
    const guest = readGuestSnapshot();
    if (guest.length === 0) return;
    merging.current = true;
    api
      .mergeCart([...guest])
      .then(async (bill) => {
        // A read of the stored cart that is still on its way would bring
        // the cart from before the merge: it must not arrive after this.
        await client.cancelQueries({ queryKey: cartQueryKey(locale) });
        client.setQueryData(cartQueryKey(locale), bill);
        clearGuestCart();
        window.dispatchEvent(new Event(GUEST_EVENT));
      })
      .catch((error: unknown) => {
        // The visitor's cart stays in the browser and is tried again at the
        // next visit; the customer goes on with the stored cart.
        setMergeFailed(true);
        if (isApiError(error)) setProblem(error);
      })
      .finally(() => {
        merging.current = false;
      });
  }, [isCustomer, client, locale]);
  // Signed in, and the visitor's cart is not handed over yet.
  const mergePending = isCustomer && guestItems.length > 0 && !mergeFailed;

  // Quantities the customer chose that the server has not confirmed yet.
  const [pending, setPending] = useState<ReadonlyMap<Id, number>>(new Map());
  const timers = useRef(new Map<Id, number>());

  const sendToServer = useCallback(
    (productId: Id, quantity: number) => {
      api
        .setCartItem(productId, quantity)
        .then((bill: Bill) => client.setQueryData(cartQueryKey(locale), bill))
        .catch((error: unknown) => {
          if (isApiError(error)) setProblem(error);
          return client.invalidateQueries({ queryKey: cartQueryKey(locale) });
        })
        .finally(() => {
          // Keep a newer choice the customer made while this one travelled.
          setPending((current) => {
            if (current.get(productId) !== quantity) return current;
            const next = new Map(current);
            next.delete(productId);
            return next;
          });
        });
    },
    [client, locale],
  );

  const setQuantity = useCallback(
    (productId: Id, quantity: number) => {
      setProblem(null);
      if (!isCustomer) {
        const change = setGuestQuantity(
          readGuestSnapshot(),
          productId,
          quantity,
        );
        if (change.ok) writeGuest(change.cart);
        else setProblem(change.reason);
        return;
      }
      const wanted = Math.max(0, Math.trunc(quantity));
      setPending((current) => new Map(current).set(productId, wanted));
      window.clearTimeout(timers.current.get(productId));
      timers.current.set(
        productId,
        window.setTimeout(() => {
          timers.current.delete(productId);
          sendToServer(productId, wanted);
        }, DEBOUNCE_MS),
      );
    },
    [isCustomer, sendToServer],
  );

  const items = useMemo<readonly CartItemInput[]>(() => {
    if (!isCustomer) return guestItems;
    const merged = new Map<Id, number>();
    for (const line of serverCart.data?.lines ?? []) {
      merged.set(line.productId, line.quantity);
    }
    for (const [productId, quantity] of pending)
      merged.set(productId, quantity);
    return [...merged]
      .filter(([, quantity]) => quantity > 0)
      .map(([productId, quantity]) => ({ productId, quantity }));
  }, [isCustomer, guestItems, serverCart.data, pending]);

  const value = useMemo<CartContextValue>(() => {
    const byId = new Map(items.map((item) => [item.productId, item.quantity]));
    return {
      ready:
        mounted &&
        session.status !== "loading" &&
        (!isCustomer || !serverCart.isPending) &&
        !mergePending,
      mode: isCustomer ? "customer" : "guest",
      items,
      units: totalUnits(items),
      quantityOf: (productId) => byId.get(productId) ?? 0,
      setQuantity,
      problem,
      clearProblem,
    };
  }, [
    items,
    mounted,
    session.status,
    isCustomer,
    serverCart.isPending,
    mergePending,
    setQuantity,
    problem,
    clearProblem,
  ]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart needs a CartProvider above it.");
  return context;
}
