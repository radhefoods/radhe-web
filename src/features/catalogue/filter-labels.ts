import type { Locale } from "@/i18n/routing";
import type { ProductFacets, StorageType } from "@/lib/api/types";
import { formatMoney } from "@/lib/format/money";
import type { ActiveFilter, PriceRange } from "./listing-state";
import { formatPackSize } from "@/lib/format/product-name";

// The words of the filter panel, for the server (chips, the empty state)
// and the browser (the panel) alike. `t` is the `filters` namespace.

type Translate = (
  key: string,
  values?: Record<string, string | number>,
) => string;

/** Labels that exist in the translations; any other label shows as it is. */
export const KNOWN_TAGS = ["bestseller", "new", "seasonal"] as const;

export interface FilterLabels {
  storage: (value: StorageType) => string;
  tag: (value: string) => string;
  size: (value: string) => string;
  band: (range: PriceRange) => string;
  /** The text of a chip. */
  active: (filter: ActiveFilter) => string;
}

export function filterLabels(
  translate: unknown,
  locale: Locale,
  facets: Pick<ProductFacets, "packSizes">,
): FilterLabels {
  const t = translate as Translate;
  const money = (cents: number) => formatMoney(cents, locale);
  const labels: FilterLabels = {
    storage: (value) => t(`storageType.${value}`),
    tag: (value) =>
      (KNOWN_TAGS as readonly string[]).includes(value)
        ? t(`tag.${value}`)
        : value.charAt(0).toLocaleUpperCase(locale) + value.slice(1),
    size: (value) => {
      const found = facets.packSizes.find((size) => size.value === value);
      return found ? formatPackSize(found.packSize) : value;
    },
    band: (range) =>
      range.max === null
        ? t("priceFrom", { min: money(range.min) })
        : range.min === 0
          ? t("priceUnder", { max: money(range.max + 1) })
          : t("priceBetween", { min: money(range.min), max: money(range.max) }),
    active: (filter) => {
      switch (filter.kind) {
        case "brands":
          return filter.value;
        case "storageTypes":
          return labels.storage(filter.value as StorageType);
        case "packSizes":
          return labels.size(filter.value);
        case "tags":
          return labels.tag(filter.value);
        case "price":
          return labels.band(filter.value);
        case "onSale":
          return t("offers");
        case "orderable":
          return t("orderable");
      }
    },
  };
  return labels;
}
