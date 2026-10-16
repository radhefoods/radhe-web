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
  pending_payment: "wheat",
  confirmed: "leaf",
  processing: "leaf",
  dispatched: "forest",
  delivered: "green",
  returned: "mute",
  cancelled: "mute",
};

export const PAYMENT_STATUS_TONE: Record<PaymentStatus, ChipTone> = {
  pending: "wheat",
  authorized: "wheat",
  paid: "green",
  failed: "red",
  refunded: "mute",
};

export const RETURN_STATUS_TONE: Record<ReturnStatus, ChipTone> = {
  requested: "wheat",
  approved: "leaf",
  rejected: "red",
  completed: "green",
  cancelled: "mute",
};

/**
 * Whether the payment chip adds anything to the status chip: not while the
 * order waits for its payment (the status says it), and not for a cancelled
 * order that never cost anything.
 */
export function showsPaymentChip(
  status: OrderStatus,
  paymentStatus: PaymentStatus,
): boolean {
  if (status === "pending_payment") return false;
  if (status === "cancelled") {
    return paymentStatus === "paid" || paymentStatus === "refunded";
  }
  return true;
}

export type TimelineStepKey =
  | "payment"
  | "confirmed"
  | "processing"
  | "dispatched"
  | "delivered"
  | "returned"
  | "cancelled";

export interface TimelineStep {
  key: TimelineStepKey;
  /** `current` wears the halo; `problem` is shown in red. */
  state: "done" | "current" | "todo" | "problem";
  /** When it happened, where the API tells. */
  at: string | null;
}

/**
 * The progress of an order as steps, the payment first: the payment confirms
 * the order (doc 9). The API gives customers no status history, so the line
 * is built from the status, the payment block and the times the order
 * carries (paid, dispatched, delivered). A step the order has passed counts
 * as done even when its time is unknown.
 */
export function buildTimeline(
  order: Pick<
    OrderDetail,
    "status" | "paymentStatus" | "delivery" | "cancellation" | "payment"
  >,
): TimelineStep[] {
  const { status, paymentStatus, delivery, payment } = order;
  const paid = paymentStatus === "paid" || paymentStatus === "refunded";
  const paymentState: TimelineStep["state"] = paid
    ? "done"
    : paymentStatus === "failed"
      ? "problem"
      : status === "pending_payment"
        ? "current"
        : "todo";
  const paymentStep: TimelineStep = {
    key: "payment",
    state: paymentState,
    at: payment.paidAt,
  };

  if (status === "cancelled") {
    return [
      paymentStep,
      {
        key: "cancelled",
        state: "problem",
        at: order.cancellation?.at ?? null,
      },
    ];
  }

  const position: Record<Exclude<OrderStatus, "cancelled">, number> = {
    pending_payment: 0,
    confirmed: 1,
    processing: 2,
    dispatched: 3,
    delivered: 4,
    returned: 4,
  };
  const reached = position[status];
  const arrived = status === "delivered" || status === "returned";
  const way = (index: number): TimelineStep["state"] => {
    if (index < reached) return "done";
    if (index > reached) return "todo";
    // The step the order is at; a finished delivery is simply done.
    return arrived ? "done" : "current";
  };

  const steps: TimelineStep[] = [
    paymentStep,
    { key: "confirmed", state: way(1), at: paid ? payment.paidAt : null },
    { key: "processing", state: way(2), at: null },
    { key: "dispatched", state: way(3), at: delivery.dispatchedAt },
    { key: "delivered", state: way(4), at: delivery.deliveredAt },
  ];
  if (status === "returned") {
    steps.push({ key: "returned", state: "done", at: null });
  }
  return steps;
}
