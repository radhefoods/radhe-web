"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale } from "next-intl";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api } from "@/lib/api/browser";
import type { CargoStatus } from "@/lib/api/types";
import { secondsLeft } from "@/lib/format/dates";

// Whether ordering is open, live. Pages are cached, so the cargo that came
// with the page can be minutes old: its texts (deadline, delivery days) are
// fine to show at once, but "is ordering open?" and the countdown must come
// from a fresh answer of the API. Until that answer is there, `live` is
// false and nothing claims to know the remaining time.

export const cargoQueryKey = (locale: string) => ["cargo", locale] as const;

interface CargoSnapshot {
  status: CargoStatus;
  /** Monotonic time (ms) at which the browser received it; 0 for the page's copy. */
  receivedAt: number;
}

interface CargoContextValue {
  /** `null`: the API could not be reached and the page had no cargo either. */
  cargo: CargoStatus | null;
  /** True once the browser has its own, fresh answer. */
  live: boolean;
  receivedAt: number;
}

const CargoContext = createContext<CargoContextValue>({
  cargo: null,
  live: false,
  receivedAt: 0,
});

export function CargoProvider({
  initial,
  children,
}: {
  /** The cargo rendered into the cached page, possibly minutes old. */
  initial: CargoStatus | null;
  children: ReactNode;
}) {
  const locale = useLocale();
  const query = useQuery<CargoSnapshot>({
    queryKey: cargoQueryKey(locale),
    queryFn: async () => ({
      status: await api.getCargo(),
      receivedAt: performance.now(),
    }),
    // The page's copy is shown first, and replaced at once.
    initialData: initial ? { status: initial, receivedAt: 0 } : undefined,
    initialDataUpdatedAt: 0,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const live = query.isFetchedAfterMount && !query.isError;
  const value = useMemo<CargoContextValue>(
    () => ({
      cargo: query.data?.status ?? null,
      live,
      receivedAt: query.data?.receivedAt ?? 0,
    }),
    [query.data, live],
  );
  return (
    <CargoContext.Provider value={value}>{children}</CargoContext.Provider>
  );
}

export function useCargo(): CargoContextValue {
  return useContext(CargoContext);
}

/**
 * Whether the customer can order right now.
 * `unknown` until the browser has a fresh answer: buttons stay usable (the
 * cart never refuses a product), but nothing promises a deadline.
 */
export function useOrderingOpen(): "open" | "closed" | "unknown" {
  const { cargo, live } = useCargo();
  if (!cargo) return "unknown";
  if (!live) return cargo.acceptingOrders ? "unknown" : "closed";
  return cargo.acceptingOrders ? "open" : "closed";
}

/**
 * Seconds until the order deadline, counted from the server's number, or
 * `null` while no fresh answer is there or ordering is closed. When it
 * reaches zero the cargo is asked for again, so the shop flips to "closed".
 */
export function useSecondsUntilClose(): number | null {
  const { cargo, live, receivedAt } = useCargo();
  const client = useQueryClient();
  const locale = useLocale();
  const closesIn = live ? (cargo?.current?.closesInSeconds ?? null) : null;
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (closesIn === null) return;
    const timer = window.setInterval(() => setNow(performance.now()), 1000);
    return () => window.clearInterval(timer);
  }, [closesIn, receivedAt]);

  const seconds =
    closesIn === null
      ? null
      : secondsLeft(closesIn, receivedAt, Math.max(now, receivedAt));
  const ended = seconds === 0;

  useEffect(() => {
    if (ended) {
      void client.invalidateQueries({ queryKey: cargoQueryKey(locale) });
    }
  }, [ended, client, locale]);

  return seconds;
}
