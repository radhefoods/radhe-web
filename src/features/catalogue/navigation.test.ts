import { describe, expect, it } from "vitest";
import type { Category } from "@/lib/api/types";
import {
  categoriesOf,
  collapseTail,
  holdsSlug,
  navItems,
  type NavItem,
} from "./navigation";

function category(
  en: string,
  children: string[] = [],
  de: string = en,
): Category {
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
    children: children.map((child) => ({
      ...category(child),
      parentId: en,
      level: 2,
    })),
  };
}

/** The parent categories of the shop on 2026-11-11, in the admin's order. */
const SHOP = [
  category("rice", ["basmati-rice", "south-indian-rice"]),
  category("atta-flours"),
  category("dals-pulses"),
  category("spices-masalas", ["whole-spices", "masala-blends"]),
  category("oils-ghee"),
  category("pantry"),
  category("pickles-sauces"),
  category("instant-ready"),
  category("papad-khakhra"),
  category("snacks-namkeen"),
  category("sweets-biscuits"),
  category("beverages"),
  category("frozen"),
  category("fresh"),
  category("east-asian"),
  category("african-caribbean"),
  category("beauty-care"),
  category("pooja-festival"),
  category("household-kitchen"),
];

const outline = (items: NavItem[]) =>
  items.map((item) =>
    item.kind === "category"
      ? item.category.slug
      : `${item.label}: ${item.sections
          .map((section) =>
            section.categories.map((entry) => entry.slug).join(", "),
          )
          .join(" | ")}`,
  );

describe("navItems", () => {
  it("puts the nineteen categories of the shop into six groups, in the admin's order", () => {
    expect(outline(navItems(SHOP))).toEqual([
      "staples: rice, atta-flours, dals-pulses, oils-ghee",
      "cooking: spices-masalas, pantry, pickles-sauces, instant-ready",
      "snacks: papad-khakhra, snacks-namkeen, sweets-biscuits, beverages",
      "fresh: frozen, fresh",
      "world: east-asian, african-caribbean",
      "home: beauty-care, pooja-festival, household-kitchen",
    ]);
  });

  it("leaves no category out", () => {
    const shown = navItems(SHOP).flatMap(categoriesOf);
    expect(shown).toHaveLength(SHOP.length);
    expect(new Set(shown)).toEqual(new Set(SHOP));
  });

  it("goes by the English slug in either language", () => {
    const german = SHOP.map((entry, index) => ({
      ...entry,
      slug: `kategorie-${index}`,
      slugs: { en: entry.slugs.en, de: `kategorie-${index}` },
    }));
    expect(navItems(german).map((item) => item.key)).toEqual(
      navItems(SHOP).map((item) => item.key),
    );
  });

  it("lists a category no group knows under More, and a renamed one where its words lead", () => {
    const changed = [
      ...SHOP.filter((entry) => entry.slug !== "rice"),
      category("rice-and-grains"),
      category("gift-hampers"),
      category("party-supplies"),
    ];
    const items = outline(navItems(changed));
    expect(items[0]).toBe(
      "staples: atta-flours, dals-pulses, oils-ghee, rice-and-grains",
    );
    expect(items.at(-1)).toBe("more: gift-hampers, party-supplies");
  });

  it("shows a group with one category as that category", () => {
    const items = navItems(
      SHOP.filter((entry) => entry.slug !== "african-caribbean"),
    );
    expect(outline(items)[4]).toBe("east-asian");
    expect(items[4]).toMatchObject({ kind: "category", group: "world" });
  });

  it("shows a small catalogue category by category", () => {
    const few = SHOP.slice(0, 6);
    expect(outline(navItems(few))).toEqual(few.map((entry) => entry.slug));
    expect(navItems([])).toEqual([]);
  });

  it("names the one group All categories when no category is known", () => {
    const unknown = "abcdefgh".split("").map((letter) => category(letter));
    const items = navItems(unknown);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: "group", label: "all" });
    expect(categoriesOf(items[0])).toEqual(unknown);
  });

  it("sorts the sample catalogue of the mock API", () => {
    const sample = [
      "rice",
      "flour",
      "pulses-and-lentils",
      "spices",
      "snacks",
      "fresh-fruit",
      "tea-and-drinks",
      "ghee-and-dairy",
      "frozen",
    ].map((slug) => category(slug));
    expect(outline(navItems(sample))).toEqual([
      "staples: rice, flour, pulses-and-lentils, ghee-and-dairy",
      "spices",
      "snacks: snacks, tea-and-drinks",
      "fresh: fresh-fruit, frozen",
    ]);
  });
});

describe("collapseTail", () => {
  it("keeps the first four and gathers the rest under More, group by group", () => {
    const { head, more } = collapseTail(navItems(SHOP));
    expect(head.map((item) => item.key)).toEqual([
      "group:staples",
      "group:cooking",
      "group:snacks",
      "group:fresh",
    ]);
    expect(more?.label).toBe("more");
    expect(
      more?.sections.map((section) => [
        section.id,
        section.categories.map((entry) => entry.slug),
      ]),
    ).toEqual([
      ["world", ["east-asian", "african-caribbean"]],
      ["home", ["beauty-care", "pooja-festival", "household-kitchen"]],
    ]);
  });

  it("moves nothing when at most one item would move", () => {
    const five = navItems(
      SHOP.filter(
        (entry) =>
          !["beauty-care", "pooja-festival", "household-kitchen"].includes(
            entry.slug,
          ),
      ),
    );
    expect(five).toHaveLength(5);
    expect(collapseTail(five)).toEqual({ head: five, more: null });
  });

  it("joins single categories and what no group knows into the sections of More", () => {
    const items = navItems([
      ...SHOP.filter((entry) => entry.slug !== "african-caribbean"),
      category("gift-hampers"),
    ]);
    const { more } = collapseTail(items);
    expect(
      more?.sections.map((section) => [
        section.id,
        section.categories.map((entry) => entry.slug),
      ]),
    ).toEqual([
      ["world", ["east-asian"]],
      ["home", ["beauty-care", "pooja-festival", "household-kitchen"]],
      ["other", ["gift-hampers"]],
    ]);
    // The items themselves are not changed.
    expect(outline(items).at(-1)).toBe("more: gift-hampers");
  });
});

describe("holdsSlug", () => {
  it("finds the page of a category or of one below it", () => {
    const [staples, cooking] = navItems(SHOP);
    expect(holdsSlug(staples, "rice")).toBe(true);
    expect(holdsSlug(staples, "basmati-rice")).toBe(true);
    expect(holdsSlug(staples, "whole-spices")).toBe(false);
    expect(holdsSlug(cooking, "whole-spices")).toBe(true);
    expect(holdsSlug(cooking, null)).toBe(false);
  });
});
