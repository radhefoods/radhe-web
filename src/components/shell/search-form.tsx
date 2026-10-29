"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Search, Tag } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { ProductImage } from "@/components/catalogue/product-image";
import { Spinner } from "@/components/ui/spinner";
import { getPathname, Link, useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { api } from "@/lib/api/browser";
import type { ProductSummary } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatBasePrice, formatMoney } from "@/lib/format/money";
import {
  brandOf,
  formatProductName,
  productTitle,
} from "@/lib/format/product-name";

/** How long typing is left alone before the API is asked. */
const SUGGEST_DELAY_MS = 250;
/** How many products the dropdown shows for the words typed. */
const PRODUCTS = 5;
/** How many search terms and brands stand beside them. */
const TERMS = 5;
const BRANDS = 3;
/** The products of the empty field: the featured ones, then the popular. */
const RECOMMENDED = 4;
const POPULAR = 6;
/** The limits of `q` (doc 7.2). */
const MIN_QUERY = 2;
const MAX_QUERY = 80;
/** How long the old content fades before the next takes its place. */
const FADE_MS = 150;
/** How long the dropdown takes to fold up before it leaves the page. */
const EXIT_MS = 220;

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/**
 * The two moments of something that unfolds and folds up: `present` is
 * true while it is open and for `exitMs` longer once it closed, the time
 * its closing takes; `entered` turns true one painted frame after it
 * opened, so that the first frame is painted folded and the opening runs
 * as a transition, and is false at once when it closes.
 */
function useUnfolding(
  open: boolean,
  exitMs: number,
): { present: boolean; entered: boolean } {
  const [seen, setSeen] = useState(open);
  const [lingering, setLingering] = useState(false);
  const [raised, setRaised] = useState(false);
  // The change of `open` is noticed in the render that brings it, so that
  // nothing is painted in between.
  if (seen !== open) {
    setSeen(open);
    if (open) setRaised(false);
    else setLingering(true);
  }
  useEffect(() => {
    if (!lingering) return;
    const timer = window.setTimeout(() => setLingering(false), exitMs);
    return () => window.clearTimeout(timer);
  }, [lingering, exitMs]);
  useEffect(() => {
    if (!open) return;
    let second = 0;
    const first = window.requestAnimationFrame(() => {
      second = window.requestAnimationFrame(() => setRaised(true));
    });
    return () => {
      window.cancelAnimationFrame(first);
      window.cancelAnimationFrame(second);
    };
  }, [open]);
  return { present: open || lingering, entered: open && raised };
}

/** The height of an element, kept up to date as its content changes. */
function useMeasuredHeight(): [
  (element: HTMLDivElement | null) => void | (() => void),
  number,
] {
  const [height, setHeight] = useState(0);
  const ref = useCallback((element: HTMLDivElement | null) => {
    if (!element) return;
    const observer = new ResizeObserver(() =>
      setHeight(element.getBoundingClientRect().height),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, height];
}

/**
 * The content on show follows the content wanted, one fade behind: when
 * the key of the wanted content changes, the old content stays `leaving`
 * for `ms`, then the content wanted at that moment takes its place. The
 * same key with new data is shown at once, without a fade.
 */
function useCrossfade<T extends { key: string }>(
  target: T | null,
  ms: number,
): { content: T | null; leaving: boolean } {
  const [shown, setShown] = useState<T | null>(null);
  const latest = useRef<T | null>(null);
  useEffect(() => {
    latest.current = target;
  }, [target]);
  const stale = target !== null && (shown === null || shown.key !== target.key);
  const first = shown === null;
  useEffect(() => {
    if (!stale) return;
    const timer = window.setTimeout(
      () => setShown(latest.current),
      first ? 0 : ms,
    );
    return () => window.clearTimeout(timer);
  }, [stale, first, ms]);
  const content =
    shown !== null && target !== null && shown.key === target.key
      ? target
      : shown;
  return { content, leaving: stale && shown !== null };
}

/** Lower case without accents, as the API matches (doc 7.2). */
function fold(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * The words of the names and brands found that begin with a word typed:
 * the search terms the customer may have meant, the most frequent first,
 * never the words typed themselves.
 */
function termsOf(products: ProductSummary[], q: string): string[] {
  const typed = fold(q).split(/\s+/).filter(Boolean);
  const whole = fold(q);
  const counts = new Map<string, { text: string; n: number }>();
  for (const product of products) {
    const text = `${formatProductName(product.name)} ${brandOf(product.brand) ?? ""}`;
    for (const raw of text.split(/[\s/,()]+/)) {
      const word = raw.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
      const folded = fold(word);
      if (word.length < 3 || folded === whole) continue;
      if (!typed.some((w) => folded.startsWith(w))) continue;
      const entry = counts.get(folded) ?? { text: word, n: 0 };
      entry.n += 1;
      counts.set(folded, entry);
    }
  }
  return [...counts.values()]
    .sort((a, b) => b.n - a.n)
    .slice(0, TERMS)
    .map((entry) => entry.text);
}

/** The text with the beginnings that match a word typed set in leaf. */
function highlight(text: string, q: string): ReactNode {
  const typed = fold(q).split(/\s+/).filter(Boolean);
  if (typed.length === 0) return text;
  return text.split(/(\s+)/).map((part, index) => {
    const hit = typed.find((w) => fold(part).startsWith(w));
    if (!hit || part.trim() === "") {
      return <Fragment key={index}>{part}</Fragment>;
    }
    return (
      <Fragment key={index}>
        <mark className="text-leaf-700 bg-transparent font-bold">
          {part.slice(0, hit.length)}
        </mark>
        {part.slice(hit.length)}
      </Fragment>
    );
  });
}

/** The address of the full results, as Enter sends it. */
const resultsHref = (q: string) =>
  ({ pathname: "/products", query: { q } }) as const;
const brandHref = (brand: string) =>
  ({ pathname: "/products", query: { brand } }) as const;
const productHref = (product: ProductSummary) =>
  ({ pathname: "/products/[slug]", params: { slug: product.slug } }) as const;

type Href =
  | ReturnType<typeof resultsHref>
  | ReturnType<typeof brandHref>
  | ReturnType<typeof productHref>;

/** What the dropdown shows: one of these, keyed so that a change fades. */
type Content =
  | { kind: "loading"; key: string }
  | {
      kind: "default";
      key: string;
      recommended: ProductSummary[];
      popular: ProductSummary[];
    }
  | {
      kind: "results";
      key: string;
      q: string;
      terms: string[];
      brands: string[];
      products: ProductSummary[];
      more: boolean;
    }
  | { kind: "nothing"; key: string; q: string }
  | { kind: "error"; key: string; q: string };

/**
 * The addresses the arrow keys can stand on, in the order the entries are
 * drawn: terms, brands, products, the way to all results.
 */
function entriesOf(content: Content): Href[] {
  switch (content.kind) {
    case "default":
      return [...content.recommended, ...content.popular].map(productHref);
    case "results": {
      const { q, terms, brands, products, more } = content;
      const entries: Href[] = [];
      if (terms.length === 0 && brands.length === 0) {
        entries.push(resultsHref(q));
      }
      for (const term of terms) entries.push(resultsHref(term));
      for (const brand of brands) entries.push(brandHref(brand));
      for (const product of products) entries.push(productHref(product));
      if (more) entries.push(resultsHref(q));
      return entries;
    }
    default:
      return [];
  }
}

const optionId = (id: string, index: number) => `${id}-option-${index}`;

const eyebrow =
  "reveal-stagger text-ink-subtle mb-1.5 px-2 text-[0.6875rem] leading-4 font-bold tracking-[0.1em] uppercase";

const beatOf = (beat: number) => ({ "--i": beat }) as CSSProperties;

/**
 * The product search: a slim field with softly rounded corners (owner,
 * 2026-10-21: no pill, no green outline), the icon at its start and a
 * round leaf button at its end. A plain form that leads to the product
 * list with `?q=`, so it works before any script has loaded; Enter and the
 * button both send it. The focus is marked by a quiet grey outline and
 * the white fill, never the leaf: keyboard users still see where they are.
 *
 * With the focus in the field the page behind dims and a white dropdown
 * unfolds under the field, flush with its two edges (owner, 2026-10-28,
 * evening, after a reference video; 2026-10-29: no wider than the field,
 * which had looked unbalanced): while the field
 * is empty, the products the admin marked as featured as small cards and
 * the first products of the catalogue in two columns (the same products
 * as "Popular right now" on the home page); from two characters on, the
 * search terms and brands the words so far lead to and, beside them, up
 * to five products the API finds (`GET /v1/store/products?q=…`, one
 * request per pause of 250 ms, and the brands from the facets of the same
 * words), with "View all results" under them when the API has more. Each
 * change of content fades out, the dropdown glides to its new height, and
 * the new entries appear one beat after another; a click outside, Escape
 * and every way out of it fold the dropdown up again. Arrow keys walk
 * the entries, Enter opens the chosen one; the reduced-motion preference
 * stills it all. Only the newest answer is ever shown: the answers are
 * keyed by the words they were asked for.
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
  /** The entry the arrow keys stand on, for the content it was chosen in. */
  const [chosen, setChosen] = useState<{ key: string; index: number } | null>(
    null,
  );

  const q = useDebounced(value.trim(), SUGGEST_DELAY_MS);
  const asked = open && q.length >= MIN_QUERY && q.length <= MAX_QUERY;
  const results = useQuery({
    queryKey: ["search-suggestions", locale, q],
    // One entry per product, as the default size (doc 7.2 `view`); one more
    // than shown tells whether there is more to see.
    queryFn: ({ signal }) =>
      api.listProducts({ q, limit: PRODUCTS + 1, view: "product" }, { signal }),
    enabled: asked,
    staleTime: 60_000,
    retry: false,
  });
  const facets = useQuery({
    queryKey: ["search-brands", locale, q],
    queryFn: ({ signal }) => api.getProductFacets({ q }, { signal }),
    enabled: asked,
    staleTime: 60_000,
    retry: false,
  });
  const recommended = useQuery({
    queryKey: ["search-recommended", locale],
    queryFn: ({ signal }) =>
      api.listProducts(
        { featured: true, limit: RECOMMENDED, view: "product" },
        { signal },
      ),
    enabled: open,
    staleTime: 300_000,
    retry: false,
  });
  const popular = useQuery({
    queryKey: ["search-popular", locale],
    queryFn: ({ signal }) =>
      api.listProducts(
        { limit: RECOMMENDED + POPULAR, view: "product" },
        { signal },
      ),
    enabled: open,
    staleTime: 300_000,
    retry: false,
  });
  const defaultsSettled =
    (recommended.data !== undefined || recommended.isError) &&
    (popular.data !== undefined || popular.isError);
  const featured = recommended.data?.items;
  const catalogue = popular.data?.items;
  const brandFacets = facets.data?.brands;

  const target = useMemo<Content | null>(() => {
    if (!open) return null;
    if (asked) {
      if (results.data) {
        const products = results.data.items.slice(0, PRODUCTS);
        if (products.length === 0) {
          return { kind: "nothing", key: `nothing:${q}`, q };
        }
        const brands = (brandFacets ?? [])
          .map((brand) => brandOf(brand.value))
          .filter((brand): brand is string => brand !== null)
          .slice(0, BRANDS);
        return {
          kind: "results",
          key: `results:${q}`,
          q,
          terms: termsOf(products, q),
          brands,
          products,
          more: results.data.total > PRODUCTS,
        };
      }
      if (results.isError) return { kind: "error", key: `error:${q}`, q };
      return { kind: "loading", key: "loading" };
    }
    if (!defaultsSettled) return { kind: "loading", key: "loading" };
    const seen = new Set((featured ?? []).map((product) => product.id));
    const rest = (catalogue ?? [])
      .filter((product) => !seen.has(product.id))
      .slice(0, POPULAR);
    if (seen.size === 0 && rest.length === 0) return null;
    return {
      kind: "default",
      key: "default",
      recommended: featured ?? [],
      popular: rest,
    };
  }, [
    open,
    asked,
    q,
    results.data,
    results.isError,
    brandFacets,
    defaultsSettled,
    featured,
    catalogue,
  ]);

  const showing = target !== null;
  const { present, entered } = useUnfolding(showing, EXIT_MS);
  const [measure, height] = useMeasuredHeight();
  const { content, leaving } = useCrossfade(target, FADE_MS);
  const entries = useMemo(() => (content ? entriesOf(content) : []), [content]);
  const active =
    content !== null && chosen?.key === content.key ? chosen.index : -1;
  const listId = `${id}-suggestions`;
  const setActive = (index: number) => {
    if (content) setChosen({ key: content.key, index });
  };

  // The entry the keys stand on stays in view of a scrolling dropdown.
  useEffect(() => {
    if (active < 0) return;
    document
      .getElementById(optionId(id, active))
      ?.scrollIntoView({ block: "nearest" });
  }, [id, active]);

  function close() {
    setOpen(false);
    setChosen(null);
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
      const count = entries.length;
      if (count === 0) return;
      // From the field, down goes to the first entry and up to the last.
      setActive(
        event.key === "ArrowDown"
          ? (active + 1) % count
          : active < 0
            ? count - 1
            : (active - 1 + count) % count,
      );
      return;
    }
    if (event.key === "Enter" && open && active >= 0) {
      event.preventDefault();
      const href = entries[active];
      close();
      if (href) router.push(href);
    }
  }

  // --- The entries ----------------------------------------------------------

  // Every entry of the dropdown is an option of the one list, lit while
  // the keys or the pointer stand on it, revealed `beat` beats after the
  // first thing in the dropdown. The headings over the groups are for the
  // eye; the groups carry the same words as their label.
  const option = (index: number, beat: number, className: string) => ({
    id: optionId(id, index),
    role: "option" as const,
    "aria-selected": active === index,
    onClick: close,
    onMouseEnter: () => setActive(index),
    style: beatOf(beat),
    className: cn(
      "reveal-stagger rounded-lg transition-colors duration-150",
      className,
      active === index ? "bg-leaf-50" : "hover:bg-mist",
    ),
  });

  const productRow = (product: ProductSummary, index: number, beat: number) => {
    const onSale = product.pricing.onSale;
    return (
      <Link
        key={product.variantId}
        href={productHref(product)}
        {...option(index, beat, "flex items-center gap-3 px-2 py-1.5")}
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
  };

  const productTile = (
    product: ProductSummary,
    index: number,
    beat: number,
  ) => (
    <Link
      key={product.variantId}
      href={productHref(product)}
      {...option(index, beat, "bg-mist/60 flex flex-col gap-2 p-2")}
    >
      <span className="block aspect-square overflow-hidden rounded-md bg-white p-2">
        <ProductImage
          image={product.image}
          alt=""
          sizes="(min-width: 1024px) 160px, 40vw"
          fallbackLabel=""
        />
      </span>
      <span className="line-clamp-2 min-h-8 text-[0.8125rem] leading-4 font-semibold">
        {productTitle(product.name, product.packSize)}
      </span>
      <span
        className={cn(
          "font-display text-[0.9375rem] leading-none tabular-nums",
          product.pricing.onSale && "text-red-600",
        )}
      >
        {formatMoney(product.pricing.price, locale)}
      </span>
    </Link>
  );

  const termRow = (
    key: string,
    href: Href,
    index: number,
    beat: number,
    icon: ReactNode,
    label: ReactNode,
    tail?: ReactNode,
  ) => (
    <Link
      key={key}
      href={href}
      {...option(index, beat, "flex min-h-10 items-center gap-2.5 px-2.5")}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate text-[0.9375rem] font-semibold">
        {label}
      </span>
      {tail}
    </Link>
  );

  const searchIcon = (
    <Search
      aria-hidden="true"
      className="text-ink-subtle size-4 shrink-0"
      strokeWidth={2.25}
    />
  );

  let body: ReactNode = null;
  if (content?.kind === "loading") {
    body = (
      <p
        className="reveal-stagger text-ink-muted flex items-center gap-2.5 px-3 py-2.5 text-sm"
        style={beatOf(0)}
      >
        <Spinner className="size-4" />
        {t("searching")}
      </p>
    );
  } else if (content?.kind === "default") {
    const tiles = content.recommended;
    const rows = content.popular;
    body = (
      <div className="flex flex-col gap-4">
        {tiles.length > 0 && (
          <div role="group" aria-label={t("searchRecommended")}>
            <p aria-hidden="true" className={eyebrow} style={beatOf(0)}>
              {t("searchRecommended")}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {tiles.map((product, index) =>
                productTile(product, index, index + 1),
              )}
            </div>
          </div>
        )}
        {rows.length > 0 && (
          <div role="group" aria-label={t("searchPopular")}>
            <p
              aria-hidden="true"
              className={eyebrow}
              style={beatOf(tiles.length + 1)}
            >
              {t("searchPopular")}
            </p>
            <div className="grid gap-0.5 sm:grid-cols-2 sm:gap-x-2">
              {rows.map((product, index) =>
                productRow(
                  product,
                  tiles.length + index,
                  tiles.length + index + 2,
                ),
              )}
            </div>
          </div>
        )}
      </div>
    );
  } else if (content?.kind === "results") {
    const { q: words, terms, brands, products, more } = content;
    let index = 0;
    let beat = 1;
    const left: ReactNode[] = [];
    if (terms.length === 0 && brands.length === 0) {
      left.push(
        termRow(
          "search",
          resultsHref(words),
          index++,
          beat++,
          searchIcon,
          t("searchFor", { q: words }),
        ),
      );
    }
    for (const term of terms) {
      left.push(
        termRow(
          `term:${term}`,
          resultsHref(term),
          index++,
          beat++,
          searchIcon,
          highlight(term, words),
        ),
      );
    }
    for (const brand of brands) {
      left.push(
        termRow(
          `brand:${brand}`,
          brandHref(brand),
          index++,
          beat++,
          <Tag
            aria-hidden="true"
            className="text-ink-subtle size-4 shrink-0"
            strokeWidth={2.25}
          />,
          highlight(brand, words),
          <span className="text-ink-subtle shrink-0 text-xs font-semibold">
            {t("searchBrand")}
          </span>,
        ),
      );
    }
    const right = products.map((product) =>
      productRow(product, index++, beat++),
    );
    body = (
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-x-6">
        <div role="group" aria-label={t("searchSuggestions")}>
          <p aria-hidden="true" className={eyebrow} style={beatOf(0)}>
            {t("searchSuggestions")}
          </p>
          <div className="flex flex-col gap-0.5">{left}</div>
        </div>
        <div role="group" aria-label={t("searchProducts")}>
          <p
            aria-hidden="true"
            className={eyebrow}
            style={beatOf(left.length + 1)}
          >
            {t("searchProducts")}
          </p>
          <div className="flex flex-col gap-0.5">{right}</div>
        </div>
        {more && (
          <Link
            href={resultsHref(words)}
            {...option(
              index,
              beat,
              "border-line text-leaf-700 flex min-h-11 items-center justify-center gap-1.5 rounded-t-none border-t px-3 text-sm font-bold lg:col-span-2",
            )}
          >
            {t("searchAll", { q: words })}
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        )}
      </div>
    );
  } else if (content?.kind === "nothing") {
    body = (
      <p
        className="reveal-stagger text-ink-muted px-3 py-2.5 text-sm"
        style={beatOf(0)}
      >
        {t("searchNothing", { q: content.q })}
      </p>
    );
  } else if (content?.kind === "error") {
    body = (
      <p
        className="reveal-stagger px-3 py-2.5 text-sm font-semibold text-red-800"
        style={beatOf(0)}
      >
        {t("searchError")}
      </p>
    );
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
      // Above the dimmed page where the header is no layer of its own
      // (phones).
      className={cn("relative z-50", className)}
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
          setChosen(null);
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onKeyDown={onKeyDown}
        minLength={MIN_QUERY}
        maxLength={MAX_QUERY}
        required
        enterKeyHint="search"
        autoComplete="off"
        placeholder={t("searchPlaceholder")}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showing}
        aria-controls={present && content ? listId : undefined}
        aria-activedescendant={
          present && active >= 0 ? optionId(id, active) : undefined
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

      {/* The page behind, dimmed: under the header on wide screens, under
          the field alone on phones. A press on it closes the dropdown. */}
      {present &&
        createPortal(
          <div
            aria-hidden="true"
            data-state={entered ? "open" : "closed"}
            onPointerDown={close}
            className="bg-ink/40 fixed inset-0 z-30 opacity-0 transition-opacity duration-200 ease-out data-[state=open]:opacity-100"
          />,
          document.body,
        )}

      {present && content && (
        <div
          id={listId}
          role="listbox"
          aria-label={t("searchSuggestions")}
          data-state={entered ? "open" : "closed"}
          // A press on the list must not take the focus off the field,
          // or the list would be gone before the click lands.
          onPointerDown={(event) => event.preventDefault()}
          style={{ height: entered ? height : 0 }}
          className="border-line shadow-float absolute inset-x-0 top-full z-50 mt-2 -translate-y-1 overflow-hidden rounded-xl border bg-white text-left opacity-0 transition-[height,opacity,transform] duration-[260ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] data-[state=open]:translate-y-0 data-[state=open]:opacity-100"
        >
          <div
            ref={measure}
            className="max-h-[min(70dvh,38rem)] scrollbar-thin overflow-y-auto overscroll-contain"
          >
            <div
              key={content.key}
              data-leaving={leaving || undefined}
              className="p-2 transition-opacity duration-150 ease-out data-leaving:opacity-0 sm:p-3"
            >
              {body}
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
