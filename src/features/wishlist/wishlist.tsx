"use client";

import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
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
import type { Id, Wishlist, WishlistEntryInput } from "@/lib/api/types";
import {
  GUEST_WISHLIST_KEY,
  clearGuestWishlist,
  loadGuestWishlist,
  removeProduct,
  saveGuestWishlist,
  saveProduct,
} from "@/lib/wishlist/guest-wishlist";

// The wishlist, wherever it lives (doc 16). A visitor's list is a list of
// products, each with the pack size it was saved from, in the browser; a
// signed-in customer's list is stored by the API. Components see one array
// of `{ productId, variantId? }`, `has`, `save` and `remove`; the products
// behind the list (for the wishlist page) are a separate question, always
// answered by the API.

export const wishlistQueryKey = (locale: string) =>
  ["wishlist", locale] as const;

export type WishlistProblem = "wishlist_full" | ApiError;

interface WishlistContextValue {
  /** False until the browser's list is read (first paint has no list). */
  ready: boolean;
  /** Where the list lives. */
  mode: "guest" | "customer";
  /** The saved products, newest first, with the size each was saved from. */
  entries: readonly WishlistEntryInput[];
  /** For the badge on the heart of the header. */
  count: number;
  has: (productId: Id) => boolean;
  /** Saves a product with the size it is saved from, or changes that size. */
  save: (productId: Id, variantId?: Id) => void;
  remove: (productId: Id) => void;
  /** Empties the list. */
  clear: () => void;
  /** The last change that failed, until the next change. */
  problem: WishlistProblem | null;
  clearProblem: () => void;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

// --- The visitor's list in localStorage -------------------------------------

const GUEST_EVENT = "rf:guest-wishlist";
const EMPTY: readonly WishlistEntryInput[] = [];
let guestSnapshot: readonly WishlistEntryInput[] = EMPTY;
let guestSnapshotRaw: string | null | undefined;

function readGuestSnapshot(): readonly WishlistEntryInput[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(GUEST_WISHLIST_KEY);
  } catch {
    raw = null;
  }
  // The same stored text gives the same array, so React sees no change.
  if (raw !== guestSnapshotRaw) {
    guestSnapshotRaw = raw;
    guestSnapshot = raw ? loadGuestWishlist() : EMPTY;
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

function writeGuest(list: readonly WishlistEntryInput[]): void {
  saveGuestWishlist(list);
  window.dispatchEvent(new Event(GUEST_EVENT));
}

function entryOf(productId: Id, variantId: Id | null): WishlistEntryInput {
  return variantId ? { productId, variantId } : { productId };
}

// --- Provider ---------------------------------------------------------------

/** A change of a signed-in customer the API has not confirmed yet. */
type Pending = { variantId: Id | null } | "removed";

export function WishlistProvider({ children }: { children: ReactNode }) {
  const locale = useLocale();
  const client = useQueryClient();
  const session = useSession();
  const isCustomer = session.status === "customer";
  const [problem, setProblem] = useState<WishlistProblem | null>(null);
  const clearProblem = useCallback(() => setProblem(null), []);

  const guestEntries = useSyncExternalStore(
    subscribeGuest,
    readGuestSnapshot,
    () => EMPTY,
  );
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const stored = useQuery({
    queryKey: wishlistQueryKey(locale),
    queryFn: () => api.getWishlist(),
    enabled: isCustomer,
    staleTime: 30_000,
  });

  // After sign-in or sign-up the visitor's list is handed to the server
  // once (doc 16), next to the cart: saved products keep their size, the
  // others are added, nothing is doubled. Then the browser's copy goes.
  const merging = useRef(false);
  const [mergeFailed, setMergeFailed] = useState(false);
  useEffect(() => {
    if (!isCustomer || merging.current) return;
    const guest = readGuestSnapshot();
    if (guest.length === 0) return;
    merging.current = true;
    api
      .mergeWishlist([...guest])
      .then(async (list) => {
        // A read of the stored list that is still on its way would bring
        // the list from before the merge: it must not arrive after this.
        await client.cancelQueries({ queryKey: wishlistQueryKey(locale) });
        client.setQueryData(wishlistQueryKey(locale), list);
        clearGuestWishlist();
        window.dispatchEvent(new Event(GUEST_EVENT));
      })
      .catch((error: unknown) => {
        // The visitor's list stays in the browser and is tried again at
        // the next visit; the customer goes on with the stored list.
        setMergeFailed(true);
        if (isApiError(error)) setProblem(error);
      })
      .finally(() => {
        merging.current = false;
      });
  }, [isCustomer, client, locale]);
  // Signed in, and the visitor's list is not handed over yet.
  const mergePending = isCustomer && guestEntries.length > 0 && !mergeFailed;

  // Changes the customer made that the server has not confirmed yet: the
  // heart turns at once, and turns back should the call fail.
  const [pending, setPending] = useState<ReadonlyMap<Id, Pending>>(new Map());
  const settle = useCallback((productId: Id, change: Pending) => {
    setPending((current) => {
      // A newer change of the same product stays.
      if (current.get(productId) !== change) return current;
      const next = new Map(current);
      next.delete(productId);
      return next;
    });
  }, []);
  const send = useCallback(
    (productId: Id, change: Pending, call: Promise<Wishlist>) => {
      setPending((current) => new Map(current).set(productId, change));
      call
        .then((list) => client.setQueryData(wishlistQueryKey(locale), list))
        .catch((error: unknown) => {
          if (isApiError(error)) setProblem(error);
          return client.invalidateQueries({
            queryKey: wishlistQueryKey(locale),
          });
        })
        .finally(() => settle(productId, change));
    },
    [client, locale, settle],
  );

  const save = useCallback(
    (productId: Id, variantId?: Id) => {
      setProblem(null);
      if (!isCustomer) {
        const change = saveProduct(readGuestSnapshot(), productId, variantId);
        if (change.ok) writeGuest(change.list);
        else setProblem(change.reason);
        return;
      }
      send(
        productId,
        { variantId: variantId ?? null },
        api.saveWishlistItem(productId, variantId),
      );
    },
    [isCustomer, send],
  );

  const remove = useCallback(
    (productId: Id) => {
      setProblem(null);
      if (!isCustomer) {
        writeGuest(removeProduct(readGuestSnapshot(), productId));
        return;
      }
      send(productId, "removed", api.removeWishlistItem(productId));
    },
    [isCustomer, send],
  );

  const clear = useCallback(() => {
    setProblem(null);
    if (!isCustomer) {
      clearGuestWishlist();
      window.dispatchEvent(new Event(GUEST_EVENT));
      return;
    }
    // Everything goes at once; the answer confirms it.
    const empty: Wishlist = { items: [], count: 0 };
    setPending(new Map());
    client.setQueryData(wishlistQueryKey(locale), empty);
    api
      .clearWishlist()
      .then((list) => client.setQueryData(wishlistQueryKey(locale), list))
      .catch((error: unknown) => {
        if (isApiError(error)) setProblem(error);
        return client.invalidateQueries({ queryKey: wishlistQueryKey(locale) });
      });
  }, [isCustomer, client, locale]);

  const entries = useMemo<readonly WishlistEntryInput[]>(() => {
    if (!isCustomer) return guestEntries;
    const merged = new Map<Id, WishlistEntryInput>();
    // What was just saved comes first: the list is newest first.
    for (const [productId, change] of pending) {
      if (change !== "removed") {
        merged.set(productId, entryOf(productId, change.variantId));
      }
    }
    for (const item of stored.data?.items ?? []) {
      if (pending.has(item.productId)) continue;
      merged.set(item.productId, entryOf(item.productId, item.variantId));
    }
    return [...merged.values()];
  }, [isCustomer, guestEntries, stored.data, pending]);

  const value = useMemo<WishlistContextValue>(() => {
    const ids = new Set(entries.map((entry) => entry.productId));
    return {
      ready:
        mounted &&
        session.status !== "loading" &&
        (!isCustomer || !stored.isPending) &&
        !mergePending,
      mode: isCustomer ? "customer" : "guest",
      entries,
      count: entries.length,
      has: (productId) => ids.has(productId),
      save,
      remove,
      clear,
      problem,
      clearProblem,
    };
  }, [
    entries,
    mounted,
    session.status,
    isCustomer,
    stored.isPending,
    mergePending,
    save,
    remove,
    clear,
    problem,
    clearProblem,
  ]);

  return (
    <WishlistContext.Provider value={value}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist(): WishlistContextValue {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error("useWishlist needs a WishlistProvider above it.");
  }
  return context;
}

export interface WishlistProducts {
  /** `null` while the list is not there yet. An empty list needs no call. */
  wishlist: Wishlist | null;
  loading: boolean;
  error: unknown;
  refetch: () => void;
}

/**
 * The list with its products, for the wishlist page: a customer's stored
 * list, or a visitor's list rendered by the API (`POST /wishlist/preview`,
 * nothing stored); no call while a visitor's list is empty. After a
 * preview the browser's copy follows the answer, so products that left
 * the shop leave the list too (doc 16).
 */
export function useWishlistProducts(): WishlistProducts {
  const locale = useLocale();
  const { mode, entries, ready } = useWishlist();
  const isGuest = mode === "guest";

  const preview = useQuery({
    queryKey: ["wishlist", "preview", locale, entries],
    queryFn: () => api.previewWishlist([...entries]),
    enabled: ready && isGuest && entries.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
  const stored = useQuery({
    queryKey: wishlistQueryKey(locale),
    queryFn: () => api.getWishlist(),
    enabled: ready && !isGuest,
    staleTime: 30_000,
  });

  const answered = isGuest ? preview.data : undefined;
  useEffect(() => {
    if (!answered) return;
    const next = answered.items.map((item) =>
      entryOf(item.productId, item.variantId),
    );
    const current = readGuestSnapshot();
    if (JSON.stringify(next) !== JSON.stringify(current)) writeGuest(next);
  }, [answered]);

  const query = isGuest ? preview : stored;
  const empty = entries.length === 0;
  const wishlist: Wishlist | null = empty
    ? { items: [], count: 0 }
    : (query.data ?? null);
  return {
    wishlist,
    loading: !ready || (!empty && wishlist === null && !query.isError),
    error: empty ? null : query.error,
    refetch: () => void query.refetch(),
  };
}
