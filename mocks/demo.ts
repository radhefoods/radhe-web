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
import { adjust, grantReview, grantWelcome } from "./rewards.ts";
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

  // The coins (REWARDS): 100 for the sign-up, then what the orders earn.
  grantWelcome(customer);
  const welcomeRow = db.rewardTransactions.find(
    (row) => row.customerId === customer.id && row.type === "welcome",
  );
  if (welcomeRow) welcomeRow.at = daysAgo(45);

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
    const earnedRow = db.rewardTransactions.find(
      (row) => row.key === `order:${delivered.orderNumber}`,
    );
    if (earnedRow) earnedRow.at = daysAgo(10);
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

    // RF-1089: paid and confirmed today, with 59 coins redeemed; can
    // still be cancelled.
    customer.rewardCoins = { requested: 59 };
    paidOrder(
      customer,
      [
        { variantId: SKU.chakkiAtta5kg, quantity: 1 },
        { variantId: SKU.basmati5kg, quantity: 1 },
      ],
      0,
      mockBase,
    );
    customer.rewardCoins = null;

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

  // Reviews (doc ORDER_REVIEWS): hers of the delivered RF-1085, published
  // with a reply; two by another customer of orders of her own, one of
  // them still waiting, so the public list has more than one voice.
  db.reviews.set("66fb0000000000000000e001", {
    id: "66fb0000000000000000e001",
    customerId: customer.id,
    orderNumber: "RF-1085",
    rating: 5,
    text: "Everything arrived fresh and well packed. The basmati cooks evenly and the mango drink was a hit with the children.",
    locale: "en",
    status: "published",
    rejectionNote: null,
    reply: {
      text: "Thank you, Priya! We are glad it all arrived well.",
      at: daysAgo(6),
    },
    writtenAt: daysAgo(8),
    updatedAt: daysAgo(8),
    publishedAt: daysAgo(7),
  });
  // The published review earned its coins; and Radhe Foods once added
  // some by hand.
  grantReview(db.reviews.get("66fb0000000000000000e001")!);
  const reviewRow = db.rewardTransactions.find(
    (row) => row.key === "review:66fb0000000000000000e001",
  );
  if (reviewRow) reviewRow.at = daysAgo(7);
  const goodwill = adjust(
    customer,
    50,
    "goodwill",
    "Thank you for your patience with the dented cartons.",
  );
  if (goodwill) goodwill.at = daysAgo(4);
  const meera = newCustomer({
    email: "meera@example.com",
    locale: "en",
    firstName: "Meera",
    lastName: "Patel",
    passwordHash: hashPassword("Mangoes-in-May-2026"),
  });
  db.reviews.set("66fb0000000000000000e002", {
    id: "66fb0000000000000000e002",
    customerId: meera.id,
    orderNumber: "RF-1042",
    rating: 4,
    text: "Good selection and quick delivery. One packet of khakhra was a little crushed, but everything else was perfect.",
    locale: "en",
    status: "published",
    rejectionNote: null,
    reply: null,
    writtenAt: daysAgo(20),
    updatedAt: daysAgo(20),
    publishedAt: daysAgo(19),
  });
  db.reviews.set("66fb0000000000000000e003", {
    id: "66fb0000000000000000e003",
    customerId: meera.id,
    orderNumber: "RF-1051",
    rating: 5,
    text: "Lovely sweets, the kaju katli was gone within a day.",
    locale: "en",
    status: "pending",
    rejectionNote: null,
    reply: null,
    writtenAt: daysAgo(1),
    updatedAt: daysAgo(1),
    publishedAt: null,
  });

  // A problem report on the delivered order (doc 23), resolved with a refund.
  const deliveredOrder = [...db.orders.values()].find(
    (record) =>
      record.customerId === customer.id && record.delivery.deliveredAt,
  );
  if (deliveredOrder) {
    const drink = deliveredOrder.items.find(
      (item) => item.variantId === SKU.mangoDrink,
    );
    if (drink) {
      db.issues.set(`${deliveredOrder.orderNumber}-P1`, {
        issueNumber: `${deliveredOrder.orderNumber}-P1`,
        orderNumber: deliveredOrder.orderNumber,
        customerId: customer.id,
        status: "resolved",
        reportedAt: daysAgo(9),
        decidedAt: daysAgo(8),
        items: [
          {
            productId: drink.productId,
            variantId: drink.variantId,
            sku: drink.sku,
            name: drink.name,
            packValue: drink.packValue,
            packUnit: drink.packUnit,
            quantity: 1,
            refundedQuantity: 1,
            unitPrice: drink.unitPrice,
          },
        ],
        problems: ["damaged"],
        description: "One carton arrived crushed and leaking at the bottom.",
        imageIds: [],
        preferredResolution: "refund",
        resolution: {
          type: "refund",
          amount: drink.unitPrice,
          note: "Sorry about that! The carton is refunded.",
          at: daysAgo(8),
        },
        history: [
          { status: "open", at: daysAgo(9), by: "customer", note: null },
          { status: "in_review", at: daysAgo(9), by: "admin", note: null },
          {
            status: "resolved",
            at: daysAgo(8),
            by: "admin",
            note: "Sorry about that! The carton is refunded.",
          },
        ],
        locale: customer.locale,
      });
    }
  }

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
