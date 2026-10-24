import { describe, expect, it } from "vitest";
import { buildUrl } from "@/lib/api/http";
import type { ProductSummary } from "@/lib/api/types";
import {
  ROW_SIZE,
  catalogueQuery,
  featuredQuery,
  moreRowCards,
  nextRowPage,
  popularProducts,
  rowQuery,
} from "./home";

const url = (query: object) =>
  buildUrl("", "/v1/store/products", { ...query, locale: "en" });

const product = (id: string) => ({ id, variantId: id }) as ProductSummary;
const many = (prefix: string, count: number) =>
  Array.from({ length: count }, (_, i) => product(`${prefix}${i + 1}`));

describe("rowQuery", () => {
  it("asks for the first cards of a category in rounds of pack sizes", () => {
    expect(url(rowQuery("fruits"))).toBe(
      `/v1/store/products?category=fruits&view=variants_by_size&limit=${ROW_SIZE}&locale=en`,
    );
    expect(url(rowQuery("fruits", 1))).toBe(url(rowQuery("fruits")));
  });

  it("asks for a later page of the same row", () => {
    expect(url(rowQuery("fruits", 3))).toBe(
      `/v1/store/products?category=fruits&view=variants_by_size&page=3&limit=${ROW_SIZE}&locale=en`,
    );
  });

  it("asks for the first products of the catalogue, one card each", () => {
    expect(url(catalogueQuery)).toBe(
      `/v1/store/products?limit=${ROW_SIZE}&locale=en`,
    );
  });

  it("asks for a row of featured products", () => {
    expect(url(featuredQuery)).toBe(
      `/v1/store/products?featured=true&limit=${ROW_SIZE}&locale=en`,
    );
  });
});

describe("nextRowPage", () => {
  it("names the page after this one and stops after the last", () => {
    expect(nextRowPage({ page: 1, totalPages: 3 })).toBe(2);
    expect(nextRowPage({ page: 3, totalPages: 3 })).toBeNull();
    expect(nextRowPage({ page: 1, totalPages: 1 })).toBeNull();
  });
});

describe("moreRowCards", () => {
  it("adds the cards of a page behind those loaded before", () => {
    expect(
      moreRowCards(["s1", "s2"], many("a", 2), many("b", 3)).map(
        (p) => p.variantId,
      ),
    ).toEqual(["a1", "a2", "b1", "b2", "b3"]);
  });

  it("shows a pack size once, whichever answer it comes from", () => {
    expect(
      moreRowCards(
        ["s1", "s2"],
        [product("a1")],
        [product("s2"), product("a1"), product("b1"), product("b1")],
      ).map((p) => p.variantId),
    ).toEqual(["a1", "b1"]);
  });
});

describe("popularProducts", () => {
  it("shows the featured products when there are any", () => {
    expect(popularProducts(many("f", 2), many("c", 10))).toEqual(many("f", 2));
  });

  it("falls back to the first of the catalogue while none is featured", () => {
    expect(popularProducts([], many("c", 10))).toEqual(many("c", ROW_SIZE));
  });

  it("never shows more than a row", () => {
    expect(popularProducts(many("f", 12), [])).toHaveLength(ROW_SIZE);
  });
});
