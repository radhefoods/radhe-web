"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/features/session/session";
import { api } from "@/lib/api/browser";

/** The key of the account at a glance (`GET /v1/store/me/overview`, doc 2). */
export const OVERVIEW_QUERY_KEY = ["account", "overview"] as const;

/**
 * The account at a glance: the counts the sidebar and the tiles show, the
 * standard address, the referral code. Asked once a customer is signed
 * in and kept for a while; a change of orders, addresses or lists
 * invalidates it.
 */
export function useOverview() {
  const session = useSession();
  return useQuery({
    queryKey: OVERVIEW_QUERY_KEY,
    queryFn: () => api.getOverview(),
    enabled: session.status === "customer",
    staleTime: 30_000,
  });
}
