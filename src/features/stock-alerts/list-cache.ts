import type { QueryClient } from "@tanstack/react-query";
import type { Id, OwnStockAlert } from "@/lib/api/types";

// The customer's list of "Notify me" requests in the TanStack Query cache
// (doc 26), and the two changes the shop makes to it in place: a request
// the API just took, and one it just took back.

export const stockAlertsQueryKey = (locale: string) =>
  ["stock-alerts", locale] as const;

/**
 * Puts a request the API just answered at the head of the list. A read of
 * the list that is still on its way would bring the list from before the
 * request, and the control would read "Notify me" again: it is stopped
 * first. A list that was never read holds this one request only, so it is
 * read afterwards.
 */
export async function rememberStockAlert(
  client: QueryClient,
  locale: string,
  alert: OwnStockAlert,
): Promise<void> {
  const key = stockAlertsQueryKey(locale);
  await client.cancelQueries({ queryKey: key });
  const known = client.getQueryData<OwnStockAlert[]>(key);
  client.setQueryData<OwnStockAlert[]>(key, [
    alert,
    ...(known ?? []).filter((entry) => entry.id !== alert.id),
  ]);
  if (!known) void client.invalidateQueries({ queryKey: key });
}

/**
 * Takes a request off the list once the API took it back. A read that is
 * still on its way is stopped first, for the same reason.
 */
export async function forgetStockAlert(
  client: QueryClient,
  locale: string,
  id: Id,
): Promise<void> {
  const key = stockAlertsQueryKey(locale);
  await client.cancelQueries({ queryKey: key });
  client.setQueryData<OwnStockAlert[]>(key, (known) =>
    known?.filter((entry) => entry.id !== id),
  );
}
