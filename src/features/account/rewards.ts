"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/features/session/session";
import { api } from "@/lib/api/browser";

/** The key of the customer's coins (`GET /v1/store/me/rewards`, REWARDS 5). */
export const REWARDS_QUERY_KEY = ["account", "rewards"] as const;

/**
 * The customer's coins: the balance, the totals, the rules, whether
 * redeeming is offered. Asked once a customer is signed in and kept for a
 * while; an order placed or paid changes it, so the pages that show it ask
 * again when they open.
 */
export function useMyRewards(enabled = true) {
  const session = useSession();
  return useQuery({
    queryKey: REWARDS_QUERY_KEY,
    queryFn: () => api.getMyRewards(),
    enabled: enabled && session.status === "customer",
    staleTime: 30_000,
  });
}
