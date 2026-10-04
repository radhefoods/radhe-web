"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useSyncExternalStore } from "react";
import { api } from "@/lib/api/browser";
import { hasErrorCode } from "@/lib/api/errors";
import type { Customer } from "@/lib/api/types";

// Who is signed in. The session itself lives in httpOnly cookies the shop
// cannot read, so `GET /v1/store/me` is the only way to know. Asking on
// every page view would mean two failing requests for every visitor who is
// not signed in. Therefore the browser keeps a hint ("this browser signed
// in before"): without it the shop does not ask, except on pages that need
// an account (`force`).

export const SESSION_QUERY_KEY = ["session"] as const;
const HINT_KEY = "rf.session.v1";
const HINT_EVENT = "rf:session-hint";

function readHint(): boolean {
  try {
    return window.localStorage.getItem(HINT_KEY) === "1";
  } catch {
    return false;
  }
}

/** Remembers (or forgets) that this browser has a session. */
export function setSessionHint(signedIn: boolean): void {
  try {
    if (signedIn) window.localStorage.setItem(HINT_KEY, "1");
    else window.localStorage.removeItem(HINT_KEY);
  } catch {
    // Storage blocked: pages that need an account still ask the API.
  }
  window.dispatchEvent(new Event(HINT_EVENT));
}

function subscribeHint(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(HINT_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(HINT_EVENT, onChange);
  };
}

async function fetchCustomer(): Promise<Customer | null> {
  try {
    const { customer } = await api.getMe();
    setSessionHint(true);
    return customer;
  } catch (error) {
    if (
      hasErrorCode(error, "AUTH_TOKEN_INVALID") ||
      hasErrorCode(error, "CUSTOMER_NOT_FOUND")
    ) {
      setSessionHint(false);
      return null;
    }
    throw error;
  }
}

export type SessionStatus = "loading" | "guest" | "customer";

export interface Session {
  status: SessionStatus;
  customer: Customer | null;
  /** The API could not be asked (network, server). */
  error: unknown;
}

/**
 * The signed-in customer.
 * @param force ask the API even without the hint (account and checkout pages)
 */
export function useSession({ force = false } = {}): Session {
  const hinted = useSyncExternalStore(subscribeHint, readHint, () => false);
  const enabled = force || hinted;
  const query = useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: fetchCustomer,
    enabled,
    staleTime: 5 * 60_000,
  });
  if (!enabled) return { status: "guest", customer: null, error: null };
  if (query.isPending)
    return { status: "loading", customer: null, error: null };
  return {
    status: query.data ? "customer" : "guest",
    customer: query.data ?? null,
    error: query.error,
  };
}

/** For the sign-in and sign-out flows. */
export function useSessionActions() {
  const client = useQueryClient();
  const signedIn = useCallback(
    (customer: Customer) => {
      setSessionHint(true);
      client.setQueryData(SESSION_QUERY_KEY, customer);
    },
    [client],
  );
  const signedOut = useCallback(() => {
    setSessionHint(false);
    client.setQueryData(SESSION_QUERY_KEY, null);
    // Nothing of the customer stays in memory.
    client.removeQueries({
      predicate: (query) => query.queryKey[0] !== SESSION_QUERY_KEY[0],
    });
  }, [client]);
  return { signedIn, signedOut };
}
