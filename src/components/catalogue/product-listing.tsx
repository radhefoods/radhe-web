import { ChevronLeft, ChevronRight, SearchX } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ComponentProps } from "react";
import { buttonStyles } from "@/components/ui/button";
import { listProducts } from "@/features/catalogue/data";
import {
  SORTS,
  isFiltered,
  pageWindow,
  toProductQuery,
  toSearchParams,
  type ListingState,
} from "@/features/catalogue/listing-state";
import { Link, getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import { JsonLd, itemListJsonLd } from "@/lib/seo/json-ld";
import { FilterForm } from "./filter-form";
import { ProductGrid } from "./product-grid";

type Href = ComponentProps<typeof Link>["href"];
type BaseHref =
  "/products" | { pathname: "/category/[slug]"; params: { slug: string } };

/** A filter as a pill: mist at rest, a leaf tint when it is on. */
const toggle =
  "has-checked:border-leaf-600 has-checked:bg-leaf-50 has-checked:text-leaf-700 has-focus-visible:outline-leaf-600 bg-mist hover:bg-cloud flex min-h-11 cursor-pointer items-center gap-2.5 rounded-full border-2 border-transparent px-4 text-sm font-bold select-none transition-colors duration-150 has-focus-visible:outline-3 has-focus-visible:outline-offset-2";
/** "Reduced only" turns coral, the colour of a reduced price. */
const toggleSale =
  "has-checked:border-red-600 has-checked:bg-red-50 has-checked:text-red-600";
const pageLink = "grid size-11 place-items-center rounded-full";

/**
 * A list of products with sorting, filters and pages: the body of "All
 * products", of a search and of a category. Its state is the address.
 *
 * One toolbar above the products: the count, the filters as pills, and
 * the sorting. The filters are the ones the API offers (orderable,
 * reduced, search); the row is ready for more when the API has them.
 */
export async function ProductListing({
  locale,
  base,
  category,
  state,
  listName,
  emptyText,
}: {
  locale: Locale;
  /** The page this list is on; filters and pages link back to it. */
  base: BaseHref;
  /** Slug of the category the list is limited to. */
  category?: string;
  state: ListingState;
  /** Name of the list for search engines. */
  listName: string;
  /** What to say when the unfiltered list is empty. */
  emptyText: string;
}) {
  const t = await getTranslations("catalogue");
  const page = await listProducts(toProductQuery(state, category), locale);
  const filtered = isFiltered(state);

  const hrefFor = (overrides: Partial<ListingState>): Href =>
    ({
      ...(typeof base === "string" ? { pathname: base } : base),
      query: toSearchParams(state, overrides),
    }) as Href;

  return (
    <section aria-label={listName}>
      <FilterForm
        action={getPathname({ href: base, locale })}
        values={{
          sort: state.sort,
          onSale: state.onSale,
          orderable: state.orderable,
        }}
        className="flex flex-wrap items-center justify-between gap-3"
      >
        {state.q && <input type="hidden" name="q" value={state.q} />}
        <p
          className="text-ink-muted text-[0.9375rem] font-semibold"
          role="status"
        >
          {t("resultCount", { count: page.total })}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label={t("filtersTitle")}
            className="flex flex-wrap items-center gap-2"
          >
            <label className={toggle}>
              <input
                type="checkbox"
                name="orderable"
                value="1"
                defaultChecked={state.orderable}
                className="accent-leaf-600 size-4"
              />
              {t("orderable")}
            </label>
            <label className={cn(toggle, toggleSale)}>
              <input
                type="checkbox"
                name="onSale"
                value="1"
                defaultChecked={state.onSale}
                className="size-4 accent-red-600"
              />
              {t("onSale")}
            </label>
            {filtered && !state.q && (
              <Link
                href={hrefFor({
                  sort: "recommended",
                  onSale: false,
                  orderable: false,
                  page: 1,
                })}
                className="text-leaf-700 inline-flex min-h-11 items-center rounded-full px-2 text-sm font-semibold hover:underline"
              >
                {t("reset")}
              </Link>
            )}
          </div>
          <label className="bg-mist flex min-h-11 items-center gap-2 rounded-full pr-3 pl-4 text-sm">
            <span className="text-ink-subtle font-semibold whitespace-nowrap max-sm:sr-only">
              {t("sortLabel")}
            </span>
            <select
              name="sort"
              defaultValue={state.sort}
              className="text-ink min-h-9 max-w-44 rounded-full bg-transparent pr-1 font-bold"
            >
              {SORTS.map((sort) => (
                <option key={sort} value={sort}>
                  {t(`sort.${sort}`)}
                </option>
              ))}
            </select>
          </label>
          {/* Only needed without scripts; with scripts changes apply at once. */}
          <noscript>
            <button type="submit" className={buttonStyles({ size: "sm" })}>
              {t("apply")}
            </button>
          </noscript>
        </div>
      </FilterForm>

      <div className="mt-5">
        {page.items.length === 0 ? (
          <div className="bg-mist flex flex-col items-center gap-3 rounded-xl px-6 py-14 text-center">
            <SearchX aria-hidden="true" className="text-ink-subtle size-10" />
            <h2 className="font-display text-ink text-2xl">
              {t("emptyTitle")}
            </h2>
            <p className="text-ink-muted max-w-md">
              {state.q
                ? t("emptySearchText", { query: state.q })
                : filtered
                  ? t("emptyText")
                  : emptyText}
            </p>
            {(filtered || category) && (
              <Link
                href="/products"
                className={buttonStyles({ variant: "secondary", size: "sm" })}
              >
                {t("showAll")}
              </Link>
            )}
          </div>
        ) : (
          <>
            <ProductGrid products={page.items} headingLevel="h2" wide />
            <JsonLd data={itemListJsonLd(listName, page.items, locale)} />
          </>
        )}

        {page.totalPages > 1 && (
          <nav
            aria-label={t("pagination")}
            className="flex items-center justify-center gap-1.5 pt-8"
          >
            <PageLink
              href={page.page > 1 ? hrefFor({ page: page.page - 1 }) : null}
              label={t("previous")}
              rel="prev"
            >
              <ChevronLeft aria-hidden="true" className="size-5" />
            </PageLink>
            {pageWindow(page.page, page.totalPages).map((number, index) =>
              number === null ? (
                <span
                  key={`gap-${index}`}
                  aria-hidden="true"
                  className="text-ink-subtle px-1"
                >
                  …
                </span>
              ) : (
                <Link
                  key={number}
                  href={hrefFor({ page: number })}
                  aria-current={number === page.page ? "page" : undefined}
                  aria-label={t("pageOf", {
                    page: number,
                    total: page.totalPages,
                  })}
                  className={cn(
                    pageLink,
                    "text-[0.9375rem] font-bold tabular-nums transition-colors duration-150",
                    number === page.page
                      ? "bg-leaf-600 text-white"
                      : "bg-mist hover:bg-cloud",
                  )}
                >
                  {number}
                </Link>
              ),
            )}
            <PageLink
              href={
                page.page < page.totalPages
                  ? hrefFor({ page: page.page + 1 })
                  : null
              }
              label={t("next")}
              rel="next"
            >
              <ChevronRight aria-hidden="true" className="size-5" />
            </PageLink>
          </nav>
        )}
      </div>
    </section>
  );
}

function PageLink({
  href,
  label,
  rel,
  children,
}: {
  href: Href | null;
  label: string;
  rel: "prev" | "next";
  children: React.ReactNode;
}) {
  if (!href) {
    return (
      <span aria-hidden="true" className={cn(pageLink, "text-ink-subtle/50")}>
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      rel={rel}
      aria-label={label}
      className={cn(
        pageLink,
        "bg-mist hover:bg-cloud transition-colors duration-150",
      )}
    >
      {children}
    </Link>
  );
}
