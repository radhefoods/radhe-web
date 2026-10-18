"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { CartProvider } from "@/features/cart/cart";
import { WishlistProvider } from "@/features/wishlist/wishlist";
import { SESSION_QUERY_KEY, setSessionHint } from "@/features/session/session";
import { session } from "@/lib/api/browser";
import { isRetryable } from "@/lib/api/errors";

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

/** Everything that lives in the browser: data cache, session, cart, wishlist. */
export function Providers({ children }: { children: ReactNode }) {
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
      <CartProvider>
        <WishlistProvider>{children}</WishlistProvider>
      </CartProvider>
    </QueryClientProvider>
  );
}
