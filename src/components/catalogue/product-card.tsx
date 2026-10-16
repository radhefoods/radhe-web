import { useLocale, useTranslations } from "next-intl";
import { fewLeft, orderingReason } from "@/features/catalogue/availability";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { ProductSummary } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatDiscount } from "@/lib/format/money";
import { AddToCart } from "./add-to-cart";
import { Price } from "./price";
import { ProductImage } from "./product-image";

const badge =
  "rounded-full px-2 py-1 text-[0.6875rem] leading-none font-bold tabular-nums";

/**
 * A product in a list, as the one pack size the API shows it as (doc 7):
 * the picture on a mist tile with its badges, the name with the size as a
 * link to that size's page, the price with the regular price crossed out
 * when reduced and the price per unit under it, and the round "+" that
 * puts it in the cart. Nothing else (owner, 2026-10-16): the other sizes
 * are chosen on the product page. A sold-out product shows its picture
 * greyed and a "sold out" pill where the button was. Cards keep their
 * height whatever their state, so the grid never jumps. The tile is the
 * `data-fly-source` of the add button: its picture flies into the cart.
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
  const reason = orderingReason(product.ordering);
  const soldOut = reason === "sold_out";
  const left = fewLeft(product.ordering);
  const Heading = headingLevel;

  return (
    <article
      data-fly-scope=""
      className="border-line hover:border-line-strong hover:shadow-lift relative flex h-full flex-col rounded-lg border-[1.5px] bg-white p-2 pb-3 transition-[box-shadow,border-color,transform] duration-200 hover:-translate-y-0.5"
    >
      <Link
        href={href}
        tabIndex={-1}
        aria-hidden="true"
        data-fly-source=""
        className="bg-mist relative block aspect-square overflow-hidden rounded-md p-4"
      >
        <ProductImage
          image={product.image}
          alt=""
          sizes={imageSizes}
          priority={priority}
          fallbackLabel={t("noPicture")}
          className={cn(soldOut && "opacity-40 grayscale")}
        />
        <span className="absolute top-2 left-2 flex flex-col items-start gap-1">
          {soldOut ? (
            <span className={cn(badge, "bg-ink text-white")}>
              {t("badge.sold_out")}
            </span>
          ) : (
            product.pricing.onSale && (
              <span className={cn(badge, "bg-red-600 text-white")}>
                {formatDiscount(product.pricing.discountPercent, locale)}
              </span>
            )
          )}
          {left !== null && (
            <span className={cn(badge, "bg-wheat-100 text-wheat-800")}>
              {t("badge.fewLeft", { count: left })}
            </span>
          )}
          {product.storageType !== "ambient" && (
            <span className={cn(badge, "bg-leaf-50 text-leaf-700")}>
              {t(`badge.${product.storageType}`)}
            </span>
          )}
        </span>
      </Link>

      <div className="flex flex-1 flex-col gap-1.5 px-1.5 pt-3">
        <Heading className="line-clamp-2 text-[0.9375rem] leading-snug font-semibold">
          <Link
            href={href}
            className="hover:text-leaf-700 rounded-xs underline-offset-2 hover:underline"
          >
            {product.displayName}
          </Link>
        </Heading>
        <Price pricing={product.pricing} />

        <div className="mt-auto flex min-h-12 items-center justify-end pt-2">
          <AddToCart
            variantId={product.variantId}
            name={product.displayName}
            ordering={product.ordering}
            size="sm"
            look="round"
          />
        </div>
      </div>
    </article>
  );
}
