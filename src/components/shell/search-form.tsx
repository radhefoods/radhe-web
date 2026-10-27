"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowRight, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { ProductImage } from "@/components/catalogue/product-image";
import { Spinner } from "@/components/ui/spinner";
import { getPathname, Link, useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { api } from "@/lib/api/browser";
import type { ProductSummary } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatBasePrice, formatMoney } from "@/lib/format/money";
import { productTitle } from "@/lib/format/product-name";

/** How long typing is left alone before the API is asked. */
const SUGGEST_DELAY_MS = 250;
/** How many products the list under the field shows. */
const SUGGESTIONS = 4;
/** The limits of `q` (doc 7.2). */
const MIN_QUERY = 2;
const MAX_QUERY = 80;

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** The address of the full results, as Enter sends it. */
const resultsHref = (q: string) =>
  ({ pathname: "/products", query: { q } }) as const;

/**
 * The product search: a slim field with softly rounded corners (owner,
 * 2026-10-21: no pill, no green outline), the icon at its start and a
 * round leaf button at its end. A plain form that leads to the product
 * list with `?q=`, so it works before any script has loaded; Enter and the
 * button both send it. The focus is marked by a quiet grey outline and
 * the white fill, never the leaf: keyboard users still see where they are.
 *
 * While the customer types, the products the API finds for the words so
 * far appear under the field (owner, 2026-10-28): up to four, each with
 * its picture, its name with the size and its price, a link to its page;
 * and, when the API has more, "View all results", which leads where Enter
 * leads. One request per pause in typing, never for fewer than two
 * characters; the list closes on Escape, on a click outside, and with
 * every way out of it. Arrow keys walk the list, Enter opens the chosen
 * entry.
 */
export function SearchForm({
  defaultValue,
  id,
  className,
}: {
  defaultValue?: string;
  /** Ids must be unique: the form appears in the header and on the list. */
  id: string;
  className?: string;
}) {
  const t = useTranslations("common");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const wrapper = useRef<HTMLFormElement>(null);
  const [value, setValue] = useState(defaultValue ?? "");
  const [open, setOpen] = useState(false);
  /** The entry the arrow keys stand on; `-1` for none. */
  const [active, setActive] = useState(-1);

  const q = useDebounced(value.trim(), SUGGEST_DELAY_MS);
  const asked = open && q.length >= MIN_QUERY && q.length <= MAX_QUERY;
  const suggestions = useQuery({
    queryKey: ["search-suggestions", locale, q],
    // One entry per product, as the default size (doc 7.2 `view`); one more
    // than shown tells whether there is more to see.
    queryFn: ({ signal }) =>
      api.listProducts(
        { q, limit: SUGGESTIONS + 1, view: "product" },
        { signal },
      ),
    enabled: asked,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    retry: false,
  });

  const items: ProductSummary[] = asked
    ? (suggestions.data?.items.slice(0, SUGGESTIONS) ?? [])
    : [];
  const more = asked && (suggestions.data?.total ?? 0) > SUGGESTIONS ? q : null;
  const searching = asked && suggestions.isFetching && !suggestions.data;
  const nothing =
    asked && !suggestions.isFetching && suggestions.data?.items.length === 0;
  const listed = items.length + (more ? 1 : 0);
  const shown = asked && (listed > 0 || searching || nothing);
  const listId = `${id}-suggestions`;
  const optionId = (index: number) => `${id}-option-${index}`;

  function close() {
    setOpen(false);
    setActive(-1);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    // The browser's own check (two characters at least) has passed.
    event.preventDefault();
    close();
    router.push(resultsHref(value.trim()));
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      if (open) {
        event.preventDefault();
        close();
      }
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      if (listed === 0) return;
      // From the field, down goes to the first entry and up to the last.
      setActive((current) =>
        event.key === "ArrowDown"
          ? (current + 1) % listed
          : current < 0
            ? listed - 1
            : (current - 1 + listed) % listed,
      );
      return;
    }
    if (event.key === "Enter" && open && active >= 0) {
      event.preventDefault();
      const product = items[active];
      close();
      router.push(
        product
          ? { pathname: "/products/[slug]", params: { slug: product.slug } }
          : resultsHref(q),
      );
    }
  }

  return (
    <form
      ref={wrapper}
      role="search"
      method="get"
      action={getPathname({ href: "/products", locale })}
      onSubmit={submit}
      onBlur={(event) => {
        // The focus left the form: the field and its list together.
        if (!wrapper.current?.contains(event.relatedTarget as Node | null)) {
          close();
        }
      }}
      className={cn("relative", className)}
    >
      <label htmlFor={id} className="sr-only">
        {t("search")}
      </label>
      <Search
        aria-hidden="true"
        className="text-ink-subtle pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2"
      />
      <input
        id={id}
        type="search"
        name="q"
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onKeyDown={onKeyDown}
        minLength={MIN_QUERY}
        maxLength={MAX_QUERY}
        required
        enterKeyHint="search"
        autoComplete="off"
        placeholder={t("searchPlaceholder")}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={shown}
        aria-controls={shown ? listId : undefined}
        aria-activedescendant={
          shown && active >= 0 ? optionId(active) : undefined
        }
        className="placeholder:text-ink-subtle bg-mist hover:bg-cloud focus-visible:outline-line-strong h-10 w-full rounded-sm border-0 pr-12 pl-10.5 text-[0.9375rem] transition-colors duration-150 focus-visible:bg-white focus-visible:outline-[1.5px] focus-visible:outline-offset-0 lg:h-11"
      />
      <button
        type="submit"
        aria-label={t("search")}
        className="bg-leaf-600 hover:bg-leaf-700 absolute top-1/2 right-1.5 grid size-7 -translate-y-1/2 place-items-center rounded-full text-white transition-[background-color,transform] duration-150 active:scale-95 lg:size-8"
      >
        <Search aria-hidden="true" className="size-4" strokeWidth={2.5} />
      </button>

      {shown && (
        <div
          id={listId}
          role="listbox"
          aria-label={t("searchSuggestions")}
          // A press on the list must not take the focus off the field,
          // or the list would be gone before the click lands.
          onPointerDown={(event) => event.preventDefault()}
          className="border-line shadow-float absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-lg border bg-white p-1.5 text-left"
        >
          {searching && (
            <p className="text-ink-muted flex items-center gap-2.5 px-3 py-3 text-sm">
              <Spinner className="size-4" />
              {t("searching")}
            </p>
          )}
          {nothing && (
            <p className="text-ink-muted px-3 py-3 text-sm">
              {t("searchNothing", { q })}
            </p>
          )}
          {items.map((product, index) => {
            const onSale = product.pricing.onSale;
            return (
              <Link
                key={product.variantId}
                id={optionId(index)}
                role="option"
                aria-selected={active === index}
                href={{
                  pathname: "/products/[slug]",
                  params: { slug: product.slug },
                }}
                onClick={close}
                onMouseEnter={() => setActive(index)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors duration-100",
                  active === index ? "bg-leaf-50" : "hover:bg-mist",
                )}
              >
                <span className="border-line block size-11 shrink-0 overflow-hidden rounded-md border bg-white p-0.5">
                  <ProductImage
                    image={product.image}
                    alt=""
                    sizes="44px"
                    fallbackLabel=""
                  />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[0.9375rem] leading-snug font-semibold">
                    {productTitle(product.name, product.packSize)}
                  </span>
                  <span className="text-ink-subtle text-xs tabular-nums">
                    {formatBasePrice(product.pricing.basePrice, locale)}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end tabular-nums">
                  <span
                    className={cn(
                      "font-display text-[0.9375rem] leading-none",
                      onSale && "text-red-600",
                    )}
                  >
                    {formatMoney(product.pricing.price, locale)}
                  </span>
                  {onSale && (
                    <s className="text-ink-subtle text-xs">
                      {formatMoney(product.pricing.regularPrice, locale)}
                    </s>
                  )}
                </span>
              </Link>
            );
          })}
          {more && (
            <Link
              id={optionId(items.length)}
              role="option"
              aria-selected={active === items.length}
              href={resultsHref(more)}
              onClick={close}
              onMouseEnter={() => setActive(items.length)}
              className={cn(
                "text-leaf-700 mt-1 flex min-h-11 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-bold transition-colors duration-100",
                active === items.length ? "bg-leaf-50" : "hover:bg-mist",
              )}
            >
              {t("searchAll", { q: more })}
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          )}
        </div>
      )}
    </form>
  );
}
