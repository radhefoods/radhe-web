import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import de from "../../messages/de.json";
import en from "../../messages/en.json";

// The texts of delivery by the box
// (doc/BOX_BASED_SHIPPING_WEB_INTEGRATION.md, 5, 6, 9 and 10), written out
// in both languages with one and with several boxes: a plural that reads
// wrong, or a message that does not parse, shows here and not in a cart
// that happens to need five boxes.

const english = createTranslator({ locale: "en", messages: en });
const german = createTranslator({ locale: "de", messages: de });

describe("the free-delivery progress", () => {
  it("names a free-delivery code, with and without a saving", () => {
    const values = { code: "FREESHIP", amount: "€4.99" };
    expect(english("cart.shipping.freeByCode", values)).toBe(
      "Free delivery with code FREESHIP. You save €4.99.",
    );
    expect(english("cart.shipping.freeByCodeOnly", values)).toBe(
      "Free delivery with code FREESHIP.",
    );
    expect(
      german("cart.shipping.freeByCode", {
        code: "FREESHIP",
        amount: "4,99 €",
      }),
    ).toBe("Kostenlose Lieferung mit dem Code FREESHIP. Sie sparen 4,99 €.");
    expect(german("cart.shipping.freeByCodeOnly", values)).toBe(
      "Kostenlose Lieferung mit dem Code FREESHIP.",
    );
  });

  it("says that the order ships free", () => {
    expect(english("cart.shipping.freeOne")).toBe(
      "Great, this order ships free!",
    );
    expect(english("cart.shipping.freeAll", { count: 2 })).toBe(
      "Great, all 2 boxes ship free!",
    );
    expect(german("cart.shipping.freeOne")).toBe(
      "Super, diese Bestellung wird kostenlos geliefert!",
    );
    expect(german("cart.shipping.freeAll", { count: 3 })).toBe(
      "Super, alle 3 Boxen werden kostenlos geliefert!",
    );
  });

  it("states the fee where no box is free by value, without a sum for one box", () => {
    expect(
      english("cart.shipping.noThreshold", {
        count: 1,
        fee: "€4.99",
        perBox: "€4.99",
      }),
    ).toBe("Delivery: €4.99");
    expect(
      english("cart.shipping.noThreshold", {
        count: 2,
        fee: "€9.98",
        perBox: "€4.99",
      }),
    ).toBe("Delivery: €9.98 (2 × €4.99)");
    expect(
      german("cart.shipping.noThreshold", {
        count: 1,
        fee: "4,99 €",
        perBox: "4,99 €",
      }),
    ).toBe("Lieferung: 4,99 €");
    expect(
      german("cart.shipping.noThreshold", {
        count: 2,
        fee: "9,98 €",
        perBox: "4,99 €",
      }),
    ).toBe("Lieferung: 9,98 € (2 × 4,99 €)");
  });

  it("asks for what is missing, with the amount set apart", () => {
    const strong = (chunks: string) => `<b>${chunks}</b>`;
    expect(
      english.markup("cart.shipping.oneBox", { amount: "€29.00", strong }),
    ).toBe("Add <b>€29.00</b> more and this order ships free.");
    expect(
      english.markup("cart.shipping.noneFree", { amount: "€9.00", strong }),
    ).toBe("Add <b>€9.00</b> more and the first box ships free.");
    expect(
      english.markup("cart.shipping.someFree", {
        amount: "€19.00",
        number: 2,
        strong,
      }),
    ).toBe("Add <b>€19.00</b> more and box 2 ships free too.");
    expect(
      german.markup("cart.shipping.oneBox", { amount: "29,00 €", strong }),
    ).toBe("Noch <b>29,00 €</b> bis zur kostenlosen Lieferung.");
    expect(
      german.markup("cart.shipping.noneFree", { amount: "9,00 €", strong }),
    ).toBe("Noch <b>9,00 €</b>, dann ist die erste Box kostenlos.");
    expect(
      german.markup("cart.shipping.someFree", {
        amount: "19,00 €",
        number: 2,
        strong,
      }),
    ).toBe("Noch <b>19,00 €</b>, dann ist auch Box 2 kostenlos.");
  });

  it("says how the boxes of the order come about", () => {
    expect(
      english("cart.shipping.noneFreeNote", { count: 2, perBox: "€4.99" }),
    ).toBe("This order needs 2 boxes at €4.99 each.");
    expect(
      english("cart.shipping.someFreeNote", {
        count: 2,
        free: 1,
        paid: 1,
        perBox: "€4.99",
      }),
    ).toBe("This order needs 2 boxes: 1 free, 1 at €4.99.");
    expect(
      english("cart.shipping.someFreeNote", {
        count: 5,
        free: 3,
        paid: 2,
        perBox: "€4.99",
      }),
    ).toBe("This order needs 5 boxes: 3 free, 2 at €4.99 each.");
    expect(
      german("cart.shipping.noneFreeNote", { count: 2, perBox: "4,99 €" }),
    ).toBe("Diese Bestellung braucht 2 Boxen für je 4,99 €.");
    expect(
      german("cart.shipping.someFreeNote", {
        count: 2,
        free: 1,
        paid: 1,
        perBox: "4,99 €",
      }),
    ).toBe("Diese Bestellung braucht 2 Boxen: 1 kostenlos, 1 für 4,99 €.");
    expect(
      german("cart.shipping.someFreeNote", {
        count: 5,
        free: 3,
        paid: 2,
        perBox: "4,99 €",
      }),
    ).toBe("Diese Bestellung braucht 5 Boxen: 3 kostenlos, 2 für je 4,99 €.");
    expect(english("cart.shipping.perFreeBox", { amount: "€39.00" })).toBe(
      "€39.00 per free box",
    );
    expect(german("cart.shipping.perFreeBox", { amount: "39,00 €" })).toBe(
      "39,00 € je kostenlose Box",
    );
  });

  it("says what a code or coins cost in free boxes", () => {
    expect(
      english("cart.shipping.lostByCode", { count: 1, amount: "€7.80" }),
    ).toBe(
      "With this discount one box is no longer free. Add €7.80 more to get it free again.",
    );
    expect(
      english("cart.shipping.lostByCode", { count: 2, amount: "€7.80" }),
    ).toBe(
      "With this discount 2 boxes are no longer free. Add €7.80 more to get one of them free again.",
    );
    expect(
      english("cart.shipping.lostByCoins", { count: 1, amount: "€1.95" }),
    ).toBe(
      "With these coins one box is no longer free. Add €1.95 more to get it free again.",
    );
    expect(
      english("cart.shipping.lostByCoins", { count: 2, amount: "€1.95" }),
    ).toBe(
      "With these coins 2 boxes are no longer free. Add €1.95 more to get one of them free again.",
    );
    expect(
      german("cart.shipping.lostByCode", { count: 1, amount: "7,80 €" }),
    ).toBe(
      "Mit diesem Rabatt ist eine Box nicht mehr kostenlos. Noch 7,80 €, dann ist sie es wieder.",
    );
    expect(
      german("cart.shipping.lostByCode", { count: 2, amount: "7,80 €" }),
    ).toBe(
      "Mit diesem Rabatt sind 2 Boxen nicht mehr kostenlos. Noch 7,80 €, dann ist eine davon wieder kostenlos.",
    );
    expect(
      german("cart.shipping.lostByCoins", { count: 1, amount: "1,95 €" }),
    ).toBe(
      "Mit diesen Coins ist eine Box nicht mehr kostenlos. Noch 1,95 €, dann ist sie es wieder.",
    );
    expect(
      german("cart.shipping.lostByCoins", { count: 2, amount: "1,95 €" }),
    ).toBe(
      "Mit diesen Coins sind 2 Boxen nicht mehr kostenlos. Noch 1,95 €, dann ist eine davon wieder kostenlos.",
    );
  });
});

describe("the boxes", () => {
  it("names one box and several", () => {
    expect(english("cart.shipping.boxesTitle", { count: 1 })).toBe("Your box");
    expect(english("cart.shipping.boxesTitle", { count: 4 })).toBe(
      "Your boxes",
    );
    expect(german("cart.shipping.boxesTitle", { count: 1 })).toBe("Ihre Box");
    expect(german("cart.shipping.boxesTitle", { count: 4 })).toBe("Ihre Boxen");
    expect(english("cart.shipping.box", { number: 3 })).toBe("Box 3");
    expect(german("cart.shipping.box", { number: 3 })).toBe("Box 3");
    expect(english("cart.shipping.separate")).toBe("Separate parcel");
    expect(german("cart.shipping.separate")).toBe("Eigenes Paket");
  });

  it("says how full they are and what still fits", () => {
    expect(
      english("cart.shipping.load", { weight: "2.1 kg", max: "25 kg" }),
    ).toBe("2.1 kg of 25 kg");
    expect(
      german("cart.shipping.load", { weight: "2,1 kg", max: "25 kg" }),
    ).toBe("2,1 kg von 25 kg");
    expect(english("cart.shipping.roomOne", { room: "7.5 kg" })).toBe(
      "7.5 kg of room left in your box.",
    );
    expect(german("cart.shipping.roomOne", { room: "7,5 kg" })).toBe(
      "In der Box ist noch Platz für 7,5 kg.",
    );
    expect(
      english("cart.shipping.roomSeveral", { number: 2, room: "19.9 kg" }),
    ).toBe("Box 2 has 19.9 kg of room left.");
    expect(
      german("cart.shipping.roomSeveral", { number: 2, room: "19,9 kg" }),
    ).toBe("In Box 2 ist noch Platz für 19,9 kg.");
    expect(english("cart.shipping.full", { count: 1 })).toBe(
      "Your box is full. The next item starts a new box.",
    );
    expect(english("cart.shipping.full", { count: 3 })).toBe(
      "Your boxes are full. The next item starts a new box.",
    );
    expect(german("cart.shipping.full", { count: 1 })).toBe(
      "Die Box ist voll. Der nächste Artikel kommt in eine neue Box.",
    );
    expect(german("cart.shipping.full", { count: 3 })).toBe(
      "Die Boxen sind voll. Der nächste Artikel kommt in eine neue Box.",
    );
    expect(english("cart.shipping.more", { count: 10 })).toBe("… and 10 more");
    expect(german("cart.shipping.more", { count: 10 })).toBe(
      "… und 10 weitere",
    );
    expect(english("cart.shipping.approximate")).toBe("Weight is approximate.");
    expect(german("cart.shipping.approximate")).toBe("Gewicht ungefähr.");
  });
});

describe("the delivery of the bill", () => {
  it("counts the boxes under the delivery", () => {
    expect(
      english("cart.shipping.summary", { count: 2, free: 1, paid: 1 }),
    ).toBe("2 boxes: 1 free, 1 paid");
    expect(english("cart.shipping.summaryAllFree", { count: 2 })).toBe(
      "2 boxes, all free",
    );
    expect(
      english("cart.shipping.summaryNoneFree", { count: 2, perBox: "€4.99" }),
    ).toBe("2 boxes at €4.99 each");
    expect(
      english("cart.shipping.summaryWithCode", { count: 2, code: "FREESHIP" }),
    ).toBe("2 boxes, free with code FREESHIP");
    expect(english("cart.shipping.withCode", { code: "FREESHIP" })).toBe(
      "with code FREESHIP",
    );
    expect(
      german("cart.shipping.summary", { count: 2, free: 1, paid: 1 }),
    ).toBe("2 Boxen: 1 kostenlos, 1 kostenpflichtig");
    expect(german("cart.shipping.summaryAllFree", { count: 2 })).toBe(
      "2 Boxen, alle kostenlos",
    );
    expect(
      german("cart.shipping.summaryNoneFree", { count: 2, perBox: "4,99 €" }),
    ).toBe("2 Boxen für je 4,99 €");
    expect(
      german("cart.shipping.summaryWithCode", { count: 2, code: "FREESHIP" }),
    ).toBe("2 Boxen, kostenlos mit Code FREESHIP");
    expect(german("cart.shipping.withCode", { code: "FREESHIP" })).toBe(
      "mit Code FREESHIP",
    );
  });

  it("says in one line what an order was placed with", () => {
    const two = {
      count: 2,
      weight: "41.1 kg",
      free: 1,
      paid: 1,
      perBox: "€4.99",
    };
    expect(english("orders.boxes.mixed", two)).toBe(
      "Delivery: 2 boxes, 41.1 kg — 1 free, 1 × €4.99",
    );
    expect(english("orders.boxes.allFree", { ...two, count: 1 })).toBe(
      "Delivery: 1 box, 41.1 kg — free",
    );
    expect(english("orders.boxes.allPaid", { ...two, paid: 2 })).toBe(
      "Delivery: 2 boxes, 41.1 kg — 2 × €4.99",
    );
    expect(english("orders.boxes.byCode", { ...two, code: "FREESHIP" })).toBe(
      "Delivery: 2 boxes, 41.1 kg — free with code FREESHIP",
    );
    const zwei = {
      count: 2,
      weight: "41,1 kg",
      free: 1,
      paid: 1,
      perBox: "4,99 €",
    };
    expect(german("orders.boxes.mixed", zwei)).toBe(
      "Lieferung: 2 Boxen, 41,1 kg — 1 kostenlos, 1 × 4,99 €",
    );
    expect(german("orders.boxes.allFree", { ...zwei, count: 1 })).toBe(
      "Lieferung: 1 Box, 41,1 kg — kostenlos",
    );
    expect(german("orders.boxes.allPaid", { ...zwei, paid: 2 })).toBe(
      "Lieferung: 2 Boxen, 41,1 kg — 2 × 4,99 €",
    );
    expect(german("orders.boxes.byCode", { ...zwei, code: "FREESHIP" })).toBe(
      "Lieferung: 2 Boxen, 41,1 kg — kostenlos mit Code FREESHIP",
    );
  });
});

describe("what the shop promises and refuses", () => {
  it("says 'per box' where delivery is priced by the box", () => {
    const values = { amount: "€39.00", weight: "25 kg", fee: "€4.99" };
    expect(english("home.trustFreeBox", values)).toBe(
      "Free delivery from €39.00 per box (up to 25 kg)",
    );
    expect(english("product.info.freeFromBox", values)).toBe(
      "Free from €39.00 per box (up to 25 kg)",
    );
    expect(english("product.info.feeBox", values)).toBe(
      "Delivery €4.99 per box (up to 25 kg)",
    );
    expect(english("home.card.perBox", values)).toBe("Per box of up to 25 kg");
    const werte = { amount: "39,00 €", weight: "25 kg", fee: "4,99 €" };
    expect(german("home.trustFreeBox", werte)).toBe(
      "Kostenlose Lieferung ab 39,00 € pro Box (bis 25 kg)",
    );
    expect(german("product.info.freeFromBox", werte)).toBe(
      "Kostenlos ab 39,00 € pro Box (bis 25 kg)",
    );
    expect(german("product.info.feeBox", werte)).toBe(
      "Lieferung 4,99 € pro Box (bis 25 kg)",
    );
    expect(german("home.card.perBox", werte)).toBe("Pro Box bis 25 kg");
  });

  it("has a sentence for a pack that is too heavy and a country not served", () => {
    expect(english("cart.issue.too_heavy")).toBe(
      "This item is too heavy to be shipped. Please remove it or contact us.",
    );
    expect(german("cart.issue.too_heavy")).toBe(
      "Dieser Artikel ist für den Versand zu schwer. Bitte entfernen Sie ihn oder nehmen Sie Kontakt mit uns auf.",
    );
    expect(english("errors.DELIVERY_COUNTRY_NOT_SERVED")).toBe(
      "We do not deliver to this country yet.",
    );
    expect(german("errors.DELIVERY_COUNTRY_NOT_SERVED")).toBe(
      "In dieses Land liefern wir noch nicht.",
    );
  });
});
