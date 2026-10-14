import { describe, expect, it } from "vitest";
import {
  activeFilters,
  clearedFilters,
  filterCount,
  hasFilters,
  isFiltered,
  pageWindow,
  parseListingState,
  toProductQuery,
  toQueryString,
  toSearchParams,
  toggled,
} from "./listing-state";

const plain = {
  q: undefined,
  sort: "recommended",
  page: 1,
  onSale: false,
  orderable: false,
  brands: [],
  tags: [],
  storageTypes: [],
  packSizes: [],
  price: null,
};

describe("parseListingState", () => {
  it("has sensible defaults", () => {
    expect(parseListingState({})).toEqual(plain);
  });

  it("reads a full address", () => {
    expect(
      parseListingState({
        q: " reis ",
        sort: "price_asc",
        onSale: "1",
        orderable: "1",
        page: "3",
        brand: ["MDH", "Amul"],
        tag: "new",
        storageType: ["chilled", "frozen"],
        packSize: ["1kg", "0.5l"],
        minPrice: "500",
        maxPrice: "999",
      }),
    ).toEqual({
      q: "reis",
      sort: "price_asc",
      page: 3,
      onSale: true,
      orderable: true,
      brands: ["MDH", "Amul"],
      tags: ["new"],
      storageTypes: ["chilled", "frozen"],
      packSizes: ["1kg", "0.5l"],
      price: { min: 500, max: 999 },
    });
  });

  it("ignores what the API would refuse", () => {
    const state = parseListingState({
      q: "a",
      sort: "cheapest",
      onSale: "yes",
      page: "0",
      storageType: ["cold", "chilled"],
      packSize: ["1 kg", "1kg", "big"],
      brand: ["", "  ", "x".repeat(81)],
    });
    expect(state).toEqual({
      ...plain,
      storageTypes: ["chilled"],
      packSizes: ["1kg"],
    });
    expect(parseListingState({ page: "501" }).page).toBe(1);
    expect(parseListingState({ page: "2.5" }).page).toBe(1);
    expect(parseListingState({ page: "abc" }).page).toBe(1);
  });

  it("takes the first of a repeated parameter and cuts long searches", () => {
    expect(parseListingState({ q: ["dal", "rice"] }).q).toBe("dal");
    expect(parseListingState({ q: "x".repeat(200) }).q).toHaveLength(80);
  });

  it("drops repeated and blank filter values and caps their number", () => {
    expect(parseListingState({ brand: ["MDH", " MDH ", ""] }).brands).toEqual([
      "MDH",
    ]);
    const many = Array.from({ length: 30 }, (_, i) => `brand-${i}`);
    expect(parseListingState({ brand: many }).brands).toHaveLength(20);
  });

  it("reads a price range with one or both ends", () => {
    expect(parseListingState({ minPrice: "500" }).price).toEqual({
      min: 500,
      max: null,
    });
    expect(parseListingState({ maxPrice: "999" }).price).toEqual({
      min: 0,
      max: 999,
    });
    expect(parseListingState({ minPrice: "900", maxPrice: "100" }).price).toBe(
      null,
    );
    expect(parseListingState({ minPrice: "-1" }).price).toBe(null);
    expect(parseListingState({ minPrice: "1.5" }).price).toBe(null);
  });
});

describe("toProductQuery", () => {
  it("leaves defaults out and adds the category", () => {
    const state = parseListingState({});
    expect(toProductQuery(state, "rice")).toEqual({
      category: "rice",
      q: undefined,
      sort: undefined,
      onSale: undefined,
      orderable: undefined,
      brand: undefined,
      tag: undefined,
      storageType: undefined,
      packSize: undefined,
      minPrice: undefined,
      maxPrice: undefined,
      page: 1,
      limit: 24,
    });
  });

  it("passes filters on as the API takes them", () => {
    const state = parseListingState({
      q: "dal",
      sort: "name",
      onSale: "1",
      brand: ["MDH", "Amul"],
      packSize: "1kg",
      minPrice: "200",
      maxPrice: "499",
    });
    expect(toProductQuery(state)).toMatchObject({
      q: "dal",
      sort: "name",
      onSale: true,
      brand: ["MDH", "Amul"],
      packSize: ["1kg"],
      minPrice: 200,
      maxPrice: 499,
    });
    expect(
      toProductQuery(parseListingState({ minPrice: "5000" })),
    ).toMatchObject({ minPrice: 5000, maxPrice: undefined });
  });
});

describe("toSearchParams and toQueryString", () => {
  it("writes only what differs from the defaults", () => {
    expect(toSearchParams(parseListingState({}))).toEqual({});
    expect(
      toSearchParams(
        parseListingState({
          q: "dal",
          sort: "name",
          onSale: "1",
          page: "2",
          brand: ["MDH", "Amul"],
          minPrice: "0",
          maxPrice: "199",
        }),
      ),
    ).toEqual({
      q: "dal",
      brand: ["MDH", "Amul"],
      minPrice: "0",
      maxPrice: "199",
      onSale: "1",
      sort: "name",
      page: "2",
    });
  });

  it("applies overrides, for the links of the pagination", () => {
    const state = parseListingState({ q: "dal", page: "2" });
    expect(toSearchParams(state, { page: 1 })).toEqual({ q: "dal" });
    expect(toSearchParams(state, { page: 3 })).toEqual({ q: "dal", page: "3" });
  });

  it("repeats a parameter for a list and encodes the rest", () => {
    const state = parseListingState({
      brand: ["India Gate", "MDH"],
      minPrice: "500",
    });
    expect(toQueryString(state)).toBe(
      "brand=India+Gate&brand=MDH&minPrice=500",
    );
    expect(toQueryString(parseListingState({}))).toBe("");
  });
});

describe("filters", () => {
  it("counts the applied values and knows when there are none", () => {
    expect(filterCount(parseListingState({}))).toBe(0);
    expect(hasFilters(parseListingState({ q: "dal", sort: "name" }))).toBe(
      false,
    );
    const state = parseListingState({
      onSale: "1",
      brand: ["MDH", "Amul"],
      storageType: "chilled",
      minPrice: "100",
    });
    expect(filterCount(state)).toBe(5);
    expect(hasFilters(state)).toBe(true);
  });

  it("clears the filters but keeps the search and the sorting", () => {
    const state = parseListingState({
      q: "dal",
      sort: "name",
      page: "3",
      onSale: "1",
      brand: "MDH",
      maxPrice: "999",
    });
    expect(clearedFilters(state)).toEqual({
      ...plain,
      q: "dal",
      sort: "name",
    });
  });

  it("toggles one value of a facet and goes back to the first page", () => {
    const state = parseListingState({ brand: "MDH", page: "2" });
    expect(toggled(state, "brands", "Amul")).toMatchObject({
      brands: ["MDH", "Amul"],
      page: 1,
    });
    expect(toggled(state, "brands", "MDH")).toMatchObject({
      brands: [],
      page: 1,
    });
    expect(toggled(state, "storageTypes", "frozen").storageTypes).toEqual([
      "frozen",
    ]);
  });

  it("lists the applied filters in a fixed order, each with its removal", () => {
    const state = parseListingState({
      onSale: "1",
      orderable: "1",
      brand: ["MDH"],
      storageType: "chilled",
      tag: "new",
      packSize: "1kg",
      minPrice: "200",
      maxPrice: "499",
      page: "2",
    });
    const active = activeFilters(state);
    expect(active.map(({ filter }) => filter)).toEqual([
      { kind: "storageTypes", value: "chilled" },
      { kind: "brands", value: "MDH" },
      { kind: "packSizes", value: "1kg" },
      { kind: "tags", value: "new" },
      { kind: "price", value: { min: 200, max: 499 } },
      { kind: "onSale" },
      { kind: "orderable" },
    ]);
    expect(active[1].without).toMatchObject({ brands: [], page: 1 });
    expect(active[4].without).toMatchObject({ price: null, page: 1 });
    expect(active[6].without).toMatchObject({ orderable: false, page: 1 });
    expect(activeFilters(parseListingState({}))).toEqual([]);
  });
});

describe("isFiltered", () => {
  it("is false for the plain list, also on later pages", () => {
    expect(isFiltered(parseListingState({}))).toBe(false);
    expect(isFiltered(parseListingState({ page: "2" }))).toBe(false);
  });

  it("is true for search, sorting and filters", () => {
    expect(isFiltered(parseListingState({ q: "dal" }))).toBe(true);
    expect(isFiltered(parseListingState({ sort: "name" }))).toBe(true);
    expect(isFiltered(parseListingState({ orderable: "1" }))).toBe(true);
    expect(isFiltered(parseListingState({ brand: "MDH" }))).toBe(true);
    expect(isFiltered(parseListingState({ maxPrice: "999" }))).toBe(true);
  });
});

describe("pageWindow", () => {
  it("shows all pages of a short list", () => {
    expect(pageWindow(1, 3)).toEqual([1, 2, 3]);
    expect(pageWindow(1, 1)).toEqual([1]);
  });

  it("shows first, last and the neighbours, with gaps", () => {
    expect(pageWindow(5, 10)).toEqual([1, null, 4, 5, 6, null, 10]);
    expect(pageWindow(1, 10)).toEqual([1, 2, null, 10]);
    expect(pageWindow(10, 10)).toEqual([1, null, 9, 10]);
    expect(pageWindow(2, 10)).toEqual([1, 2, 3, null, 10]);
  });
});
