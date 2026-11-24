import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import de from "../../messages/de.json";
import en from "../../messages/en.json";

// The texts of delivery by the box
// (doc/BOX_BASED_SHIPPING_WEB_INTEGRATION.md, 5, 6, 9 and 10), written out
// in both languages with one and with several boxes: a plural or an
// ordinal that reads wrong, or a message that does not parse, shows here
// and not in a cart that happens to need five boxes.
//
// The wording of the card under the button is the owner's (2026-11-20):
// "Your 1st box ships free", "… space available", "… to go", "2 boxes:
// 1 free, 1 chargeable"; never "1 box free" or "1 box available".

const english = createTranslator({ locale: "en", messages: en });
const german = createTranslator({ locale: "de", messages: de });
const b = (chunks: string) => `<b>${chunks}</b>`;

describe("what the boxes cost, in a line", () => {
  it("names a free-delivery code", () => {
    expect(english("shipping.statusByCode", { code: "FREESHIP" })).toBe(
      "Your order ships free with code FREESHIP",
    );
    expect(german("shipping.statusByCode", { code: "FREESHIP" })).toBe(
      "Ihre Bestellung wird mit dem Code FREESHIP kostenlos geliefert",
    );
  });

  it("speaks of one box", () => {
    expect(english("shipping.statusOneFree")).toBe("Your box ships free");
    expect(english("shipping.statusOnePaid", { fee: "€4.99" })).toBe(
      "Your box ships for €4.99",
    );
    expect(german("shipping.statusOneFree")).toBe(
      "Ihre Box wird kostenlos geliefert",
    );
    expect(german("shipping.statusOnePaid", { fee: "4,99 €" })).toBe(
      "Ihre Box wird für 4,99 € geliefert",
    );
  });

  it("speaks of several boxes: all free, none free, the first free", () => {
    expect(english("shipping.statusAllFree", { count: 2 })).toBe(
      "Both boxes ship free",
    );
    expect(english("shipping.statusAllFree", { count: 3 })).toBe(
      "All 3 boxes ship free",
    );
    expect(
      english("shipping.statusNoneFree", { count: 2, perBox: "€4.99" }),
    ).toBe("Your 2 boxes ship for €4.99 each");
    expect(english("shipping.statusSomeFree", { free: 1 })).toBe(
      "Your 1st box ships free",
    );
    expect(english("shipping.statusSomeFree", { free: 3 })).toBe(
      "Your first 3 boxes ship free",
    );
    expect(german("shipping.statusAllFree", { count: 2 })).toBe(
      "Beide Boxen werden kostenlos geliefert",
    );
    expect(german("shipping.statusAllFree", { count: 3 })).toBe(
      "Alle 3 Boxen werden kostenlos geliefert",
    );
    expect(
      german("shipping.statusNoneFree", { count: 2, perBox: "4,99 €" }),
    ).toBe("Ihre 2 Boxen werden für je 4,99 € geliefert");
    expect(german("shipping.statusSomeFree", { free: 1 })).toBe(
      "Ihre 1. Box wird kostenlos geliefert",
    );
    expect(german("shipping.statusSomeFree", { free: 3 })).toBe(
      "Ihre ersten 3 Boxen werden kostenlos geliefert",
    );
  });
});

describe("the two meters", () => {
  it("names the box the next goods go into, by its place", () => {
    expect(english("shipping.spaceLabel", { count: 1, number: 1 })).toBe(
      "Space in your box",
    );
    expect(english("shipping.spaceLabel", { count: 2, number: 1 })).toBe(
      "Space in the 1st box",
    );
    expect(english("shipping.spaceLabel", { count: 2, number: 2 })).toBe(
      "Space in the 2nd box",
    );
    expect(english("shipping.spaceLabel", { count: 4, number: 3 })).toBe(
      "Space in the 3rd box",
    );
    expect(english("shipping.spaceLabel", { count: 12, number: 11 })).toBe(
      "Space in the 11th box",
    );
    expect(english("shipping.spaceLabel", { count: 30, number: 22 })).toBe(
      "Space in the 22nd box",
    );
    expect(german("shipping.spaceLabel", { count: 1, number: 1 })).toBe(
      "Platz in Ihrer Box",
    );
    expect(german("shipping.spaceLabel", { count: 2, number: 2 })).toBe(
      "Platz in der 2. Box",
    );
  });

  it("says how much room is left, or that the box is full", () => {
    expect(english.markup("shipping.spaceValue", { room: "19.9 kg", b })).toBe(
      "<b>19.9 kg</b> available",
    );
    expect(english.markup("shipping.spaceFull", { b })).toBe(
      "<b>Full.</b> The next item starts a new box.",
    );
    expect(german.markup("shipping.spaceValue", { room: "19,9 kg", b })).toBe(
      "<b>19,9 kg</b> frei",
    );
    expect(german.markup("shipping.spaceFull", { b })).toBe(
      "<b>Voll.</b> Der nächste Artikel kommt in eine neue Box.",
    );
  });

  it("says how far the next free box is", () => {
    expect(english("shipping.nextLabel", { count: 1 })).toBe("Free shipping");
    expect(english("shipping.nextLabel", { count: 2 })).toBe("Next free box");
    expect(english.markup("shipping.nextValue", { amount: "€5.87", b })).toBe(
      "<b>€5.87</b> to go",
    );
    expect(english("shipping.nextReached")).toBe("Reached");
    expect(english("shipping.nextByCode", { code: "FREESHIP" })).toBe(
      "With code FREESHIP",
    );
    expect(german("shipping.nextLabel", { count: 1 })).toBe(
      "Kostenlose Lieferung",
    );
    expect(german("shipping.nextLabel", { count: 2 })).toBe(
      "Nächste kostenlose Box",
    );
    expect(german.markup("shipping.nextValue", { amount: "5,87 €", b })).toBe(
      "Noch <b>5,87 €</b>",
    );
    expect(german("shipping.nextReached")).toBe("Erreicht");
    expect(german("shipping.nextByCode", { code: "FREESHIP" })).toBe(
      "Mit Code FREESHIP",
    );
  });
});

describe("the closing line of the card", () => {
  it("counts the boxes the order uses", () => {
    expect(
      english("shipping.usesOne", { weight: "2.1 kg", max: "25 kg" }),
    ).toBe("Your order fits in one box: 2.1 kg of 25 kg.");
    expect(english("shipping.usesParcel")).toBe(
      "Your order ships as a parcel of its own.",
    );
    expect(english("shipping.usesAllFree", { count: 2 })).toBe(
      "Your order uses 2 boxes, both free.",
    );
    expect(english("shipping.usesAllFree", { count: 4 })).toBe(
      "Your order uses 4 boxes, all free.",
    );
    expect(
      english("shipping.usesNoneFree", { count: 2, perBox: "€4.99" }),
    ).toBe("Your order uses 2 boxes, €4.99 each.");
    expect(
      english("shipping.usesSomeFree", { count: 2, free: 1, paid: 1 }),
    ).toBe("Your order uses 2 boxes: 1 free, 1 chargeable.");
    expect(english("shipping.usesByCode", { count: 2 })).toBe(
      "Your order uses 2 boxes.",
    );
    expect(german("shipping.usesOne", { weight: "2,1 kg", max: "25 kg" })).toBe(
      "Ihre Bestellung passt in eine Box: 2,1 kg von 25 kg.",
    );
    expect(german("shipping.usesParcel")).toBe(
      "Ihre Bestellung wird als eigenes Paket geliefert.",
    );
    expect(german("shipping.usesAllFree", { count: 2 })).toBe(
      "Ihre Bestellung braucht 2 Boxen, beide kostenlos.",
    );
    expect(german("shipping.usesAllFree", { count: 4 })).toBe(
      "Ihre Bestellung braucht 4 Boxen, alle kostenlos.",
    );
    expect(
      german("shipping.usesNoneFree", { count: 2, perBox: "4,99 €" }),
    ).toBe("Ihre Bestellung braucht 2 Boxen für je 4,99 €.");
    expect(
      german("shipping.usesSomeFree", { count: 2, free: 1, paid: 1 }),
    ).toBe("Ihre Bestellung braucht 2 Boxen: 1 kostenlos, 1 kostenpflichtig.");
    expect(german("shipping.usesByCode", { count: 2 })).toBe(
      "Ihre Bestellung braucht 2 Boxen.",
    );
  });

  it("says what the boxes that are not free cost", () => {
    expect(english("shipping.extraOne", { number: 2, fee: "€4.99" })).toBe(
      "The 2nd box costs €4.99.",
    );
    expect(english("shipping.extraOne", { number: 3, fee: "€4.99" })).toBe(
      "The 3rd box costs €4.99.",
    );
    expect(english("shipping.extraSeveral", { paid: 1, perBox: "€4.99" })).toBe(
      "1 box costs €4.99.",
    );
    expect(english("shipping.extraSeveral", { paid: 2, perBox: "€4.99" })).toBe(
      "2 boxes cost €4.99 each.",
    );
    expect(german("shipping.extraOne", { number: 2, fee: "4,99 €" })).toBe(
      "Die 2. Box kostet 4,99 €.",
    );
    expect(german("shipping.extraSeveral", { paid: 1, perBox: "4,99 €" })).toBe(
      "1 Box kostet 4,99 €.",
    );
    expect(german("shipping.extraSeveral", { paid: 2, perBox: "4,99 €" })).toBe(
      "2 Boxen kosten je 4,99 €.",
    );
  });

  it("never says '1 box free' or '1 box available'", () => {
    for (const messages of [en.shipping, de.shipping]) {
      for (const text of Object.values(messages)) {
        expect(text).not.toMatch(/\b1 box (free|available)\b/i);
        expect(text).not.toMatch(/\b1 Box (kostenlos|frei)\b/i);
      }
    }
  });

  it("says what a code or coins cost in free boxes", () => {
    expect(english("shipping.lostByCode", { count: 1, amount: "€7.80" })).toBe(
      "With this discount one box is no longer free. Add €7.80 more to get it free again.",
    );
    expect(english("shipping.lostByCode", { count: 2, amount: "€7.80" })).toBe(
      "With this discount 2 boxes are no longer free. Add €7.80 more to get one of them free again.",
    );
    expect(english("shipping.lostByCoins", { count: 1, amount: "€1.95" })).toBe(
      "With these coins one box is no longer free. Add €1.95 more to get it free again.",
    );
    expect(english("shipping.lostByCoins", { count: 2, amount: "€1.95" })).toBe(
      "With these coins 2 boxes are no longer free. Add €1.95 more to get one of them free again.",
    );
    expect(german("shipping.lostByCode", { count: 1, amount: "7,80 €" })).toBe(
      "Mit diesem Rabatt ist eine Box nicht mehr kostenlos. Noch 7,80 €, dann ist sie es wieder.",
    );
    expect(german("shipping.lostByCode", { count: 2, amount: "7,80 €" })).toBe(
      "Mit diesem Rabatt sind 2 Boxen nicht mehr kostenlos. Noch 7,80 €, dann ist eine davon wieder kostenlos.",
    );
    expect(german("shipping.lostByCoins", { count: 1, amount: "1,95 €" })).toBe(
      "Mit diesen Coins ist eine Box nicht mehr kostenlos. Noch 1,95 €, dann ist sie es wieder.",
    );
    expect(german("shipping.lostByCoins", { count: 2, amount: "1,95 €" })).toBe(
      "Mit diesen Coins sind 2 Boxen nicht mehr kostenlos. Noch 1,95 €, dann ist eine davon wieder kostenlos.",
    );
  });
});

describe("the boxes, one by one", () => {
  it("names one box and several", () => {
    expect(english("shipping.boxesTitle", { count: 1 })).toBe("Your box");
    expect(english("shipping.boxesTitle", { count: 4 })).toBe("Your boxes");
    expect(german("shipping.boxesTitle", { count: 1 })).toBe("Ihre Box");
    expect(german("shipping.boxesTitle", { count: 4 })).toBe("Ihre Boxen");
    expect(english("shipping.box", { number: 3 })).toBe("Box 3");
    expect(german("shipping.box", { number: 3 })).toBe("Box 3");
    expect(english("shipping.separate")).toBe("Separate parcel");
    expect(german("shipping.separate")).toBe("Eigenes Paket");
  });

  it("opens the list, with the weight of the order", () => {
    expect(english("shipping.details")).toBe("Box by box");
    expect(english("shipping.totalWeight", { weight: "25.1 kg" })).toBe(
      "25.1 kg in total",
    );
    expect(german("shipping.details")).toBe("Box für Box");
    expect(german("shipping.totalWeight", { weight: "25,1 kg" })).toBe(
      "25,1 kg insgesamt",
    );
    expect(english("shipping.more", { count: 10 })).toBe("… and 10 more");
    expect(german("shipping.more", { count: 10 })).toBe("… und 10 weitere");
    expect(english("shipping.approximate")).toBe("Weight is approximate.");
    expect(german("shipping.approximate")).toBe("Gewicht ungefähr.");
  });
});

describe("the delivery of the bill", () => {
  it("counts the boxes under the delivery", () => {
    expect(english("shipping.summary", { count: 2, free: 1, paid: 1 })).toBe(
      "2 boxes: 1 free, 1 chargeable",
    );
    expect(english("shipping.summaryAllFree", { count: 2 })).toBe(
      "2 boxes, all free",
    );
    expect(
      english("shipping.summaryNoneFree", { count: 2, perBox: "€4.99" }),
    ).toBe("2 boxes at €4.99 each");
    expect(
      english("shipping.summaryWithCode", { count: 2, code: "FREESHIP" }),
    ).toBe("2 boxes, free with code FREESHIP");
    expect(english("shipping.withCode", { code: "FREESHIP" })).toBe(
      "with code FREESHIP",
    );
    expect(german("shipping.summary", { count: 2, free: 1, paid: 1 })).toBe(
      "2 Boxen: 1 kostenlos, 1 kostenpflichtig",
    );
    expect(german("shipping.summaryAllFree", { count: 2 })).toBe(
      "2 Boxen, alle kostenlos",
    );
    expect(
      german("shipping.summaryNoneFree", { count: 2, perBox: "4,99 €" }),
    ).toBe("2 Boxen für je 4,99 €");
    expect(
      german("shipping.summaryWithCode", { count: 2, code: "FREESHIP" }),
    ).toBe("2 Boxen, kostenlos mit Code FREESHIP");
    expect(german("shipping.withCode", { code: "FREESHIP" })).toBe(
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
