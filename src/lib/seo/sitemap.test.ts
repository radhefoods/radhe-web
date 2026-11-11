import { describe, expect, it } from "vitest";
import type { Category } from "@/lib/api/types";
import { STATIC_PAGES, buildSitemap, joinProductSlugs } from "./sitemap";

const SITE = "http://localhost:3001";

function category(en: string, de: string, children: Category[] = []): Category {
  return {
    id: en,
    slug: en,
    slugs: { en, de },
    name: en,
    tagline: null,
    description: null,
    parentId: null,
    level: 1,
    listingView: "variants_by_size",
    image: null,
    productCount: 1,
    seo: { title: en, description: null },
    children,
  };
}

describe("joinProductSlugs", () => {
  it("gives every product its slug in both languages", () => {
    expect(
      joinProductSlugs(
        [{ id: "1", slug: "basmati-rice-5kg" }],
        [{ id: "1", slug: "basmati-reis-5kg" }],
      ),
    ).toEqual([
      { id: "1", slugs: { en: "basmati-rice-5kg", de: "basmati-reis-5kg" } },
    ]);
  });

  it("leaves out a product that one language does not list", () => {
    expect(
      joinProductSlugs(
        [
          { id: "1", slug: "rice" },
          { id: "2", slug: "dal" },
        ],
        [{ id: "2", slug: "dal" }],
      ),
    ).toEqual([{ id: "2", slugs: { en: "dal", de: "dal" } }]);
  });
});

describe("buildSitemap", () => {
  const sitemap = buildSitemap(
    [category("rice", "reis", [category("basmati-rice", "basmati-reis")])],
    [{ id: "1", slugs: { en: "basmati-rice-5kg", de: "basmati-reis-5kg" } }],
    {
      posts: [
        { id: "p1", slugs: { en: "the-perfect-dal", de: "das-perfekte-dal" } },
      ],
      categories: [{ id: "c1", slugs: { en: "recipes", de: "rezepte" } }],
    },
    [
      { type: "shipping", publishedAt: "2026-11-11T09:00:00.000Z" },
      { type: "terms", publishedAt: "2026-09-01T08:00:00.000Z" },
      { type: "privacy", publishedAt: "2026-09-01T08:00:00.000Z" },
    ],
  );
  const urls = sitemap.map((entry) => entry.url);

  it("lists every page once per language", () => {
    expect(new Set(urls).size).toBe(urls.length);
    expect(sitemap).toHaveLength((STATIC_PAGES.length + 3 + 2 + 1 + 1 + 1) * 2);
    expect(urls).toContain(`${SITE}/en`);
    expect(urls).toContain(`${SITE}/de`);
  });

  it("uses the localized address and slug of each language", () => {
    expect(urls).toContain(`${SITE}/en/products/basmati-rice-5kg`);
    expect(urls).toContain(`${SITE}/de/produkte/basmati-reis-5kg`);
    expect(urls).toContain(`${SITE}/en/category/rice`);
    expect(urls).toContain(`${SITE}/de/kategorie/reis`);
    expect(urls).toContain(`${SITE}/de/kategorie/basmati-reis`);
    expect(urls).toContain(`${SITE}/de/so-funktionierts`);
    expect(urls).toContain(`${SITE}/de/rechtliches/cookies`);
  });

  it("lists the legal pages the admin has published, with the day of their version", () => {
    expect(urls).toContain(`${SITE}/en/legal/terms`);
    expect(urls).toContain(`${SITE}/de/rechtliches/agb`);
    expect(urls).toContain(`${SITE}/de/rechtliches/datenschutz`);
    const shipping = sitemap.find(
      (entry) => entry.url === `${SITE}/de/rechtliches/versand`,
    );
    expect(shipping).toMatchObject({
      lastModified: "2026-11-11T09:00:00.000Z",
      priority: 0.2,
      alternates: {
        languages: {
          en: `${SITE}/en/legal/shipping`,
          de: `${SITE}/de/rechtliches/versand`,
          "x-default": `${SITE}/en/legal/shipping`,
        },
      },
    });
  });

  it("leaves out a legal page without a published text", () => {
    // The refund policy would answer 404; the legal notice and the right of
    // withdrawal would show a template of the shop.
    for (const unpublished of [
      "refund-policy",
      "rueckerstattung",
      "imprint",
      "impressum",
      "withdrawal",
      "widerruf",
    ]) {
      expect(urls.some((url) => url.endsWith(`/${unpublished}`))).toBe(false);
    }
    // Without an answer of the API, none of the six.
    const without = buildSitemap([], []).map((entry) => entry.url);
    expect(
      without.filter((url) => /\/(legal|rechtliches)\//.test(url)),
    ).toEqual([`${SITE}/en/legal/cookies`, `${SITE}/de/rechtliches/cookies`]);
  });

  it("names the other language and the default on every entry", () => {
    const german = sitemap.find(
      (entry) => entry.url === `${SITE}/de/produkte/basmati-reis-5kg`,
    );
    expect(german?.alternates?.languages).toEqual({
      en: `${SITE}/en/products/basmati-rice-5kg`,
      de: `${SITE}/de/produkte/basmati-reis-5kg`,
      "x-default": `${SITE}/en/products/basmati-rice-5kg`,
    });
  });

  it("leaves out what belongs to one visitor", () => {
    for (const hidden of [
      "cart",
      "warenkorb",
      "checkout",
      "kasse",
      "account",
      "konto",
      "sign-in",
      "pay",
      "unsubscribe",
    ]) {
      expect(urls.some((url) => url.includes(`/${hidden}`))).toBe(false);
    }
  });
});
