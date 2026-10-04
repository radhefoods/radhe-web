import { describe, expect, it } from "vitest";
import type { OrderDetail, OrderStatus, PaymentStatus } from "@/lib/api/types";
import { buildTimeline } from "./orders";

type Input = Parameters<typeof buildTimeline>[0];

function order(
  status: OrderStatus,
  paymentStatus: PaymentStatus = "not_enabled",
  extra: Partial<Input> = {},
): Input {
  return {
    status,
    paymentStatus,
    placedAt: "2026-09-28T10:15:00.000Z",
    delivery: {
      method: "dhl",
      trackingNumber: null,
      trackingUrl: null,
      dispatchedAt: null,
      deliveredAt: null,
      promisedStart: "2026-10-20",
      promisedEnd: "2026-10-24",
      cargo: "RF-C027",
    },
    cancellation: null,
    payment: { paidAt: null } as OrderDetail["payment"],
    ...extra,
  };
}

const states = (input: Input) =>
  buildTimeline(input).map((step) => `${step.key}:${step.state}`);

describe("buildTimeline", () => {
  it("starts at the confirmed pre-order", () => {
    expect(states(order("confirmed"))).toEqual([
      "confirmed:current",
      "preparing:todo",
      "dispatched:todo",
      "delivered:todo",
      "payment:todo",
    ]);
  });

  it("moves along with the status", () => {
    expect(states(order("preparing"))).toEqual([
      "confirmed:done",
      "preparing:current",
      "dispatched:todo",
      "delivered:todo",
      "payment:todo",
    ]);
    expect(states(order("dispatched"))).toEqual([
      "confirmed:done",
      "preparing:done",
      "dispatched:current",
      "delivered:todo",
      "payment:todo",
    ]);
  });

  it("waits for the payment after delivery", () => {
    expect(states(order("delivered"))).toEqual([
      "confirmed:done",
      "preparing:done",
      "dispatched:done",
      "delivered:done",
      "payment:current",
    ]);
    expect(states(order("delivered", "due")).at(-1)).toBe("payment:current");
  });

  it("marks an overdue payment as a problem and a settled one as done", () => {
    expect(states(order("delivered", "overdue")).at(-1)).toBe(
      "payment:problem",
    );
    for (const settled of ["paid", "waived", "refunded"] as const) {
      expect(states(order("delivered", settled)).at(-1)).toBe("payment:done");
    }
  });

  it("shows a failed delivery between dispatch and delivery", () => {
    expect(states(order("delivery_failed"))).toEqual([
      "confirmed:done",
      "preparing:done",
      "dispatched:done",
      "delivery_failed:problem",
      "delivered:todo",
      "payment:todo",
    ]);
  });

  it("ends a cancelled order after the confirmation", () => {
    const steps = buildTimeline(
      order("cancelled", "not_enabled", {
        cancellation: {
          reason: "changed_mind",
          by: "customer",
          at: "2026-09-29T08:00:00.000Z",
        },
      }),
    );
    expect(steps).toEqual([
      { key: "confirmed", state: "done", at: "2026-09-28T10:15:00.000Z" },
      { key: "cancelled", state: "problem", at: "2026-09-29T08:00:00.000Z" },
    ]);
  });

  it("adds the return when everything went back", () => {
    expect(states(order("returned", "paid"))).toEqual([
      "confirmed:done",
      "preparing:done",
      "dispatched:done",
      "delivered:done",
      "returned:done",
      "payment:done",
    ]);
  });

  it("carries the times the API gives", () => {
    const steps = buildTimeline(
      order("delivered", "paid", {
        delivery: {
          ...order("delivered").delivery,
          dispatchedAt: "2026-10-21T08:00:00.000Z",
          deliveredAt: "2026-10-22T12:00:00.000Z",
        },
        payment: {
          paidAt: "2026-10-25T09:00:00.000Z",
        } as OrderDetail["payment"],
      }),
    );
    expect(steps.map((step) => step.at)).toEqual([
      "2026-09-28T10:15:00.000Z",
      null,
      "2026-10-21T08:00:00.000Z",
      "2026-10-22T12:00:00.000Z",
      "2026-10-25T09:00:00.000Z",
    ]);
  });
});
