import { useLocale, useTranslations } from "next-intl";
import { fewLeft, orderingReason } from "@/features/catalogue/availability";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { ProductSummary } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatDiscount } from "@/lib/format/money";
import {
  brandOf,
  formatPackSize,
  formatProductName,
  productTitle,
} from "@/lib/format/product-name";
import { AddToCart } from "./add-to-cart";
import { Price } from "./price";
import { ProductImage } from "./product-image";
import { WishlistButton } from "./wishlist-button";

const badge =
  "rounded-full px-2 py-1 text-[0.6875rem] leading-none font-bold tabular-nums";

/**
 * A product in a list, as the one pack size the API shows it as (doc 7).
 * The picture on white, as the packshots are shot (owner, 2026-10-23; the
 * mist tile showed as a frame around them), the discount and "only N left" badges in its
 * top left corner, the heart of the wishlist in its top right corner (doc
 * 16) and the round "+" in its bottom corner, where the stepper unfolds in
 * its place; under the tile the brand as a small tracked line
 * (owner, 2026-10-19; nothing when the admin left none), the name with
 * the size (the size in a quieter tone), then the price with the regular
 * price crossed out when reduced and the price per unit. Nothing else
 * (owner, 2026-10-16): the other sizes are chosen on the product page.
 * The name keeps two lines whether it needs them or not, so the prices of
 * a row line up, and the card ends with the price (owner, 2026-10-18). A
 * size that cannot be ordered shows its picture greyed and a quiet pill
 * where the button was. The tile is the `data-fly-source` of the add
 * button: its picture flies into the cart.
 */
export function ProductCard({
  product,
  headingLevel = "h3",
  imageSizes = "(min-width: 1024px) 22vw, (min-width: 768px) 30vw, 46vw",
  priority = false,
}: {
  product: ProductSummary;
  headingLevel?: "h2" | "h3";
  imageSizes?: string;
  /** Load the picture at once: the first cards of a page. */
  priority?: boolean;
}) {
  const t = useTranslations("product");
  const locale = useLocale() as Locale;
  const href = {
    pathname: "/products/[slug]" as const,
    params: { slug: product.slug },
  };
  const title = productTitle(product.name, product.packSize);
  const brand = brandOf(product.brand);
  const unorderable = orderingReason(product.ordering) !== null;
  const onSale = product.pricing.onSale && !unorderable;
  const left = fewLeft(product.ordering);
  const Heading = headingLevel;

  return (
    <article
      data-fly-scope=""
      className="group border-line hover:border-line-strong hover:shadow-lift relative flex h-full flex-col rounded-lg border-[1.5px] bg-white p-2 transition-[box-shadow,border-color,transform] duration-200 hover:-translate-y-0.5"
    >
      <div className="relative">
        <Link
          href={href}
          tabIndex={-1}
          aria-hidden="true"
          data-fly-source=""
          className="relative block aspect-square overflow-hidden rounded-md bg-white p-3"
        >
          <ProductImage
            image={product.image}
            alt=""
            sizes={imageSizes}
            priority={priority}
            fallbackLabel={t("noPicture")}
            className={cn(
              "transition-transform duration-300 ease-out motion-safe:group-hover:scale-[1.04]",
              unorderable && "opacity-40 grayscale",
            )}
          />
          {(onSale || left !== null) && (
            <span className="absolute top-2 left-2 flex flex-col items-start gap-1">
              {onSale && (
                <span className={cn(badge, "bg-red-600 text-white")}>
                  {formatDiscount(product.pricing.discountPercent, locale)}
                </span>
              )}
              {left !== null && (
                <span className={cn(badge, "bg-wheat-100 text-wheat-800")}>
                  {t("badge.fewLeft", { count: left })}
                </span>
              )}
            </span>
          )}
        </Link>
        <WishlistButton
          productId={product.id}
          name={title}
          className="absolute top-2 right-2"
        />
        {/* The tile's lower corner: the "+", the stepper that unfolds to
            the left in its place, or the pill of a size that cannot be
            ordered. */}
        <div className="absolute right-1.5 bottom-1.5 max-w-[calc(100%-0.75rem)] sm:right-2 sm:bottom-2 sm:max-w-[calc(100%-1rem)]">
          <AddToCart
            variantId={product.variantId}
            name={title}
            ordering={product.ordering}
            size="sm"
            look="round"
          />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 px-2 pt-3 pb-2">
        {brand && (
          <p className="text-ink-subtle truncate text-[0.6875rem] leading-4 font-bold tracking-[0.1em] uppercase">
            {brand}
          </p>
        )}
        <Heading className="line-clamp-2 min-h-10 text-[0.9375rem] leading-5 font-semibold">
          <Link
            href={href}
            className="hover:text-leaf-700 rounded-xs underline-offset-2 hover:underline"
          >
            {formatProductName(product.name)}{" "}
            <span className="text-ink-muted font-medium whitespace-nowrap">
              ({formatPackSize(product.packSize)})
            </span>
          </Link>
        </Heading>
        <Price pricing={product.pricing} className="mt-auto pt-1" />
      </div>
    </article>
  );
}
