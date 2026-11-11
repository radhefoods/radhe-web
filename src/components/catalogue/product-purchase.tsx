"use client";

import { useQuery } from "@tanstack/react-query";
import { Info, Truck } from "lucide-react";
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
import {
  cappedByLimit,
  fewLeft,
  orderingReason,
} from "@/features/catalogue/availability";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { api } from "@/lib/api/browser";
import type {
  ApiImage,
  Ordering,
  ProductDetail,
  ProductVariant,
} from "@/lib/api/types";
import {
  currentGalleryOf,
  mainPicturesOfOtherSizes,
  packSizesOf,
} from "@/lib/catalogue/pictures";
import { cn } from "@/lib/cn";
import {
  formatBasePrice,
  formatDiscount,
  formatMoney,
} from "@/lib/format/money";
import { AddToCart } from "./add-to-cart";
import { Price } from "./price";
import { ProductGallery, usePicturesAhead } from "./product-gallery";
import { WishlistButton } from "./wishlist-button";
import { formatPackSize, productTitle } from "@/lib/format/product-name";

// The product page is one page for every pack size of a product (doc 7). The
// server renders it for the size its address names; choosing another size
// changes the headline, the pictures, the price, the stock, the item number
// and the address in place, without a request: every size came with the
// page. The parts below are the ones that follow the chosen size.

interface Selection {
  product: ProductDetail;
  /** The sizes to choose from, smallest first. */
  variants: ProductVariant[];
  /** The size the page shows right now. */
  variant: ProductVariant;
  /** Whether the size can be ordered: asked again when the page opens. */
  ordering: Ordering | null;
  /** The same for any of the sizes, for the picker. */
  orderingOf: (variant: ProductVariant) => Ordering | null;
  /** The pictures of the size the page shows, as the API has them now. */
  pictures: ApiImage[];
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
 * The page itself is cached, so what must be current is asked for again,
 * once for all sizes: whether and how much of each size can be ordered
 * (nothing is reserved before a payment, so the stock can change at any
 * moment), and the pictures (owner, 2026-11-11). The address of a picture
 * ends with the picture: when the admin replaces or removes one, the API
 * deletes its file, and the page of the last five minutes names a file
 * that is gone, or none where there is one now. The name, the texts and
 * the prices stay those of the page.
 */
export function PackSizes({
  product,
  children,
}: {
  product: ProductDetail;
  children: ReactNode;
}) {
  const locale = useLocale() as Locale;
  const variants = useMemo(() => packSizesOf(product), [product]);
  const [variantId, setVariantId] = useState(product.variantId);
  const variant = variants.find((v) => v.id === variantId) ?? variants[0];

  const fresh = useQuery({
    queryKey: ["product-ordering", product.id, locale],
    queryFn: async () => (await api.getProduct(product.slug)).product,
    staleTime: 30_000,
  });
  const freshVariants = fresh.data?.variants;
  const orderingOf = useCallback(
    (size: ProductVariant) =>
      freshVariants?.find((v) => v.id === size.id)?.ordering ?? size.ordering,
    [freshVariants],
  );
  const ordering = orderingOf(variant);
  const freshProduct = fresh.data;
  const pictures = useMemo(
    () => currentGalleryOf(product, variant, freshProduct),
    [product, variant, freshProduct],
  );

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
    () => ({
      product,
      variants,
      variant,
      ordering,
      orderingOf,
      pictures,
      select,
    }),
    [product, variants, variant, ordering, orderingOf, pictures, select],
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

/**
 * The pictures of the chosen size (doc VARIANT_IMAGES): its own gallery,
 * which starts at its main picture whenever the size changes, by a click
 * in the picker as by the browser's back and forward; the mark of the
 * shop for a size without a picture, never the picture of another size.
 * They are the pictures the API has now (`pictures`): those of the page
 * until the fresh answer is there, which changes nothing on the screen
 * unless the admin changed a picture since the page was rendered.
 * The main pictures of the other sizes are fetched once the page is idle,
 * so that a change of size shows its picture at once.
 */
export function PackSizeGallery({
  fallbackLabel,
  corner,
  className,
}: {
  /** The caption under the mark when the chosen size has no picture. */
  fallbackLabel: string;
  /** What stands in the top right corner of the picture: the heart. */
  corner?: ReactNode;
  className?: string;
}) {
  const { product, variant, pictures } = useSelection();
  const ahead = useMemo(() => mainPicturesOfOtherSizes(product), [product]);
  usePicturesAhead(ahead);
  return (
    <ProductGallery
      sizeId={variant.id}
      images={pictures}
      fallbackLabel={fallbackLabel}
      corner={corner}
      className={className}
    />
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

/**
 * The red chip with the discount, when the chosen size is reduced: among
 * the chips above the headline since 2026-10-31 (`as="li"`).
 */
export function PackSizeDiscount({
  as: Tag = "span",
  className,
}: {
  as?: "span" | "li";
  className?: string;
}) {
  const { variant } = useSelection();
  const locale = useLocale() as Locale;
  if (!variant.pricing.onSale) return null;
  return (
    <Tag className={className}>
      {formatDiscount(variant.pricing.discountPercent, locale)}
    </Tag>
  );
}

/** The price of the chosen size, with its regular price and price per unit. */
export function PackSizePrice({
  note,
  className,
}: {
  note?: ReactNode;
  className?: string;
}) {
  const { variant } = useSelection();
  return (
    <Price
      pricing={variant.pricing}
      size="lg"
      note={note}
      className={className}
    />
  );
}

/** The item number of the chosen size, for the details table. */
export function PackSizeSku() {
  const { variant } = useSelection();
  return <>{variant.sku}</>;
}

/**
 * The sizes to choose from, as one segmented bar (after the owner's layout
 * reference of 2026-10-31): each segment names the size and its price per
 * kilogram, litre or piece (owner, 2026-10-23: the price per unit is what
 * compares the sizes; the price of the pack stands above, large, for the
 * chosen one), so the customer compares without switching (owner,
 * 2026-10-22); the chosen one is the white thumb of the bar, and a size
 * that cannot be ordered says so in the price's place. Each segment is a
 * link to the size's own address, so it can be opened in a new tab or
 * found by a crawler; a plain click switches the page in place instead.
 * Nothing is shown when the product comes in one size only.
 */
export function PackSizePicker({ className }: { className?: string }) {
  const t = useTranslations("product");
  const locale = useLocale() as Locale;
  const { variants, variant, select, orderingOf } = useSelection();
  if (variants.length < 2) return null;
  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      <p className="flex items-baseline gap-2 text-sm">
        <span className="text-ink-subtle text-xs font-bold tracking-[0.1em] uppercase">
          {t("packSize")}
        </span>
        <span className="font-semibold">
          {formatPackSize(variant.packSize)}
        </span>
      </p>
      <ul className="glass-soft flex flex-wrap gap-1 rounded-2xl p-1">
        {variants.map((size) => {
          const chosen = size.id === variant.id;
          const reason = orderingReason(orderingOf(size));
          return (
            <li key={size.id} className="flex min-w-0 flex-1 basis-28">
              <Link
                href={productHref(size.slug)}
                prefetch={false}
                aria-current={chosen ? "page" : undefined}
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
                  "ease-glass flex min-h-13 w-full flex-col items-center justify-center gap-0.5 rounded-xl px-3 py-2 text-center leading-tight transition-[background-color,box-shadow,transform] duration-200 active:scale-[0.98]",
                  chosen ? "shadow-card bg-white" : "hover:bg-white/60",
                  reason && !chosen && "opacity-80",
                )}
              >
                <span
                  className={cn(
                    "text-[0.9375rem] font-bold",
                    chosen ? "text-leaf-700" : reason && "text-ink-subtle",
                  )}
                >
                  {formatPackSize(size.packSize)}
                </span>
                <span
                  className={cn(
                    "text-[0.8125rem] tabular-nums",
                    reason
                      ? "text-ink-subtle"
                      : size.pricing.onSale
                        ? "font-semibold text-red-600"
                        : "text-ink-muted",
                  )}
                >
                  {reason
                    ? t(`reason.${reason}`)
                    : formatBasePrice(size.pricing.basePrice, locale)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** The heart of the wishlist for the chosen size (doc 16), in the corner of the picture since 2026-10-31. */
export function PackSizeWishlist({ className }: { className?: string }) {
  const { product, variant } = useSelection();
  return (
    <WishlistButton
      productId={product.id}
      variantId={variant.id}
      name={productTitle(product.name, variant.packSize)}
      look="box"
      className={className}
    />
  );
}

/**
 * The buying part of the page: the add-to-cart control, full width (the
 * heart of the wishlist stands on the picture since 2026-10-31, after the
 * owner's layout reference); under it, in one line, the stock of the
 * chosen size ("In stock" behind a green dot, or "Only N left" in wheat,
 * from the fresh ordering the page asks for) and the delivery estimate of
 * the settings behind a truck (owner, 2026-10-22); then the limits of the
 * chosen size, and on phones the add-to-cart control fixed above the tab
 * bar. Nothing of the stock or the delivery when the size cannot be
 * ordered: the pill in the button's place says so.
 */
export function ProductPurchase({
  deliveryEstimate,
  className,
}: {
  /** `delivery.estimate` of the settings in the page's language, or `null`. */
  deliveryEstimate: string | null;
  className?: string;
}) {
  const t = useTranslations("product");
  const locale = useLocale() as Locale;
  const { product, variant, ordering } = useSelection();
  const name = productTitle(product.name, variant.packSize);
  const canOrder = orderingReason(ordering) === null;
  const left = fewLeft(ordering);

  // The limits of the chosen size, under the stock.
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
    <div className={cn("flex flex-col gap-3", className)}>
      <AddToCart variantId={variant.id} name={name} ordering={ordering} />

      {canOrder && (
        <ul className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm">
          <li className="flex items-center gap-2 font-semibold">
            <span
              aria-hidden="true"
              className={cn(
                "size-2 shrink-0 rounded-full ring-4",
                left !== null
                  ? "bg-wheat-800 ring-wheat-100"
                  : "bg-leaf-600 ring-leaf-50",
              )}
            />
            <span
              className={left !== null ? "text-wheat-800" : "text-leaf-700"}
            >
              {left !== null
                ? t("badge.fewLeft", { count: left })
                : t("inStock")}
            </span>
          </li>
          {deliveryEstimate && (
            <li className="text-ink-muted flex items-center gap-2 font-medium">
              <Truck
                aria-hidden="true"
                className="text-leaf-700 size-4 shrink-0"
              />
              <span>{deliveryEstimate}</span>
            </li>
          )}
        </ul>
      )}

      {hints.length > 0 && (
        <ul className="text-ink-muted flex flex-col gap-1 text-sm">
          {hints.map((hint) => (
            <li key={hint} className="flex items-center gap-2">
              <Info
                aria-hidden="true"
                className="text-leaf-700 size-4 shrink-0"
              />
              {hint}
            </li>
          ))}
        </ul>
      )}

      {/* On phones the same control stays in reach above the tab bar. */}
      <div className="glass-strong shadow-float fixed inset-x-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-30 flex items-center gap-3 rounded-t-2xl px-4 py-2.5 md:hidden">
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
