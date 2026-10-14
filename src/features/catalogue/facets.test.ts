import { describe, expect, it } from "vitest";
import type { ProductFacets } from "@/lib/api/types";
import {
  bandOf,
  mergeFacets,
  parsePriceBandKey,
  priceBandKey,
  sameRange,
  visibleFacets,
} from "./facets";
import { parseListingState } from "./listing-state";

const facets: ProductFacets = {
  total: 22,
  brands: [
    { value: "Radhe", count: 13 },
    { value: "MDH", count: 3 },
  ],
  tags: [{ value: "new", count: 1 }],
  storageTypes: [
    { value: "ambient", count: 18 },
    { value: "chilled", count: 3 },
  ],
  packSizes: [
    {
      value: "100g",
      packSize: { value: 100, unit: "g", label: "100 g" },
      count: 3,
    },
    {
      value: "1kg",
      packSize: { value: 1, unit: "kg", label: "1 kg" },
      count: 6,
    },
  ],
  priceBands: [
    { min: 0, max: 199, count: 3 },
    { min: 200, max: 499, count: 11 },
    { min: 500, max: null, count: 0 },
  ],
  price: { min: 179, max: 2999 },
  onSale: [
    { value: true, count: 3 },
    { value: false, count: 21 },
  ],
  orderable: [
    { value: true, count: 22 },
    { value: false, count: 0 },
  ],
};

describe("visibleFacets", () => {
  it("shows a facet when there is a choice to make", () => {
    expect(visibleFacets(facets, parseListingState({}))).toEqual({
      brands: true,
      storageTypes: true,
      packSizes: true,
      tags: true,
      price: true,
      onSale: true,
      // Everything can be ordered: nothing to leave out.
      orderable: false,
    });
  });

  it("hides a facet with one value or none, unless it is in use", () => {
    const narrow: ProductFacets = {
      ...facets,
      brands: [{ value: "MDH", count: 3 }],
      tags: [],
      storageTypes: [
        { value: "ambient", count: 3 },
        { value: "chilled", count: 0 },
      ],
      priceBands: [{ min: 0, max: 199, count: 3 }],
      onSale: [
        { value: true, count: 0 },
        { value: false, count: 3 },
      ],
    };
    expect(visibleFacets(narrow, parseListingState({}))).toMatchObject({
      brands: false,
      tags: false,
      storageTypes: false,
      price: false,
      onSale: false,
    });
    expect(
      visibleFacets(
        narrow,
        parseListingState({
          brand: "MDH",
          storageType: "chilled",
          onSale: "1",
          minPrice: "0",
          maxPrice: "199",
        }),
      ),
    ).toMatchObject({
      brands: true,
      storageTypes: true,
      onSale: true,
      price: true,
    });
  });
});

describe("mergeFacets", () => {
  it("keeps every value of the list, with the counts of the current one", () => {
    const current: ProductFacets = {
      ...facets,
      total: 3,
      brands: [
        { value: "MDH", count: 3 },
        { value: "Radhe", count: 13 },
        { value: "Tata", count: 2 },
      ],
      tags: [],
      storageTypes: [{ value: "ambient", count: 3 }],
      packSizes: [
        {
          value: "100g",
          packSize: { value: 100, unit: "g", label: "100 g" },
          count: 3,
        },
      ],
      priceBands: [
        { min: 0, max: 199, count: 2 },
        { min: 200, max: 499, count: 1 },
        { min: 500, max: null, count: 0 },
      ],
    };
    const merged = mergeFacets(facets, current);
    expect(merged.total).toBe(3);
    expect(merged.brands).toEqual([
      { value: "Radhe", count: 13 },
      { value: "MDH", count: 3 },
      { value: "Tata", count: 2 },
    ]);
    expect(merged.tags).toEqual([{ value: "new", count: 0 }]);
    expect(merged.storageTypes).toEqual([
      { value: "ambient", count: 3 },
      { value: "chilled", count: 0 },
    ]);
    expect(merged.packSizes.map((s) => [s.value, s.count])).toEqual([
      ["100g", 3],
      ["1kg", 0],
    ]);
    // The open band has no product in the whole list: left out.
    expect(merged.priceBands).toEqual([
      { min: 0, max: 199, count: 2 },
      { min: 200, max: 499, count: 1 },
    ]);
  });
});

describe("price bands", () => {
  it("writes and reads a band as one control value", () => {
    expect(priceBandKey({ min: 200, max: 499 })).toBe("200-499");
    expect(priceBandKey({ min: 5000, max: null })).toBe("5000-");
    expect(parsePriceBandKey("200-499")).toEqual({ min: 200, max: 499 });
    expect(parsePriceBandKey("5000-")).toEqual({ min: 5000, max: null });
    expect(parsePriceBandKey("")).toBe(null);
    expect(parsePriceBandKey("abc")).toBe(null);
    expect(parsePriceBandKey("500-100")).toBe(null);
  });

  it("finds the band a chosen range stands for", () => {
    expect(bandOf(facets.priceBands, { min: 200, max: 499 })).toMatchObject({
      count: 11,
    });
    expect(bandOf(facets.priceBands, { min: 210, max: 499 })).toBeUndefined();
    expect(bandOf(facets.priceBands, null)).toBeUndefined();
    expect(sameRange({ min: 0, max: null }, { min: 0, max: null })).toBe(true);
    expect(sameRange(null, { min: 0, max: null })).toBe(false);
  });
});
