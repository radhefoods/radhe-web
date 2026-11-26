"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale } from "next-intl";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { customerNow, useSession } from "@/features/session/session";
import type { Locale } from "@/i18n/routing";
import { api } from "@/lib/api/browser";
import { hasErrorCode } from "@/lib/api/errors";
import type {
  Id,
  Ordering,
  OwnStockAlert,
  StockAlertAsked,
} from "@/lib/api/types";
import {
  forgetStockAlert,
  rememberStockAlert,
  stockAlertsQueryKey,
} from "./list-cache";
import { refusalOf } from "./outcome";

// "Notify me" (doc 26): for a pack size that cannot be ordered, a customer
// asks for one email when it can. A signed-in customer asks with one tap
// and the API remembers it; a visitor gives an address and confirms it by
// a link, and the shop remembers nothing of it in the browser.
//
// The shop offers it only while the settings say so (`stockAlerts.enabled`,
// read on the server and handed down through the provider). Which pack
// sizes a customer waits for is asked once a control that needs the answer
// is on the page, and shared by all of them.

/** A word at the top of the window, for the controls that have no room for one. */
export type StockAlertNotice =
  { tone: "good"; text: string } | { tone: "bad"; error: unknown };

interface StockAlertsValue {
  /** Whether the shop offers "Notify me" at all. */
  offered: boolean;
  /** The API answered that the emails are switched off: every control goes. */
  switchOff: () => void;
  notice: StockAlertNotice | null;
  announce: (notice: StockAlertNotice) => void;
  clearNotice: () => void;
}

// Outside the provider (the checkout, the pages behind email links) the
// feature is simply not there.
const StockAlertsContext = createContext<StockAlertsValue>({
  offered: false,
  switchOff: () => {},
  notice: null,
  announce: () => {},
  clearNotice: () => {},
});

export function StockAlertsProvider({
  enabled,
  children,
}: {
  /** `stockAlerts.enabled` of the settings; `false` for an API without it. */
  enabled: boolean;
  children: ReactNode;
}) {
  const [switchedOff, setSwitchedOff] = useState(false);
  const [notice, setNotice] = useState<StockAlertNotice | null>(null);
  const switchOff = useCallback(() => setSwitchedOff(true), []);
  const clearNotice = useCallback(() => setNotice(null), []);
  const value = useMemo<StockAlertsValue>(
    () => ({
      offered: enabled && !switchedOff,
      switchOff,
      notice,
      announce: setNotice,
      clearNotice,
    }),
    [enabled, switchedOff, switchOff, notice, clearNotice],
  );
  return (
    <StockAlertsContext.Provider value={value}>
      {children}
    </StockAlertsContext.Provider>
  );
}

export function useStockAlerts(): StockAlertsValue {
  return useContext(StockAlertsContext);
}

/**
 * What the signed-in customer waits for, newest first. Asked while the
 * shop offers the emails; the account page asks in any case (`always`),
 * as the API keeps the requests while the emails are switched off.
 */
export function useMyStockAlerts({ always = false } = {}) {
  const locale = useLocale();
  const { offered } = useStockAlerts();
  const session = useSession();
  return useQuery({
    queryKey: stockAlertsQueryKey(locale),
    queryFn: async () => (await api.listMyStockAlerts()).items,
    enabled: (offered || always) && session.status === "customer",
    staleTime: 30_000,
  });
}

/** How a tap on "Notify me" ended. */
export type AskOutcome =
  /** Asked for the customer; the email goes to this address. */
  | { kind: "asked"; email: string }
  /** Nobody is signed in: the form with the address is next. */
  | { kind: "visitor" }
  /** The pack size can be ordered again. */
  | { kind: "back" }
  /** The control is gone (the feature is off, or the pack size left the shop). */
  | { kind: "hidden" }
  | { kind: "error"; error: unknown };

/** How the form of a visitor ended. */
export type VisitorOutcome =
  | { kind: "asked"; answer: StockAlertAsked }
  | { kind: "fields"; email: boolean; consent: boolean }
  | { kind: "back" }
  | { kind: "hidden" }
  | { kind: "error"; error: unknown };

export type CancelOutcome =
  { kind: "cancelled" } | { kind: "error"; error: unknown };

export interface NotifyMe {
  /** False: show nothing of the feature for this pack size. */
  offered: boolean;
  /** The customer's request for this pack size, while it waits. */
  waiting: OwnStockAlert | null;
  /** The pack size can be ordered again: its ordering, for "Add to cart". */
  back: Ordering | null;
  ask: () => Promise<AskOutcome>;
  askAsVisitor: (email: string) => Promise<VisitorOutcome>;
  cancel: () => Promise<CancelOutcome>;
}

/**
 * "Notify me" for one pack size: whether the customer waits for it, and
 * the three things that can be done about it. Every refusal that changes
 * what the control is (the size is back, the feature is off, the size is
 * gone) is handled here; what is left for the caller is a sentence to show.
 */
export function useNotifyMe(variantId: Id): NotifyMe {
  const locale = useLocale() as Locale;
  const client = useQueryClient();
  const session = useSession();
  const { offered, switchOff } = useStockAlerts();
  const alerts = useMyStockAlerts().data;
  // What the API said about pack sizes since the page was rendered.
  const [gone, setGone] = useState<readonly Id[]>([]);
  const [backAgain, setBackAgain] = useState<Readonly<Record<Id, Ordering>>>(
    {},
  );

  const waiting = useMemo(
    () =>
      (session.status === "customer" &&
        alerts?.find((alert) => alert.variantId === variantId)) ||
      null,
    [session.status, alerts, variantId],
  );

  /** The refusals that are not a sentence: `null` when it is one. */
  const settle = useCallback(
    (error: unknown): "back" | "hidden" | "signedOut" | null => {
      const refusal = refusalOf(error);
      if (refusal.kind === "back") {
        const { ordering } = refusal;
        if (ordering) {
          setBackAgain((known) => ({ ...known, [variantId]: ordering }));
        }
        // The product page asks for its pack sizes again and shows the button.
        void client.invalidateQueries({ queryKey: ["product-ordering"] });
        return "back";
      }
      if (refusal.kind === "off") {
        switchOff();
        return "hidden";
      }
      if (refusal.kind === "gone") {
        setGone((known) => [...known, variantId]);
        return "hidden";
      }
      return refusal.kind === "signedOut" ? "signedOut" : null;
    },
    [client, switchOff, variantId],
  );

  const ask = useCallback(async (): Promise<AskOutcome> => {
    const customer =
      session.status === "loading"
        ? await customerNow(client)
        : session.customer;
    if (!customer) return { kind: "visitor" };
    try {
      const { alert } = await api.askMyStockAlert(variantId, locale);
      await rememberStockAlert(client, locale, alert);
      return { kind: "asked", email: customer.email };
    } catch (error) {
      const settled = settle(error);
      if (settled === "signedOut") return { kind: "visitor" };
      return settled ? { kind: settled } : { kind: "error", error };
    }
  }, [session.status, session.customer, client, variantId, locale, settle]);

  const askAsVisitor = useCallback(
    async (email: string): Promise<VisitorOutcome> => {
      try {
        const answer = await api.askStockAlert({
          variantId,
          email,
          consent: true,
          locale,
        });
        return { kind: "asked", answer };
      } catch (error) {
        const refusal = refusalOf(error);
        if (refusal.kind === "fields") return refusal;
        const settled = settle(error);
        return settled === "back" || settled === "hidden"
          ? { kind: settled }
          : { kind: "error", error };
      }
    },
    [variantId, locale, settle],
  );

  const cancel = useCallback(async (): Promise<CancelOutcome> => {
    if (!waiting) return { kind: "cancelled" };
    try {
      await api.cancelMyStockAlert(waiting.id);
      await forgetStockAlert(client, locale, waiting.id);
      return { kind: "cancelled" };
    } catch (error) {
      // Taken back elsewhere meanwhile: it is gone either way.
      if (hasErrorCode(error, "STOCK_ALERT_NOT_FOUND")) {
        await forgetStockAlert(client, locale, waiting.id);
        return { kind: "cancelled" };
      }
      void client.invalidateQueries({ queryKey: stockAlertsQueryKey(locale) });
      return { kind: "error", error };
    }
  }, [waiting, client, locale]);

  return {
    offered: offered && !gone.includes(variantId),
    waiting,
    back: backAgain[variantId] ?? null,
    ask,
    askAsVisitor,
    cancel,
  };
}
