import { describe, expect, it } from "vitest";
import type { ApiImage, Category } from "@/lib/api/types";
import {
  STATIC_PAGES,
  buildSitemap,
  joinProductSlugs,
  sitemapImage,
} from "./sitemap";

const SITE = "http://localhost:3001";
const CDN = "https://cdn.example/catalog";

function picture(name: string): ApiImage {
  const file = (size: string, width: number) => ({
    url: `${CDN}/${name}/${size}.webp`,
    width,
    height: width,
  });
  return {
    id: name,
    alt: name,
    isPrimary: true,
    url: `${CDN}/${name}/medium.webp`,
    sizes: {
      small: file("small", 320),
      medium: file("medium", 600),
      large: file("large", 1200),
    },
  };
}

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

  it("keeps the picture and the date of the English list, and nothing in their place", () => {
    const [pictured, bare] = joinProductSlugs(
      [
        {
          id: "1",
          slug: "rice",
          image: `${CDN}/rice/large.webp`,
          lastModified: "2026-11-10T08:00:00.000Z",
        },
        { id: "2", slug: "dal", image: null, lastModified: undefined },
      ],
      [
        { id: "1", slug: "reis" },
        { id: "2", slug: "dal" },
      ],
    );
    expect(pictured).toEqual({
      id: "1",
      slugs: { en: "rice", de: "reis" },
      image: `${CDN}/rice/large.webp`,
      lastModified: "2026-11-10T08:00:00.000Z",
    });
    expect(Object.keys(bare)).toEqual(["id", "slugs"]);
  });
});

describe("sitemapImage", () => {
  it("names the largest file of a picture, and nothing without one", () => {
    expect(sitemapImage(picture("rice"))).toBe(`${CDN}/rice/large.webp`);
    expect(sitemapImage(null)).toBeNull();
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

  it("carries no date and no picture the API did not give", () => {
    // A made-up date (the day of the build, say) is worse than none.
    for (const entry of sitemap) {
      const legal = /\/(legal|rechtliches)\/(?!cookies)/.test(entry.url);
      expect(entry.lastModified !== undefined).toBe(legal);
      expect(entry.images).toBeUndefined();
    }
  });

  it("gives a pack size, a category and a post their picture and date in both languages", () => {
    const rich = buildSitemap(
      [{ ...category("rice", "reis"), image: picture("rice") }],
      [
        {
          id: "1",
          slugs: { en: "basmati-rice-5kg", de: "basmati-reis-5kg" },
          image: `${CDN}/basmati/large.webp`,
          lastModified: "2026-11-10T08:00:00.000Z",
        },
        { id: "2", slugs: { en: "toor-dal-1kg", de: "toor-dal-1kg" } },
      ],
      {
        posts: [
          {
            id: "p1",
            slugs: { en: "the-perfect-dal", de: "das-perfekte-dal" },
            image: `${CDN}/dal/large.webp`,
            lastModified: "2026-10-24T18:00:00.000Z",
          },
        ],
        categories: [],
      },
    );
    const entry = (path: string) =>
      rich.find(({ url }) => url === `${SITE}${path}`);
    for (const path of [
      "/en/products/basmati-rice-5kg",
      "/de/produkte/basmati-reis-5kg",
    ]) {
      expect(entry(path)).toMatchObject({
        images: [`${CDN}/basmati/large.webp`],
        lastModified: "2026-11-10T08:00:00.000Z",
      });
    }
    expect(entry("/de/kategorie/reis")?.images).toEqual([
      `${CDN}/rice/large.webp`,
    ]);
    expect(entry("/de/blog/das-perfekte-dal")).toMatchObject({
      images: [`${CDN}/dal/large.webp`],
      lastModified: "2026-10-24T18:00:00.000Z",
    });
    const bare = entry("/en/products/toor-dal-1kg");
    expect(bare).toBeDefined();
    expect(bare).not.toHaveProperty("images");
    expect(bare).not.toHaveProperty("lastModified");
  });

  it("writes a picture's address so that it cannot break the XML", () => {
    // Next.js writes the value into the file as it is.
    const [entry] = buildSitemap(
      [],
      [
        {
          id: "1",
          slugs: { en: "rice", de: "reis" },
          image: `${CDN}/rice.webp?w=1200&q=80`,
        },
      ],
    ).filter(({ url }) => url.endsWith("/products/rice"));
    expect(entry.images).toEqual([`${CDN}/rice.webp?w=1200&amp;q=80`]);
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
