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
        [{ id: "1", slug: "basmati-rice-5-kg" }],
        [{ id: "1", slug: "basmati-reis-5-kg" }],
      ),
    ).toEqual([
      { id: "1", slugs: { en: "basmati-rice-5-kg", de: "basmati-reis-5-kg" } },
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
    [{ id: "1", slugs: { en: "basmati-rice-5-kg", de: "basmati-reis-5-kg" } }],
  );
  const urls = sitemap.map((entry) => entry.url);

  it("lists every page once per language", () => {
    expect(new Set(urls).size).toBe(urls.length);
    expect(sitemap).toHaveLength((STATIC_PAGES.length + 2 + 1) * 2);
    expect(urls).toContain(`${SITE}/en`);
    expect(urls).toContain(`${SITE}/de`);
  });

  it("uses the localized address and slug of each language", () => {
    expect(urls).toContain(`${SITE}/en/products/basmati-rice-5-kg`);
    expect(urls).toContain(`${SITE}/de/produkte/basmati-reis-5-kg`);
    expect(urls).toContain(`${SITE}/en/category/rice`);
    expect(urls).toContain(`${SITE}/de/kategorie/reis`);
    expect(urls).toContain(`${SITE}/de/kategorie/basmati-reis`);
    expect(urls).toContain(`${SITE}/de/so-funktionierts`);
    expect(urls).toContain(`${SITE}/de/rechtliches/impressum`);
  });

  it("names the other language and the default on every entry", () => {
    const german = sitemap.find(
      (entry) => entry.url === `${SITE}/de/produkte/basmati-reis-5-kg`,
    );
    expect(german?.alternates?.languages).toEqual({
      en: `${SITE}/en/products/basmati-rice-5-kg`,
      de: `${SITE}/de/produkte/basmati-reis-5-kg`,
      "x-default": `${SITE}/en/products/basmati-rice-5-kg`,
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
