// A demo account for looking at the account pages: signing in as
// demo@radhefoods.de (code 123456) gives a profile, an address and orders in
// the states a customer meets. Invented data, created at the first sign-in.

import { SKU } from "./data/catalogue.ts";
import { addresses, checkout } from "./orders.ts";
import {
  advanceOrder,
  cancelSoldOut,
  createReturn,
  refundOrder,
  releaseStock,
  settlePayment,
} from "./payments.ts";
import {
  db,
  legalDocuments,
  type CustomerRecord,
  type OrderRecord,
} from "./state.ts";
import { billOf } from "./views.ts";

export const DEMO_EMAIL = "demo@radhefoods.de";

const DAY = 86_400_000;
const daysAgo = (days: number) =>
  new Date(Date.now() - days * DAY).toISOString();

/** A checkout of these items: the order waits for its payment. */
function order(
  customer: CustomerRecord,
  items: { variantId: string; quantity: number }[],
  placedDaysAgo: number,
  mockBase: string,
): OrderRecord {
  customer.cart = items;
  const bill = billOf(items, customer.locale);
  const { body } = checkout(
    customer,
    `demo-order-${db.orderSequence + 1}`,
    {
      addressId: customer.addresses[0].id,
      expectedTotal: bill.totals.total,
      consent: {
        accepted: true,
        versions: Object.fromEntries(
          legalDocuments.map((document) => [document.type, document.version]),
        ),
      },
    },
    customer.locale,
    mockBase,
  );
  const record = db.orders.get(body.order.orderNumber)!;
  record.placedAt = daysAgo(placedDaysAgo);
  record.consent.at = record.placedAt;
  return record;
}

/** A checkout paid by card right away: the order is confirmed. */
function paidOrder(
  customer: CustomerRecord,
  items: { variantId: string; quantity: number }[],
  placedDaysAgo: number,
  mockBase: string,
): OrderRecord {
  const record = order(customer, items, placedDaysAgo, mockBase);
  settlePayment(record, "card");
  record.payment.paidAt = record.placedAt;
  return record;
}

export function seedDemoAccount(
  customer: CustomerRecord,
  mockBase: string,
): void {
  customer.firstName = "Priya";
  customer.lastName = "Shah";
  customer.phone = "+4915112345678";
  addresses.create(customer, {
    firstName: "Priya",
    lastName: "Shah",
    street: "Hauptstraße",
    houseNumber: "12",
    additionalLine: "2. OG",
    postalCode: "60311",
    city: "Frankfurt am Main",
    phone: "+4915112345678",
  });

  try {
    // RF-1085: delivered and paid by card, with a return request waiting.
    const delivered = paidOrder(
      customer,
      [
        { variantId: SKU.basmati5kg, quantity: 1 },
        { variantId: SKU.toorDal1kg, quantity: 2 },
        { variantId: SKU.mangoDrink, quantity: 6 },
      ],
      40,
      mockBase,
    );
    advanceOrder(delivered, "deliver");
    delivered.delivery.dispatchedAt = daysAgo(11);
    delivered.delivery.deliveredAt = daysAgo(10);
    createReturn(
      delivered,
      {
        items: [
          {
            variantId: SKU.mangoDrink,
            quantity: 2,
            reason: "damaged",
            comment: "Two cartons were dented and leaking.",
          },
        ],
      },
      customer.locale,
    );

    // RF-1086: waiting for its payment, the payment page is open.
    order(
      customer,
      [
        { variantId: SKU.chakkiAtta5kg, quantity: 2 },
        { variantId: SKU.khakhra, quantity: 2 },
      ],
      0,
      mockBase,
    );

    // RF-1087: paid, on its way with a parcel service.
    const onItsWay = paidOrder(
      customer,
      [{ variantId: SKU.basmati1kg, quantity: 3 }],
      9,
      mockBase,
    );
    onItsWay.delivery.method = "dhl";
    advanceOrder(onItsWay, "dispatch");
    onItsWay.delivery.dispatchedAt = daysAgo(1);

    // RF-1088: paid, then cancelled by the customer; the money went back.
    const cancelled = paidOrder(
      customer,
      [{ variantId: SKU.toorDal1kg, quantity: 1 }],
      5,
      mockBase,
    );
    releaseStock(cancelled);
    cancelled.status = "cancelled";
    cancelled.cancellation = {
      reason: "ordered_by_mistake",
      text: null,
      by: "customer",
      at: daysAgo(5),
    };
    refundOrder(cancelled);

    // RF-1089: paid and confirmed today; can still be cancelled.
    paidOrder(
      customer,
      [
        { variantId: SKU.chakkiAtta5kg, quantity: 1 },
        { variantId: SKU.basmati5kg, quantity: 1 },
      ],
      0,
      mockBase,
    );

    // RF-1090: a product sold out before the payment was captured.
    const gone = order(
      customer,
      [{ variantId: SKU.mangoDrink, quantity: 6 }],
      2,
      mockBase,
    );
    cancelSoldOut(gone);
    gone.cancellation!.at = daysAgo(2);
  } catch {
    // Online payment is switched off in the mock: the demo account stays
    // without orders rather than failing the sign-in.
  }
  customer.cart = [];
}
