"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { CargoProvider } from "@/features/cargo/cargo";
import { CartProvider } from "@/features/cart/cart";
import { SESSION_QUERY_KEY, setSessionHint } from "@/features/session/session";
import { session } from "@/lib/api/browser";
import { isRetryable } from "@/lib/api/errors";
import type { CargoStatus } from "@/lib/api/types";

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Ask again only when asking again can help: network, 429, 502-504.
        retry: (failures, error) => failures < 2 && isRetryable(error),
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      },
      mutations: { retry: false },
    },
  });
}

/** Everything that lives in the browser: data cache, session, cargo, cart. */
export function Providers({
  cargo,
  children,
}: {
  cargo: CargoStatus | null;
  children: ReactNode;
}) {
  const [client] = useState(createQueryClient);

  useEffect(
    () =>
      // The refresh was refused: the session is over on this device.
      session.onSessionEnded(() => {
        setSessionHint(false);
        client.setQueryData(SESSION_QUERY_KEY, null);
      }),
    [client],
  );

  return (
    <QueryClientProvider client={client}>
      <CargoProvider initial={cargo}>
        <CartProvider>{children}</CartProvider>
      </CargoProvider>
    </QueryClientProvider>
  );
}
