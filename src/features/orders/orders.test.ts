import { describe, expect, it } from "vitest";
import type { OrderDetail, OrderStatus, PaymentStatus } from "@/lib/api/types";
import { buildTimeline, showsPaymentChip } from "./orders";

type TimelineOrder = Parameters<typeof buildTimeline>[0];

const PAID_AT = "2026-10-16T10:17:30.000Z";

function order(
  status: OrderStatus,
  paymentStatus: PaymentStatus,
  extra: Partial<TimelineOrder> = {},
): TimelineOrder {
  const paid = paymentStatus === "paid" || paymentStatus === "refunded";
  const payment: OrderDetail["payment"] = {
    status: paymentStatus,
    amount: 2296,
    paidAmount: paid ? 2296 : 0,
    creditedAmount: 0,
    refundedAmount: paymentStatus === "refunded" ? 2296 : 0,
    method: paid ? "card" : null,
    paidAt: paid ? PAID_AT : null,
    receiptUrl: null,
    invoice: null,
    checkout: null,
    canPayOnline: status === "pending_payment" && paymentStatus !== "paid",
    lastFailure: null,
  };
  return {
    status,
    paymentStatus,
    payment,
    delivery: {
      method: "radhe_delivery",
      trackingNumber: null,
      trackingUrl: null,
      dispatchedAt: null,
      deliveredAt: null,
    },
    cancellation: null,
    ...extra,
  };
}

const states = (steps: ReturnType<typeof buildTimeline>) =>
  steps.map((step) => `${step.key}:${step.state}`);

describe("buildTimeline", () => {
  it("starts with the payment while the order waits for it", () => {
    expect(states(buildTimeline(order("pending_payment", "pending")))).toEqual([
      "payment:current",
      "confirmed:todo",
      "processing:todo",
      "dispatched:todo",
      "delivered:todo",
    ]);
  });

  it("marks a failed attempt as a problem", () => {
    const steps = buildTimeline(order("pending_payment", "failed"));
    expect(steps[0]).toMatchObject({ key: "payment", state: "problem" });
  });

  it("moves along with the status once paid", () => {
    const confirmed = buildTimeline(order("confirmed", "paid"));
    expect(states(confirmed)).toEqual([
      "payment:done",
      "confirmed:current",
      "processing:todo",
      "dispatched:todo",
      "delivered:todo",
    ]);
    expect(confirmed[0].at).toBe(PAID_AT);
    expect(confirmed[1].at).toBe(PAID_AT);

    const dispatched = buildTimeline(
      order("dispatched", "paid", {
        delivery: {
          method: "dhl",
          trackingNumber: "JD1",
          trackingUrl: "https://dhl.example/JD1",
          dispatchedAt: "2026-10-18T08:00:00.000Z",
          deliveredAt: null,
        },
      }),
    );
    expect(states(dispatched)).toEqual([
      "payment:done",
      "confirmed:done",
      "processing:done",
      "dispatched:current",
      "delivered:todo",
    ]);
    expect(dispatched[3].at).toBe("2026-10-18T08:00:00.000Z");
  });

  it("is all done once delivered, and adds the return when everything went back", () => {
    const delivery = {
      method: "radhe_delivery" as const,
      trackingNumber: null,
      trackingUrl: null,
      dispatchedAt: "2026-10-18T08:00:00.000Z",
      deliveredAt: "2026-10-19T15:00:00.000Z",
    };
    const delivered = buildTimeline(order("delivered", "paid", { delivery }));
    expect(states(delivered)).toEqual([
      "payment:done",
      "confirmed:done",
      "processing:done",
      "dispatched:done",
      "delivered:done",
    ]);
    expect(delivered[4].at).toBe("2026-10-19T15:00:00.000Z");

    const returned = buildTimeline(order("returned", "refunded", { delivery }));
    expect(states(returned).at(-1)).toBe("returned:done");
  });

  it("ends a cancelled order after the payment step", () => {
    const paid = buildTimeline(
      order("cancelled", "refunded", {
        cancellation: {
          reason: "changed_mind",
          by: "customer",
          at: "2026-10-17T09:00:00.000Z",
        },
      }),
    );
    expect(states(paid)).toEqual(["payment:done", "cancelled:problem"]);
    expect(paid[1].at).toBe("2026-10-17T09:00:00.000Z");

    const soldOut = buildTimeline(
      order("cancelled", "failed", {
        cancellation: {
          reason: "sold_out",
          by: "system",
          at: "2026-10-16T10:20:00.000Z",
        },
      }),
    );
    expect(states(soldOut)).toEqual(["payment:problem", "cancelled:problem"]);

    const givenUp = buildTimeline(
      order("cancelled", "pending", {
        cancellation: {
          reason: "payment_not_completed",
          by: "system",
          at: "2026-10-17T12:00:00.000Z",
        },
      }),
    );
    expect(states(givenUp)).toEqual(["payment:todo", "cancelled:problem"]);
  });
});

describe("showsPaymentChip", () => {
  it("leaves the chip out where the status says it all", () => {
    expect(showsPaymentChip("pending_payment", "pending")).toBe(false);
    expect(showsPaymentChip("pending_payment", "failed")).toBe(false);
    expect(showsPaymentChip("cancelled", "pending")).toBe(false);
    expect(showsPaymentChip("cancelled", "failed")).toBe(false);
  });

  it("shows it where money is involved", () => {
    expect(showsPaymentChip("confirmed", "paid")).toBe(true);
    expect(showsPaymentChip("cancelled", "paid")).toBe(true);
    expect(showsPaymentChip("cancelled", "refunded")).toBe(true);
    expect(showsPaymentChip("delivered", "refunded")).toBe(true);
  });
});
