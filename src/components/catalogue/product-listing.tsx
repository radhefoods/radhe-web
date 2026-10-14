import { ChevronLeft, ChevronRight, SearchX } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ComponentProps } from "react";
import { buttonStyles } from "@/components/ui/button";
import { getProductFacets, listProducts } from "@/features/catalogue/data";
import { mergeFacets, visibleFacets } from "@/features/catalogue/facets";
import { filterLabels } from "@/features/catalogue/filter-labels";
import {
  activeFilters,
  clearedFilters,
  hasFilters,
  pageWindow,
  toProductQuery,
  toSearchParams,
  type ListingState,
} from "@/features/catalogue/listing-state";
import { AreaMessages } from "@/i18n/area-messages";
import { Link, getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import { JsonLd, itemListJsonLd } from "@/lib/seo/json-ld";
import { ListingControls } from "./filters/listing-controls";
import { ProductGrid } from "./product-grid";

type Href = ComponentProps<typeof Link>["href"];
type BaseHref =
  "/products" | { pathname: "/category/[slug]"; params: { slug: string } };

const pageLink = "grid size-11 place-items-center rounded-full";

/**
 * A list of products with filters, sorting and pages: the body of "All
 * products", of a search and of a category. Its state is the address.
 *
 * The products and the counts behind the filters come from the API in
 * one go; the panel shows only the filters the products of this list
 * support. When nothing is left, the page names the one filter whose
 * removal brings back the most products.
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
  const [t, tf] = await Promise.all([
    getTranslations("catalogue"),
    getTranslations("filters"),
  ]);
  const query = toProductQuery(state, category);
  const narrowed = hasFilters(state);
  // The counts under the current filters, and those of the whole list: the
  // panel keeps every filter the list has, so nothing jumps while narrowing.
  const [page, current, scope] = await Promise.all([
    listProducts(query, locale),
    getProductFacets(query, locale),
    narrowed
      ? getProductFacets(
          toProductQuery(clearedFilters(state), category),
          locale,
        )
      : null,
  ]);
  const facets = scope ? mergeFacets(scope, current) : current;
  const visible = visibleFacets(scope ?? current, state);
  const baseHref = typeof base === "string" ? { pathname: base } : base;
  const hrefOf = (
    next: ListingState,
    overrides?: Partial<ListingState>,
  ): Href => ({ ...baseHref, query: toSearchParams(next, overrides) }) as Href;

  // Nothing left: which one filter, taken off, brings back the most products?
  let suggestion: { name: string; count: number; href: Href } | null = null;
  if (page.total === 0 && narrowed) {
    const active = activeFilters(state);
    const totals = await Promise.all(
      active.map(({ without }) =>
        getProductFacets(toProductQuery(without, category), locale)
          .then((result) => result.total)
          .catch(() => 0),
      ),
    );
    const best = totals.reduce(
      (best, total, index) =>
        total > (best === -1 ? 0 : totals[best]) ? index : best,
      -1,
    );
    if (best !== -1) {
      const labels = filterLabels(tf, locale, facets);
      suggestion = {
        name: labels.active(active[best].filter),
        count: totals[best],
        href: hrefOf(active[best].without),
      };
    }
  }

  return (
    <section aria-label={listName}>
      <AreaMessages area="catalogue">
        <ListingControls
          state={state}
          facets={facets}
          visible={visible}
          total={page.total}
          action={getPathname({ href: base, locale })}
        >
          <div className="pt-2">
            {page.items.length === 0 ? (
              <div className="bg-mist flex flex-col items-center gap-3 rounded-xl px-6 py-14 text-center">
                <SearchX
                  aria-hidden="true"
                  className="text-ink-subtle size-10"
                />
                <h2 className="font-display text-ink text-2xl">
                  {narrowed ? tf("emptyTitle") : t("emptyTitle")}
                </h2>
                <p className="text-ink-muted max-w-md">
                  {narrowed
                    ? tf("emptyText")
                    : state.q
                      ? t("emptySearchText", { query: state.q })
                      : emptyText}
                </p>
                <div className="mt-2 flex flex-wrap justify-center gap-2">
                  {suggestion && (
                    <Link
                      href={suggestion.href}
                      className={buttonStyles({ size: "sm" })}
                    >
                      {tf("emptySuggestion", {
                        name: suggestion.name,
                        count: suggestion.count,
                      })}
                    </Link>
                  )}
                  {narrowed && (
                    <Link
                      href={hrefOf(clearedFilters(state))}
                      className={buttonStyles({
                        variant: "secondary",
                        size: "sm",
                      })}
                    >
                      {tf("clearAll")}
                    </Link>
                  )}
                  {!narrowed && (state.q || category) && (
                    <Link
                      href="/products"
                      className={buttonStyles({
                        variant: "secondary",
                        size: "sm",
                      })}
                    >
                      {t("showAll")}
                    </Link>
                  )}
                </div>
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
                  href={
                    page.page > 1
                      ? hrefOf(state, { page: page.page - 1 })
                      : null
                  }
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
                      href={hrefOf(state, { page: number })}
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
                      ? hrefOf(state, { page: page.page + 1 })
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
        </ListingControls>
      </AreaMessages>
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
