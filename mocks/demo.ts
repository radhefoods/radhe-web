// A demo account for looking at the account pages: signing in as
// demo@radhefoods.de with the password below gives a profile, an address and
// orders in the states a customer meets. Invented data, created the first
// time someone signs up or signs in as the demo customer.

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
  hashPassword,
  legalDocuments,
  newCustomer,
  type CustomerRecord,
  type OrderRecord,
} from "./state.ts";
import { billOf, findVariant } from "./views.ts";

export const DEMO_EMAIL = "demo@radhefoods.de";
/** Not a secret: the mock creates the account with it at the first sign-in. */
export const DEMO_PASSWORD = "Radhe-Foods-2026";

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
  const bill = billOf(items, customer.locale, customer);
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

    // RF-1087: paid with the code DIWALI10, on its way with a parcel service.
    customer.discountCode = "DIWALI10";
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

  // Reviews (doc 22): hers of the delivered basmati, published with a
  // reply, and one of the toor dal that waits; one by another customer.
  const basmati = findVariant(SKU.basmati5kg)!.product.id;
  const toorDal = findVariant(SKU.toorDal1kg)!.product.id;
  db.reviews.set("66fb0000000000000000e001", {
    id: "66fb0000000000000000e001",
    customerId: customer.id,
    productId: basmati,
    orderNumber: "RF-1085",
    rating: 5,
    title: "Fluffy and fragrant",
    text: "Long grains, cooks evenly and smells wonderful. The 5 kg bag keeps well.",
    locale: "en",
    status: "published",
    rejectionNote: null,
    reply: {
      text: "Thank you, Priya! We are glad it cooked well for you.",
      at: daysAgo(6),
    },
    createdAt: daysAgo(8),
    updatedAt: daysAgo(8),
    publishedAt: daysAgo(7),
    editedAt: null,
  });
  db.reviews.set("66fb0000000000000000e002", {
    id: "66fb0000000000000000e002",
    customerId: customer.id,
    productId: toorDal,
    orderNumber: "RF-1085",
    rating: 4,
    title: null,
    text: "Good quality dal, cooks in twenty minutes in the pressure cooker.",
    locale: "en",
    status: "pending",
    rejectionNote: null,
    reply: null,
    createdAt: daysAgo(1),
    updatedAt: daysAgo(1),
    publishedAt: null,
    editedAt: null,
  });
  const meera = newCustomer({
    email: "meera@example.com",
    locale: "en",
    firstName: "Meera",
    lastName: "Patel",
    passwordHash: hashPassword("Mangoes-in-May-2026"),
  });
  db.reviews.set("66fb0000000000000000e003", {
    id: "66fb0000000000000000e003",
    customerId: meera.id,
    productId: basmati,
    orderNumber: null,
    rating: 4,
    title: "Very good rice",
    text: "Slightly less aroma than the brand I used before, but excellent value.",
    locale: "en",
    status: "published",
    rejectionNote: null,
    reply: null,
    createdAt: daysAgo(20),
    updatedAt: daysAgo(20),
    publishedAt: daysAgo(19),
    editedAt: null,
  });

  // Two lists (doc 16.2): the favourites the heart fills, and one of her own.
  const productOf = (variantId: string) => findVariant(variantId)!.product.id;
  const now = new Date().toISOString();
  customer.wishlists = [
    {
      id: "66fa0000000000000000d001",
      name: customer.locale === "de" ? "Meine Favoriten" : "My Favourites",
      isDefault: true,
      items: [
        {
          productId: productOf(SKU.basmati5kg),
          variantId: SKU.basmati5kg,
          addedAt: now,
        },
        { productId: productOf(SKU.toorDal1kg), variantId: null, addedAt: now },
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "66fa0000000000000000d002",
      name: "Diwali",
      isDefault: false,
      items: [
        { productId: productOf(SKU.khakhra), variantId: null, addedAt: now },
      ],
      createdAt: now,
      updatedAt: now,
    },
  ];
}
