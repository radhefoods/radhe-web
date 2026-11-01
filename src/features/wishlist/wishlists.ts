"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale } from "next-intl";
import { useCallback } from "react";
import { OVERVIEW_QUERY_KEY } from "@/features/account/overview";
import { useSession } from "@/features/session/session";
import { api } from "@/lib/api/browser";
import type { Id, Wishlist, WishlistSummary } from "@/lib/api/types";
import { wishlistQueryKey } from "./wishlist";

// The customer's named lists (doc 16.2): the default one is what the heart
// and the header count stand for and lives in `wishlist.tsx`; the others
// are read here, by id, for the wishlist page.

export const WISHLISTS_QUERY_KEY = ["wishlists"] as const;
export const namedWishlistQueryKey = (id: Id, locale: string) =>
  ["wishlist", "named", id, locale] as const;

/** Every list of the customer, the default first. */
export function useWishlists() {
  const session = useSession();
  return useQuery({
    queryKey: WISHLISTS_QUERY_KEY,
    queryFn: async () => (await api.listWishlists()).items,
    enabled: session.status === "customer",
    staleTime: 30_000,
  });
}

/** One named list with its products; nothing is asked while `id` is null. */
export function useNamedWishlist(id: Id | null) {
  const locale = useLocale();
  return useQuery({
    queryKey: namedWishlistQueryKey(id ?? "", locale),
    queryFn: () => api.getWishlistById(id!),
    enabled: id !== null,
    staleTime: 30_000,
  });
}

/**
 * What a change of the lists must refresh: the lists themselves, the
 * account's counts, and the default list the heart reads, when it was
 * touched.
 */
export function useWishlistsRefresh() {
  const client = useQueryClient();
  const locale = useLocale();
  return useCallback(
    (options: { defaultList?: boolean; lists?: Id[] } = {}) => {
      void client.invalidateQueries({ queryKey: WISHLISTS_QUERY_KEY });
      void client.invalidateQueries({ queryKey: OVERVIEW_QUERY_KEY });
      if (options.defaultList) {
        void client.invalidateQueries({ queryKey: wishlistQueryKey(locale) });
      }
      for (const id of options.lists ?? []) {
        void client.invalidateQueries({
          queryKey: namedWishlistQueryKey(id, locale),
        });
      }
    },
    [client, locale],
  );
}

/** Puts an answered list where its readers look for it. */
export function useStoreWishlist() {
  const client = useQueryClient();
  const locale = useLocale();
  return useCallback(
    (list: Wishlist, summaries?: WishlistSummary[]) => {
      if (list.wishlist?.isDefault) {
        client.setQueryData(wishlistQueryKey(locale), list);
      } else if (list.wishlist) {
        client.setQueryData(
          namedWishlistQueryKey(list.wishlist.id, locale),
          list,
        );
      }
      if (summaries) client.setQueryData(WISHLISTS_QUERY_KEY, summaries);
    },
    [client, locale],
  );
}
