import { describe, expect, it } from "vitest";
import {
  isFiltered,
  pageWindow,
  parseListingState,
  toProductQuery,
  toSearchParams,
} from "./listing-state";

describe("parseListingState", () => {
  it("has sensible defaults", () => {
    expect(parseListingState({})).toEqual({
      q: undefined,
      sort: "recommended",
      onSale: false,
      orderable: false,
      page: 1,
    });
  });

  it("reads a full address", () => {
    expect(
      parseListingState({
        q: " reis ",
        sort: "price_asc",
        onSale: "1",
        orderable: "1",
        page: "3",
      }),
    ).toEqual({
      q: "reis",
      sort: "price_asc",
      onSale: true,
      orderable: true,
      page: 3,
    });
  });

  it("ignores what the API would refuse", () => {
    const state = parseListingState({
      q: "a",
      sort: "cheapest",
      onSale: "yes",
      page: "0",
    });
    expect(state).toEqual({
      q: undefined,
      sort: "recommended",
      onSale: false,
      orderable: false,
      page: 1,
    });
    expect(parseListingState({ page: "501" }).page).toBe(1);
    expect(parseListingState({ page: "2.5" }).page).toBe(1);
    expect(parseListingState({ page: "abc" }).page).toBe(1);
  });

  it("takes the first of a repeated parameter and cuts long searches", () => {
    expect(parseListingState({ q: ["dal", "rice"] }).q).toBe("dal");
    expect(parseListingState({ q: "x".repeat(200) }).q).toHaveLength(80);
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
      page: 1,
      limit: 24,
    });
  });

  it("passes filters on", () => {
    const state = parseListingState({ q: "dal", sort: "name", onSale: "1" });
    expect(toProductQuery(state)).toMatchObject({
      q: "dal",
      sort: "name",
      onSale: true,
    });
  });
});

describe("toSearchParams", () => {
  it("writes only what differs from the defaults", () => {
    expect(toSearchParams(parseListingState({}))).toEqual({});
    expect(
      toSearchParams(
        parseListingState({ q: "dal", sort: "name", onSale: "1", page: "2" }),
      ),
    ).toEqual({ q: "dal", sort: "name", onSale: "1", page: "2" });
  });

  it("applies overrides, for the links of the pagination", () => {
    const state = parseListingState({ q: "dal", page: "2" });
    expect(toSearchParams(state, { page: 1 })).toEqual({ q: "dal" });
    expect(toSearchParams(state, { page: 3 })).toEqual({ q: "dal", page: "3" });
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
