"use client";

import { ArrowUpDown, ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import {
  useRef,
  useState,
  useTransition,
  type ComponentProps,
  type FormEvent,
  type ReactNode,
} from "react";
import { buttonStyles } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import type { VisibleFacets } from "@/features/catalogue/facets";
import { filterLabels } from "@/features/catalogue/filter-labels";
import {
  SORTS,
  activeFilters,
  clearedFilters,
  filterCount,
  parsePriceBandKey,
  priceBandKey,
  toSearchParams,
  type ListFacet,
  type ListingState,
} from "@/features/catalogue/listing-state";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { ProductFacets, ProductSort } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { FacetOptions, type FacetOption } from "./facet-options";
import { FacetPopover, pill, pillActive, pillIdle } from "./facet-popover";
import { formatPackSize } from "@/lib/format/product-name";

type Href = ComponentProps<typeof Link>["href"];

const badge =
  "grid size-5 place-items-center rounded-full bg-leaf-600 text-[0.6875rem] leading-none text-white tabular-nums";

/** The state after one control changed; `null` for a control that is not a filter. */
function changed(
  state: ListingState,
  name: string,
  value: string,
  checked: boolean,
): ListingState | null {
  const set = (facet: ListFacet): ListingState => {
    const values = state[facet] as string[];
    const next = checked
      ? values.includes(value)
        ? values
        : [...values, value]
      : values.filter((v) => v !== value);
    return { ...state, page: 1, [facet]: next };
  };
  switch (name) {
    case "brand":
      return set("brands");
    case "tag":
      return set("tags");
    case "storageType":
      return set("storageTypes");
    case "packSize":
      return set("packSizes");
    case "onSale":
      return { ...state, page: 1, onSale: checked };
    case "orderable":
      return { ...state, page: 1, orderable: checked };
    case "priceBand":
      return checked
        ? { ...state, page: 1, price: parsePriceBandKey(value) }
        : null;
    case "sort":
      return checked && (SORTS as readonly string[]).includes(value)
        ? { ...state, page: 1, sort: value as ProductSort }
        : null;
    default:
      return null;
  }
}

interface Section {
  key: keyof VisibleFacets;
  title: string;
  name: string;
  type: "checkbox" | "radio";
  options: FacetOption[];
  selected: string[];
  /** How many values are chosen: the badge of the pill. */
  count: number;
  /** The state with this facet cleared. */
  cleared: ListingState;
}

/**
 * The filters and the sorting of a product list, above the products. On
 * wide screens a row of pills, each opening its values with counts, and
 * two switches; on phones two buttons that open everything in a sheet.
 * Under the row the applied filters as chips that take one filter off
 * each, and "clear all". Every change applies at once by changing the
 * address; without scripts the same form is sent with "Apply".
 */
export function ListingControls({
  state,
  facets,
  visible,
  total,
  action,
  children,
}: {
  state: ListingState;
  facets: ProductFacets;
  visible: VisibleFacets;
  /** Products in the list with every filter. */
  total: number;
  /** The address of the list, for the form without scripts. */
  action: string;
  /** The products and the pages, dimmed while a change is on its way. */
  children: ReactNode;
}) {
  const t = useTranslations("filters");
  const tCommon = useTranslations("common");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const [pending, startTransition] = useTransition();
  // What was just chosen, shown at once while the new page is on its way.
  const [optimistic, setOptimistic] = useState<ListingState | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const filtersButton = useRef<HTMLButtonElement>(null);
  const sortButton = useRef<HTMLButtonElement>(null);
  // Which button opened the sheet: focus goes back to it when it closes.
  const [opener, setOpener] = useState<"filters" | "sort">("filters");
  const labels = filterLabels(t, locale, facets);
  const view = pending && optimistic ? optimistic : state;

  const hrefOf = (next: ListingState): Href =>
    ({ pathname, params, query: toSearchParams(next) }) as unknown as Href;
  const go = (next: ListingState) => {
    setOptimistic(next);
    startTransition(() => {
      router.replace(hrefOf(next) as Parameters<typeof router.replace>[0], {
        scroll: false,
      });
    });
  };
  const onChange = (event: FormEvent<HTMLFormElement>) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    const next = changed(view, input.name, input.value, input.checked);
    if (next) go(next);
  };
  const openSheet = (button: "filters" | "sort") => {
    setOpener(button);
    setSheetOpen(true);
  };

  const priceKey = view.price ? priceBandKey(view.price) : "";
  const allSections: Section[] = [
    {
      key: "brands",
      title: t("brand"),
      name: "brand",
      type: "checkbox",
      options: facets.brands.map((b) => ({
        value: b.value,
        label: b.value,
        count: b.count,
      })),
      selected: view.brands,
      count: view.brands.length,
      cleared: { ...view, page: 1, brands: [] },
    },
    {
      key: "storageTypes",
      title: t("storage"),
      name: "storageType",
      type: "checkbox",
      options: facets.storageTypes.map((s) => ({
        value: s.value,
        label: labels.storage(s.value),
        count: s.count,
      })),
      selected: view.storageTypes,
      count: view.storageTypes.length,
      cleared: { ...view, page: 1, storageTypes: [] },
    },
    {
      key: "price",
      title: t("price"),
      name: "priceBand",
      type: "radio",
      options: [
        { value: "", label: t("anyPrice") },
        ...facets.priceBands.map((band) => ({
          value: priceBandKey(band),
          label: labels.band(band),
          count: band.count,
        })),
      ],
      selected: [priceKey],
      count: view.price ? 1 : 0,
      cleared: { ...view, page: 1, price: null },
    },
    {
      key: "packSizes",
      title: t("packSize"),
      name: "packSize",
      type: "checkbox",
      options: facets.packSizes.map((s) => ({
        value: s.value,
        label: formatPackSize(s.packSize),
        count: s.count,
      })),
      selected: view.packSizes,
      count: view.packSizes.length,
      cleared: { ...view, page: 1, packSizes: [] },
    },
    {
      key: "tags",
      title: t("tags"),
      name: "tag",
      type: "checkbox",
      options: facets.tags.map((x) => ({
        value: x.value,
        label: labels.tag(x.value),
        count: x.count,
      })),
      selected: view.tags,
      count: view.tags.length,
      cleared: { ...view, page: 1, tags: [] },
    },
  ];
  const sections = allSections.filter((section) => visible[section.key]);

  const sortOptions: FacetOption[] = SORTS.map((sort) => ({
    value: sort,
    label: t(`sort.${sort}`),
  }));
  const sortLabel = t(`sort.${view.sort}`);
  const onSaleCount = facets.onSale.find((e) => e.value)?.count ?? 0;
  const orderableCount = facets.orderable.find((e) => e.value)?.count ?? 0;
  const active = activeFilters(view);
  const count = filterCount(view);
  const cleared = clearedFilters(view);
  const countLine = (
    <p
      role="status"
      className="text-ink-muted text-[0.9375rem] font-semibold whitespace-nowrap"
    >
      {t("count", { count: total })}
    </p>
  );
  const toggles = (
    <>
      {visible.onSale && (
        <Toggle
          name="onSale"
          checked={view.onSale}
          label={t("offers")}
          count={onSaleCount}
          tone="sale"
        />
      )}
      {visible.orderable && (
        <Toggle
          name="orderable"
          checked={view.orderable}
          label={t("orderable")}
          count={orderableCount}
        />
      )}
    </>
  );
  const facetOptions = (section: Section, limit: number) => (
    <FacetOptions
      name={section.name}
      type={section.type}
      options={section.options}
      selected={section.selected}
      limit={limit}
      expanded={expanded[section.key] ?? false}
      onExpand={(value) =>
        setExpanded((all) => ({ ...all, [section.key]: value }))
      }
    />
  );

  const sheetFooter = (
    <div className="flex gap-3">
      {count > 0 && (
        <Link
          href={hrefOf(cleared)}
          replace
          scroll={false}
          onClick={() => setSheetOpen(false)}
          className={buttonStyles({
            variant: "secondary",
            size: "sm",
            className: "shrink-0 whitespace-nowrap",
          })}
        >
          {t("clearAll")}
        </Link>
      )}
      <button
        type="button"
        onClick={() => setSheetOpen(false)}
        className={buttonStyles({ size: "sm", className: "min-w-0 flex-1" })}
      >
        {t("showProducts", { count: total })}
      </button>
    </div>
  );

  return (
    <div className="space-y-3">
      <form
        method="get"
        action={action}
        onChange={onChange}
        onSubmit={(event) => event.preventDefault()}
        className="space-y-3"
      >
        {view.q && <input type="hidden" name="q" value={view.q} />}
        {/* Without scripts the pills open as plain details on every screen. */}
        <noscript>
          <style>{`.filters-bar{display:contents!important}.filters-phone{display:none!important}`}</style>
        </noscript>

        <div className="flex flex-wrap items-center gap-2">
          {/* Wide screens: the pills and the switches. */}
          <div className="filters-bar hidden md:contents">
            {sections.map((section) => (
              <FacetPopover
                key={section.key}
                label={section.title}
                count={section.count}
              >
                {facetOptions(section, 8)}
                {section.count > 0 && (
                  <button
                    type="button"
                    onClick={() => go(section.cleared)}
                    className="text-leaf-700 border-line mt-1 flex min-h-10 w-full items-center rounded-sm border-t px-2.5 text-sm font-semibold hover:underline"
                  >
                    {t("clear")}
                  </button>
                )}
              </FacetPopover>
            ))}
            {toggles}
          </div>
          {/* Phones: two buttons that open the sheet. */}
          <div className="filters-phone contents md:hidden">
            <button
              ref={filtersButton}
              type="button"
              aria-haspopup="dialog"
              aria-expanded={sheetOpen}
              onClick={() => openSheet("filters")}
              className={cn(pill, count > 0 ? pillActive : pillIdle)}
            >
              <SlidersHorizontal aria-hidden="true" className="size-4" />
              {t("open")}
              {count > 0 && <span className={badge}>{count}</span>}
            </button>
            <button
              ref={sortButton}
              type="button"
              aria-haspopup="dialog"
              aria-expanded={sheetOpen}
              aria-label={`${t("sortBy")}: ${sortLabel}`}
              onClick={() => openSheet("sort")}
              className={cn(
                pill,
                view.sort !== "recommended" ? pillActive : pillIdle,
              )}
            >
              <ArrowUpDown aria-hidden="true" className="size-4" />
              {t("sortTitle")}
            </button>
          </div>
          <div className="ml-auto flex items-center gap-3">
            {countLine}
            <div className="filters-bar hidden md:contents">
              <FacetPopover
                label={`${t("sortBy")}: ${sortLabel}`}
                align="right"
                width="w-60"
              >
                <FacetOptions
                  name="sort"
                  type="radio"
                  options={sortOptions}
                  selected={[view.sort]}
                  limit={99}
                />
              </FacetPopover>
            </div>
          </div>
        </div>

        {active.length > 0 && (
          <ul
            aria-label={t("applied")}
            className="flex flex-wrap items-center gap-2"
          >
            {active.map(({ filter, without }) => {
              const label = labels.active(filter);
              return (
                <li key={`${filter.kind}-${label}`}>
                  <Link
                    href={hrefOf(without)}
                    replace
                    scroll={false}
                    aria-label={t("remove", { name: label })}
                    className="bg-wheat-100 text-wheat-800 hover:bg-wheat-200 inline-flex min-h-9 items-center gap-1.5 rounded-full py-1 pr-2.5 pl-3.5 text-[0.8125rem] font-bold transition-colors duration-150"
                  >
                    {label}
                    <X aria-hidden="true" className="size-3.5" />
                  </Link>
                </li>
              );
            })}
            <li>
              <Link
                href={hrefOf(cleared)}
                replace
                scroll={false}
                className="text-leaf-700 inline-flex min-h-9 items-center rounded-full px-2 text-[0.8125rem] font-bold hover:underline"
              >
                {t("clearAll")}
              </Link>
            </li>
          </ul>
        )}

        <Sheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          title={t("title")}
          closeLabel={tCommon("close")}
          returnFocusTo={opener === "sort" ? sortButton : filtersButton}
          footer={sheetFooter}
        >
          <div className="divide-line -mt-3 divide-y">
            <Accordion title={t("sortBy")} note={sortLabel}>
              <FacetOptions
                name="sort"
                type="radio"
                options={sortOptions}
                selected={[view.sort]}
                limit={99}
              />
            </Accordion>
            {sections.map((section) => (
              <Accordion
                key={section.key}
                title={section.title}
                count={section.count}
              >
                {facetOptions(section, 6)}
              </Accordion>
            ))}
            {(visible.onSale || visible.orderable) && (
              <div className="flex flex-wrap gap-2 py-4">{toggles}</div>
            )}
          </div>
        </Sheet>

        {/* Only needed without scripts; with scripts changes apply at once. */}
        <noscript>
          <button type="submit" className={buttonStyles({ size: "sm" })}>
            {t("apply")}
          </button>
        </noscript>
      </form>

      <div
        aria-busy={pending || undefined}
        className={cn(
          "transition-opacity duration-200",
          pending && "opacity-60",
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** A switch as a pill: "Offers" turns coral, the colour of a reduced price. */
function Toggle({
  name,
  checked,
  label,
  count,
  tone = "leaf",
}: {
  name: string;
  checked: boolean;
  label: string;
  count: number;
  tone?: "leaf" | "sale";
}) {
  // A switch that would leave nothing cannot be turned on.
  const dead = count === 0 && !checked;
  return (
    <label
      className={cn(
        pill,
        pillIdle,
        dead && "text-ink-subtle hover:bg-mist cursor-not-allowed",
        tone === "sale"
          ? "has-checked:border-red-600 has-checked:bg-red-50 has-checked:text-red-600"
          : "has-checked:border-leaf-600 has-checked:bg-leaf-50 has-checked:text-leaf-700",
        "has-focus-visible:outline-leaf-600 has-focus-visible:outline-3 has-focus-visible:outline-offset-2",
      )}
    >
      <input
        type="checkbox"
        name={name}
        value="1"
        checked={checked}
        onChange={() => {}}
        disabled={dead}
        className={cn(
          "size-4",
          tone === "sale" ? "accent-red-600" : "accent-leaf-600",
        )}
      />
      {label}
      <span className="text-xs tabular-nums opacity-70">{count}</span>
    </label>
  );
}

/** One facet of the sheet on phones: open by default, closable. */
function Accordion({
  title,
  count = 0,
  note,
  children,
}: {
  title: string;
  count?: number;
  /** A word beside the title while nothing is counted: the current sorting. */
  note?: string;
  children: ReactNode;
}) {
  return (
    <details open className="group py-1">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 text-[0.9375rem] font-bold [&::-webkit-details-marker]:hidden">
        {title}
        {count > 0 ? (
          <span className={badge}>{count}</span>
        ) : (
          note && (
            <span className="text-ink-subtle text-sm font-semibold">
              {note}
            </span>
          )
        )}
        <ChevronDown
          aria-hidden="true"
          className="ml-auto size-5 shrink-0 transition-transform duration-150 group-open:rotate-180"
        />
      </summary>
      <div className="pb-3">{children}</div>
    </details>
  );
}
