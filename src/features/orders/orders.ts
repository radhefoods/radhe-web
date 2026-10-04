import type { ChipTone } from "@/components/ui/chip";
import type {
  OrderDetail,
  OrderStatus,
  PaymentStatus,
  ReturnStatus,
} from "@/lib/api/types";

// What the account pages share about orders: the keys of their cached
// answers, the colour of each status, and the steps of the progress line.

export const ordersQueryKey = (locale: string) => ["orders", locale] as const;
export const orderQueryKey = (orderNumber: string, locale: string) =>
  ["order", orderNumber.toUpperCase(), locale] as const;
export const orderReturnsQueryKey = (orderNumber: string, locale: string) =>
  ["order-returns", orderNumber.toUpperCase(), locale] as const;
export const orderDocumentsQueryKey = (orderNumber: string) =>
  ["order-documents", orderNumber.toUpperCase()] as const;
export const ADDRESSES_QUERY_KEY = ["addresses"] as const;
export const INVOICES_QUERY_KEY = ["invoices"] as const;

export const ORDER_STATUS_TONE: Record<OrderStatus, ChipTone> = {
  confirmed: "blue",
  preparing: "gold",
  dispatched: "navy",
  delivered: "teal",
  delivery_failed: "red",
  returned: "mute",
  cancelled: "mute",
};

export const PAYMENT_STATUS_TONE: Record<PaymentStatus, ChipTone> = {
  not_enabled: "mute",
  due: "gold",
  overdue: "red",
  paid: "teal",
  waived: "mute",
  refunded: "mute",
};

export const RETURN_STATUS_TONE: Record<ReturnStatus, ChipTone> = {
  requested: "gold",
  approved: "blue",
  rejected: "red",
  completed: "teal",
  cancelled: "mute",
};

export type TimelineStepKey =
  | "confirmed"
  | "preparing"
  | "dispatched"
  | "delivery_failed"
  | "delivered"
  | "returned"
  | "cancelled"
  | "payment";

export interface TimelineStep {
  key: TimelineStepKey;
  /** `current` wears the eye of the feather; `problem` is shown in red. */
  state: "done" | "current" | "todo" | "problem";
  /** When it happened, where the API tells. */
  at: string | null;
}

const SETTLED: PaymentStatus[] = ["paid", "waived", "refunded"];

/**
 * The progress of an order as steps. The API gives customers no status
 * history, so the line is built from the status and the three times the
 * order carries (placed, dispatched, delivered). A step the order has
 * passed counts as done even when its time is unknown.
 */
export function buildTimeline(
  order: Pick<
    OrderDetail,
    | "status"
    | "paymentStatus"
    | "placedAt"
    | "delivery"
    | "cancellation"
    | "payment"
  >,
): TimelineStep[] {
  const { status, paymentStatus, delivery } = order;

  if (status === "cancelled") {
    return [
      { key: "confirmed", state: "done", at: order.placedAt },
      {
        key: "cancelled",
        state: "problem",
        at: order.cancellation?.at ?? null,
      },
    ];
  }

  const position: Record<Exclude<OrderStatus, "cancelled">, number> = {
    confirmed: 0,
    preparing: 1,
    dispatched: 2,
    delivery_failed: 2,
    delivered: 3,
    returned: 3,
  };
  const reached = position[status];
  const arrived = status === "delivered" || status === "returned";
  const way = (index: number): TimelineStep["state"] => {
    if (index < reached) return "done";
    if (index > reached) return "todo";
    // The step the order is at; a finished delivery is simply done.
    return arrived || status === "delivery_failed" ? "done" : "current";
  };

  const steps: TimelineStep[] = [
    { key: "confirmed", state: way(0), at: order.placedAt },
    { key: "preparing", state: way(1), at: null },
    { key: "dispatched", state: way(2), at: delivery.dispatchedAt },
  ];
  if (status === "delivery_failed") {
    steps.push({ key: "delivery_failed", state: "problem", at: null });
  }
  steps.push({ key: "delivered", state: way(3), at: delivery.deliveredAt });
  if (status === "returned") {
    steps.push({ key: "returned", state: "done", at: null });
  }

  const paymentState: TimelineStep["state"] = !arrived
    ? "todo"
    : SETTLED.includes(paymentStatus)
      ? "done"
      : paymentStatus === "overdue"
        ? "problem"
        : "current";
  steps.push({ key: "payment", state: paymentState, at: order.payment.paidAt });
  return steps;
}
