// A demo account for looking at the account pages: signing in as
// demo@radhefoods.de (code 123456) gives a profile, an address and orders in
// the states a customer meets. Invented data, created at the first sign-in.

import { SKU } from "./data/catalogue.ts";
import { addresses, placeOrder } from "./orders.ts";
import { advanceOrder, createReturn, markPaid } from "./payments.ts";
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

function order(
  customer: CustomerRecord,
  items: { productId: string; quantity: number }[],
  placedDaysAgo: number,
  shopUrl: string,
): OrderRecord {
  customer.cart = items;
  const bill = billOf(items, customer.locale);
  const { body } = placeOrder(
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
    shopUrl,
  );
  const record = db.orders.get(body.order.orderNumber)!;
  record.placedAt = daysAgo(placedDaysAgo);
  record.consent.at = record.placedAt;
  return record;
}

export function seedDemoAccount(
  customer: CustomerRecord,
  shopUrl: string,
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
    // Delivered and paid by card, with a return request waiting.
    const paid = order(
      customer,
      [
        { productId: SKU.basmati5kg, quantity: 1 },
        { productId: SKU.toorDal1kg, quantity: 2 },
        { productId: SKU.mangoDrink, quantity: 6 },
      ],
      40,
      shopUrl,
    );
    advanceOrder(paid, "deliver");
    paid.delivery.dispatchedAt = daysAgo(11);
    paid.delivery.deliveredAt = daysAgo(10);
    advanceOrder(paid, "activate");
    markPaid(paid, "stripe", "card");
    paid.payment!.paidAt = daysAgo(8);
    createReturn(
      paid,
      {
        items: [
          {
            productId: SKU.mangoDrink,
            quantity: 2,
            reason: "damaged",
            comment: "Two cartons were dented and leaking.",
          },
        ],
      },
      customer.locale,
    );

    // Delivered, invoice issued, to be paid within a few days.
    const due = order(
      customer,
      [
        { productId: SKU.chakkiAtta5kg, quantity: 2 },
        { productId: SKU.khakhra, quantity: 2 },
      ],
      21,
      shopUrl,
    );
    advanceOrder(due, "deliver");
    due.delivery.dispatchedAt = daysAgo(3);
    due.delivery.deliveredAt = daysAgo(2);
    advanceOrder(due, "activate");

    // On its way with a parcel service.
    const onItsWay = order(
      customer,
      [{ productId: SKU.basmati1kg, quantity: 3 }],
      9,
      shopUrl,
    );
    onItsWay.delivery.method = "dhl";
    advanceOrder(onItsWay, "dispatch");
    onItsWay.delivery.dispatchedAt = daysAgo(1);

    // Cancelled by the customer.
    const cancelled = order(
      customer,
      [{ productId: SKU.toorDal1kg, quantity: 1 }],
      5,
      shopUrl,
    );
    cancelled.status = "cancelled";
    cancelled.cancellation = {
      reason: "ordered_by_mistake",
      text: null,
      by: "customer",
      at: daysAgo(5),
    };

    // Just confirmed: can still be cancelled.
    order(
      customer,
      [
        { productId: SKU.chakkiAtta5kg, quantity: 1 },
        { productId: SKU.basmati5kg, quantity: 1 },
      ],
      0,
      shopUrl,
    );
  } catch {
    // Ordering is closed in the mock right now: the demo account stays
    // without orders rather than failing the sign-in.
  }
  customer.cart = [];
}
