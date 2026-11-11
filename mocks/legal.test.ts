import { describe, expect, it } from "vitest";
import { hasErrorCode } from "../src/lib/api/errors.ts";
import type { AddressInput, LegalType } from "../src/lib/api/types.ts";
import { consentVersions } from "../src/lib/checkout/order-attempt.ts";
import { SKU } from "./data/catalogue.ts";
import { startMockApi } from "./testing.ts";

// The six legal pages of the mock (doc 6, `doc/LEGAL_PAGES.md`), exercised
// through the shop's API client.

const mock = startMockApi();

const ALL: LegalType[] = [
  "imprint",
  "shipping",
  "refund",
  "terms",
  "privacy",
  "withdrawal",
];

const home: AddressInput = {
  firstName: "Priya",
  lastName: "Shah",
  street: "Hauptstraße",
  houseNumber: "12",
  postalCode: "60311",
  city: "Frankfurt am Main",
};

async function publishAll() {
  for (const type of ALL) {
    await mock.control("legal/publish", { type, published: true });
  }
}

describe("the list of legal pages", () => {
  it("holds the published pages only, in the order of the types", async () => {
    const { items } = await mock.guestApi().listLegal({ locale: "de" });
    expect(items.map((page) => page.type)).toEqual([
      "shipping",
      "terms",
      "privacy",
      "withdrawal",
    ]);
    expect(items[0]).toEqual({
      type: "shipping",
      version: 2,
      title: "Versandinformationen",
      publishedAt: "2026-11-11T09:00:00.000Z",
      slug: "versand",
      slugs: { en: "shipping", de: "versand" },
      requiresConsent: false,
    });
  });

  it("marks the terms and the privacy policy as the texts of the consent", async () => {
    await publishAll();
    const { items } = await mock.guestApi().listLegal();
    expect(items.map((page) => page.type)).toEqual(ALL);
    expect(
      items.filter((page) => page.requiresConsent).map((page) => page.type),
    ).toEqual(["terms", "privacy"]);
  });
});

describe("one legal page", () => {
  it("is found by its type and by its address in either language", async () => {
    const api = mock.guestApi();
    for (const key of ["terms", "agb"] as LegalType[]) {
      const { document } = await api.getLegal(key, { locale: "de" });
      expect(document).toMatchObject({
        type: "terms",
        version: 3,
        title: "Allgemeine Geschäftsbedingungen",
        slug: "agb",
        slugs: { en: "terms", de: "agb" },
        requiresConsent: true,
        contentLanguage: "de",
        // Nobody wrote a title for search engines: the title of the text.
        seo: { title: "Allgemeine Geschäftsbedingungen", description: null },
      });
      expect(document.content).toContain("## 1. Geltungsbereich");
    }
  });

  it("answers a text that exists in one language for both, and says which it is", async () => {
    const { document } = await mock
      .guestApi()
      .getLegal("shipping", { locale: "en" });
    expect(document.title).toBe("Shipping information");
    expect(document.contentLanguage).toBe("de");
    expect(document.content).toContain("## Liefergebiet");
    expect(document.seo).toEqual({
      title: "Shipping | Radhe Foods",
      // Written in German only.
      description: "So liefert Radhe Foods Ihre Bestellung.",
    });
  });

  it("does not exist while it is not published, nor under a key that names no page", async () => {
    const api = mock.guestApi();
    for (const key of ["imprint", "refund", "impressum", "returns"]) {
      const error = await api.getLegal(key as LegalType).catch((e) => e);
      expect(hasErrorCode(error, "LEGAL_DOCUMENT_NOT_FOUND"), key).toBe(true);
      expect(error.status).toBe(404);
    }
    await mock.control("legal/publish", { type: "imprint", published: true });
    const { document } = await api.getLegal("imprint", { locale: "de" });
    expect(document.title).toBe("Impressum");
  });
});

describe("the consent of the checkout", () => {
  async function readyToOrder(email: string) {
    const client = await mock.signIn(email);
    const { items } = await client.api.createAddress(home);
    const bill = await client.api.setCartItem(SKU.chakkiAtta5kg, 1);
    return {
      api: client.api,
      addressId: items[0].id,
      expectedTotal: bill.totals.total,
    };
  }

  it("takes the terms and the privacy policy when six pages are published", async () => {
    await publishAll();
    const { api, addressId, expectedTotal } =
      await readyToOrder("six@example.com");
    const legal = await api.listLegal();
    expect(legal.items).toHaveLength(6);
    const versions = consentVersions(legal.items);
    expect(versions).toEqual({ terms: 3, privacy: 2 });
    const result = await api.checkout(
      { addressId, expectedTotal, consent: { accepted: true, versions } },
      "legal-attempt-0001",
    );
    expect(result.created).toBe(true);
    expect(result.order.acceptedTerms.documents).toEqual([
      { type: "terms", version: 3 },
      { type: "privacy", version: 2 },
    ]);
  });

  it("refuses the key of a page that is not part of the consent", async () => {
    await publishAll();
    const { api, addressId, expectedTotal } =
      await readyToOrder("seven@example.com");
    const error = await api
      .checkout(
        {
          addressId,
          expectedTotal,
          consent: {
            accepted: true,
            versions: { terms: 3, privacy: 2, imprint: 1 },
          },
        },
        "legal-attempt-0002",
      )
      .catch((e) => e);
    expect(hasErrorCode(error, "VALIDATION_FAILED")).toBe(true);
  });

  it("is not interrupted by a new version of a page that only informs", async () => {
    const { api, addressId, expectedTotal } =
      await readyToOrder("eight@example.com");
    const versions = consentVersions((await api.listLegal()).items);
    await mock.control("legal/republish", { type: "shipping" });
    const result = await api.checkout(
      { addressId, expectedTotal, consent: { accepted: true, versions } },
      "legal-attempt-0003",
    );
    expect(result.created).toBe(true);
  });
});
