import type { FacetCount, PriceBand, ProductFacets } from "@/lib/api/types";
import { sameRange, type ListingState, type PriceRange } from "./listing-state";

export { parsePriceBandKey, priceBandKey, sameRange } from "./listing-state";

// What the filter panel shows is decided by the data: a facet appears only
// when choosing from it could make a difference, or when it is already in
// use (a chosen value must always be removable).

export interface VisibleFacets {
  brands: boolean;
  storageTypes: boolean;
  packSizes: boolean;
  tags: boolean;
  price: boolean;
  onSale: boolean;
  orderable: boolean;
}

/** How many entries have at least one product. */
function withProducts(entries: { count: number }[]): number {
  return entries.filter((entry) => entry.count > 0).length;
}

export function visibleFacets(
  facets: ProductFacets,
  state: ListingState,
): VisibleFacets {
  const flag = (
    entries: { value: boolean; count: number }[],
    chosen: boolean,
  ): boolean => {
    const yes = entries.find((e) => e.value)?.count ?? 0;
    const no = entries.find((e) => !e.value)?.count ?? 0;
    // Something to choose and something to leave out.
    return chosen || (yes > 0 && no > 0);
  };
  return {
    brands: state.brands.length > 0 || withProducts(facets.brands) >= 2,
    storageTypes:
      state.storageTypes.length > 0 || withProducts(facets.storageTypes) >= 2,
    packSizes:
      state.packSizes.length > 0 || withProducts(facets.packSizes) >= 2,
    tags: state.tags.length > 0 || withProducts(facets.tags) >= 1,
    price: state.price !== null || withProducts(facets.priceBands) >= 2,
    onSale: flag(facets.onSale, state.onSale),
    orderable: flag(facets.orderable, state.orderable),
  };
}

/**
 * The facets of the whole list (no filter) with the counts of the current
 * one: every value the list has stays listed, at 0 when the other filters
 * leave nothing for it, so the panel never loses a pill or a row while
 * the visitor narrows down. Bands no product of the list falls into are
 * left out.
 */
export function mergeFacets(
  scope: ProductFacets,
  current: ProductFacets,
): ProductFacets {
  const merge = <T extends FacetCount<string>>(all: T[], now: T[]): T[] => {
    const counts = new Map(now.map((entry) => [entry.value, entry.count]));
    const known = new Set(all.map((entry) => entry.value));
    return [
      ...all.map((entry) => ({
        ...entry,
        count: counts.get(entry.value) ?? 0,
      })),
      ...now.filter((entry) => !known.has(entry.value)),
    ];
  };
  return {
    ...current,
    brands: merge(scope.brands, current.brands),
    tags: merge(scope.tags, current.tags),
    storageTypes: merge(scope.storageTypes, current.storageTypes),
    packSizes: merge(scope.packSizes, current.packSizes),
    priceBands: scope.priceBands
      .filter((band) => band.count > 0)
      .map((band) => ({
        ...band,
        count:
          current.priceBands.find((other) => sameRange(other, band))?.count ??
          0,
      })),
  };
}

/** The band of the facets that a chosen range stands for, if any. */
export function bandOf(
  bands: PriceBand[],
  range: PriceRange | null,
): PriceBand | undefined {
  return range ? bands.find((band) => sameRange(band, range)) : undefined;
}
