import { ChevronLeft, ChevronRight, SearchX } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ComponentProps } from "react";
import { buttonStyles } from "@/components/ui/button";
import { controlStyles } from "@/components/ui/field";
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

const toggle =
  "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border-[1.5px] border-line-strong bg-white px-3.5 text-[0.9375rem] font-semibold select-none hover:border-ink-subtle has-checked:border-blue-600 has-checked:bg-blue-50 has-checked:text-blue-800 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-blue-600";

/**
 * A list of products with sorting, filters and pages: the body of "All
 * products", of a search and of a category. Its state is the address.
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
    <section aria-label={listName} className="space-y-5">
      <FilterForm
        action={getPathname({ href: base, locale })}
        values={{
          sort: state.sort,
          onSale: state.onSale,
          orderable: state.orderable,
        }}
        className="flex flex-wrap items-center gap-2.5"
      >
        {state.q && <input type="hidden" name="q" value={state.q} />}
        <label className={toggle}>
          <input
            type="checkbox"
            name="orderable"
            value="1"
            defaultChecked={state.orderable}
            className="size-4 accent-blue-600"
          />
          {t("orderable")}
        </label>
        <label className={toggle}>
          <input
            type="checkbox"
            name="onSale"
            value="1"
            defaultChecked={state.onSale}
            className="size-4 accent-blue-600"
          />
          {t("onSale")}
        </label>
        <label className="ml-auto flex items-center gap-2 text-[0.9375rem]">
          <span className="font-semibold whitespace-nowrap max-sm:sr-only">
            {t("sortLabel")}
          </span>
          <select
            name="sort"
            defaultValue={state.sort}
            className={cn(controlStyles, "min-h-11 w-auto pr-8 font-semibold")}
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
      </FilterForm>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-ink-muted text-[0.9375rem]" role="status">
          {t("resultCount", { count: page.total })}
        </p>
        {filtered && !state.q && (
          <Link
            href={hrefFor({
              sort: "recommended",
              onSale: false,
              orderable: false,
              page: 1,
            })}
            className="rounded-xs text-[0.9375rem] font-semibold text-blue-700 underline underline-offset-4"
          >
            {t("reset")}
          </Link>
        )}
      </div>

      {page.items.length === 0 ? (
        <div className="bg-mist flex flex-col items-center gap-3 rounded-xl px-6 py-14 text-center">
          <SearchX aria-hidden="true" className="text-ink-subtle size-10" />
          <h2 className="font-display text-3xl text-blue-900">
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
          className="flex items-center justify-center gap-1.5 pt-4"
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
                  "grid size-11 place-items-center rounded-md text-[0.9375rem] font-bold tabular-nums",
                  number === page.page
                    ? "bg-blue-900 text-white"
                    : "hover:bg-mist",
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
  const className = "grid size-11 place-items-center rounded-md";
  if (!href) {
    return (
      <span aria-hidden="true" className={cn(className, "text-ink-subtle/50")}>
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      rel={rel}
      aria-label={label}
      className={cn(className, "hover:bg-mist")}
    >
      {children}
    </Link>
  );
}
