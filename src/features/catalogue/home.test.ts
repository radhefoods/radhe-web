import { describe, expect, it } from "vitest";
import { buildUrl } from "@/lib/api/http";
import type { ProductSummary } from "@/lib/api/types";
import { ROW_SIZE, featuredQuery, popularProducts, rowQuery } from "./home";
import { parseListingState, toProductQuery } from "./listing-state";

const url = (query: object) =>
  buildUrl("", "/v1/store/products", { ...query, locale: "en" });

const product = (id: string) => ({ id }) as ProductSummary;
const many = (prefix: string, count: number) =>
  Array.from({ length: count }, (_, i) => product(`${prefix}${i + 1}`));

describe("rowQuery", () => {
  it("asks for exactly what the first page of a category asks for", () => {
    const state = parseListingState({});
    expect(url(rowQuery("fruits"))).toBe(url(toProductQuery(state, "fruits")));
    expect(url(rowQuery("fruits"))).toBe(
      "/v1/store/products?category=fruits&page=1&limit=24&locale=en",
    );
  });

  it("asks for the first page of all products without a category", () => {
    expect(url(rowQuery())).toBe(url(toProductQuery(parseListingState({}))));
  });

  it("asks for a row of featured products", () => {
    expect(url(featuredQuery)).toBe(
      `/v1/store/products?featured=true&limit=${ROW_SIZE}&locale=en`,
    );
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
