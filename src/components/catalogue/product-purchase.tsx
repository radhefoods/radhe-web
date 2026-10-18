"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { LocaleAlternates } from "@/components/shell/locale-switcher";
import { Chip } from "@/components/ui/chip";
import {
  cappedByLimit,
  fewLeft,
  orderingReason,
} from "@/features/catalogue/availability";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { api } from "@/lib/api/browser";
import type { Ordering, ProductDetail, ProductVariant } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatDiscount, formatMoney } from "@/lib/format/money";
import { AddToCart } from "./add-to-cart";
import { Price } from "./price";
import { formatPackSize, productTitle } from "@/lib/format/product-name";

// The product page is one page for every pack size of a product (doc 7). The
// server renders it for the size its address names; choosing another size
// changes the headline, the price, the stock, the item number and the
// address in place, without a request: every size came with the page. The
// parts below are the ones that follow the chosen size.

interface Selection {
  product: ProductDetail;
  /** The sizes to choose from, smallest first. */
  variants: ProductVariant[];
  /** The size the page shows right now. */
  variant: ProductVariant;
  /** Whether the size can be ordered: asked again when the page opens. */
  ordering: Ordering | null;
  /** Shows a size; with an address, the browser's address follows. */
  select: (variant: ProductVariant, href?: string) => void;
}

const SelectionContext = createContext<Selection | null>(null);

function useSelection(): Selection {
  const value = useContext(SelectionContext);
  if (!value) {
    throw new Error("This part of the product page needs <PackSizes> above.");
  }
  return value;
}

/** The product as the size it is shown as, should `variants` not list it. */
function ownVariant(product: ProductDetail): ProductVariant {
  return {
    id: product.variantId,
    sku: product.sku,
    slug: product.slug,
    packSize: product.packSize,
    displayName: product.displayName,
    pricing: product.pricing,
    ordering: product.ordering,
    isDefault: true,
    isSelected: true,
  };
}

const productHref = (slug: string) => ({
  pathname: "/products/[slug]" as const,
  params: { slug },
});

/** The last part of an address: the slug of the size it names. */
function slugOfPath(pathname: string): string {
  return decodeURIComponent(pathname.split("/").filter(Boolean).at(-1) ?? "");
}

/**
 * Holds the chosen pack size for the parts of the product page below it.
 * The page itself is cached, so the one thing that must be current, whether
 * and how much of each size can be ordered, is asked for again, once for all
 * sizes. Nothing is reserved before a payment, so the stock can change at
 * any moment.
 */
export function PackSizes({
  product,
  children,
}: {
  product: ProductDetail;
  children: ReactNode;
}) {
  const locale = useLocale() as Locale;
  const variants = useMemo(
    () => (product.variants.length ? product.variants : [ownVariant(product)]),
    [product],
  );
  const [variantId, setVariantId] = useState(product.variantId);
  const variant = variants.find((v) => v.id === variantId) ?? variants[0];

  const fresh = useQuery({
    queryKey: ["product-ordering", product.id, locale],
    queryFn: async () => (await api.getProduct(product.slug)).product,
    staleTime: 30_000,
  });
  const ordering =
    fresh.data?.variants.find((v) => v.id === variant.id)?.ordering ??
    variant.ordering;

  // The tab's title names the size; the rest of it (the shop) stays.
  const titledAs = useRef(
    product.seo.title ?? productTitle(product.name, product.packSize),
  );
  const select = useCallback(
    (next: ProductVariant, href?: string) => {
      setVariantId(next.id);
      if (href) window.history.pushState(null, "", href);
      const title = productTitle(product.name, next.packSize);
      document.title = document.title.replace(titledAs.current, title);
      titledAs.current = title;
    },
    [product.name],
  );

  // Back and forward move between the addresses of the sizes.
  useEffect(() => {
    const onPopState = () => {
      const slug = slugOfPath(window.location.pathname);
      const match = variants.find((v) => v.slug === slug);
      if (match) select(match);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [variants, select]);

  const value = useMemo<Selection>(
    () => ({ product, variants, variant, ordering, select }),
    [product, variants, variant, ordering, select],
  );

  // The language switch keeps the size. The API answers to the slug of
  // either language, and the page then moves to its own address.
  const alternates =
    variant.id === product.variantId
      ? { en: productHref(product.slugs.en), de: productHref(product.slugs.de) }
      : { en: productHref(variant.slug), de: productHref(variant.slug) };

  return (
    <SelectionContext.Provider value={value}>
      <LocaleAlternates hrefs={alternates} />
      {children}
    </SelectionContext.Provider>
  );
}

/** The headline: the name of the product with the chosen size. */
export function PackSizeHeadline({ className }: { className?: string }) {
  const { product, variant } = useSelection();
  return (
    <h1 className={className}>
      {productTitle(product.name, variant.packSize)}
    </h1>
  );
}

/** The red pill on the main picture, when the chosen size is reduced. */
export function PackSizeDiscount({ className }: { className?: string }) {
  const { variant } = useSelection();
  const locale = useLocale() as Locale;
  if (!variant.pricing.onSale) return null;
  return (
    <span className={className}>
      {formatDiscount(variant.pricing.discountPercent, locale)}
    </span>
  );
}

/** The price of the chosen size, with its regular price and price per unit. */
export function PackSizePrice({ className }: { className?: string }) {
  const { variant } = useSelection();
  return <Price pricing={variant.pricing} size="lg" className={className} />;
}

/** The item number of the chosen size, for the details table. */
export function PackSizeSku() {
  const { variant } = useSelection();
  return <>{variant.sku}</>;
}

/**
 * The stock of the chosen size as a chip next to the price: "In stock",
 * or "Only N left" when few remain. Nothing when the size cannot be
 * ordered: the pill in the button's place says so.
 */
export function PackSizeAvailability({ className }: { className?: string }) {
  const t = useTranslations("product");
  const { ordering } = useSelection();
  if (orderingReason(ordering) !== null) return null;
  const left = fewLeft(ordering);
  return left !== null ? (
    <Chip tone="wheat" className={className}>
      {t("badge.fewLeft", { count: left })}
    </Chip>
  ) : (
    <Chip tone="leaf" className={className}>
      {t("inStock")}
    </Chip>
  );
}

/**
 * The sizes to choose from. Each is a link to the size's own address, so it
 * can be opened in a new tab or found by a crawler; a plain click switches
 * the page in place instead.
 */
export function PackSizePicker() {
  const t = useTranslations("product");
  const { variants, variant, select } = useSelection();
  return (
    <div className="flex flex-col gap-2">
      <p className="text-ink-subtle text-xs font-bold tracking-wider uppercase">
        {t("packSize")}
      </p>
      <ul className="flex flex-wrap gap-2">
        {variants.map((size) => (
          <li key={size.id}>
            <Link
              href={productHref(size.slug)}
              prefetch={false}
              aria-current={size.id === variant.id ? "page" : undefined}
              onClick={(event) => {
                // A modifier or another button means "in a new tab".
                if (
                  event.button !== 0 ||
                  event.metaKey ||
                  event.ctrlKey ||
                  event.shiftKey ||
                  event.altKey
                ) {
                  return;
                }
                event.preventDefault();
                select(size, event.currentTarget.href);
              }}
              className={cn(
                "flex min-h-11 items-center rounded-full border-2 px-4 text-[0.9375rem] font-semibold transition-colors duration-150",
                size.id === variant.id
                  ? "border-leaf-600 bg-leaf-50 text-leaf-700"
                  : "border-line-strong hover:border-ink-subtle bg-white",
              )}
            >
              {formatPackSize(size.packSize)}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The buying part of the page: the add-to-cart control and the limits of
 * the chosen size, and on phones the same control fixed above the tab bar.
 */
export function ProductPurchase() {
  const t = useTranslations("product");
  const locale = useLocale() as Locale;
  const { product, variant, ordering } = useSelection();
  const name = productTitle(product.name, variant.packSize);
  const canOrder = orderingReason(ordering) === null;

  // The chip next to the price says how many are left; here the limits.
  const hints: string[] = [];
  if (canOrder && ordering) {
    if (cappedByLimit(ordering)) {
      hints.push(t("maxPerOrder", { count: ordering.maxQuantity }));
    }
    if (ordering.minQuantity > 1) {
      hints.push(t("minPerOrder", { count: ordering.minQuantity }));
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <AddToCart
        variantId={variant.id}
        name={name}
        ordering={ordering}
        className="sm:max-w-xs"
      />

      {hints.length > 0 && (
        <ul className="text-wheat-800 flex flex-col gap-0.5 text-sm font-semibold">
          {hints.map((hint) => (
            <li key={hint}>{hint}</li>
          ))}
        </ul>
      )}

      {/* On phones the same control stays in reach above the tab bar. */}
      <div className="shadow-header fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 flex items-center gap-3 bg-white px-4 py-2.5 md:hidden">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{name}</p>
          <p className="font-display text-lg tabular-nums">
            {formatMoney(variant.pricing.price, locale)}
          </p>
        </div>
        <AddToCart
          variantId={variant.id}
          name={name}
          ordering={ordering}
          size="sm"
          className="w-40 shrink-0"
        />
      </div>
    </div>
  );
}
