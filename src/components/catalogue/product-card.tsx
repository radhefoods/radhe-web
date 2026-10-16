"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
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
 * A product in a list: the picture on a mist tile, then the price first,
 * the name, the pack sizes (each size is its own product with its own
 * price and page; they can be switched on the card), whether it is in
 * stock, and the round "+" that puts it in the cart. Cards keep their
 * height whatever their state, so the grid never jumps.
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
  const [selectedId, setSelectedId] = useState(product.id);

  const sizes = product.packSizes;
  const selected = sizes.find((size) => size.id === selectedId) ?? null;
  // The product itself is always one of its sizes; fall back to it anyway.
  const current = selected ?? {
    id: product.id,
    slug: product.slug,
    packSize: product.packSize,
    pricing: product.pricing,
    ordering: product.ordering,
    image: product.image,
  };
  const href = {
    pathname: "/products/[slug]" as const,
    params: { slug: current.slug },
  };
  const fullName = `${product.name}, ${current.packSize.label}`;
  const reason = orderingReason(current.ordering);
  const soldOut = reason === "sold_out";
  const left = fewLeft(current.ordering);
  const Heading = headingLevel;

  return (
    <article className="border-line hover:border-line-strong hover:shadow-lift relative flex h-full flex-col rounded-lg border-[1.5px] bg-white p-2 pb-3 transition-[box-shadow,border-color,transform] duration-200 hover:-translate-y-0.5">
      <Link
        href={href}
        tabIndex={-1}
        aria-hidden="true"
        className="bg-mist relative block aspect-square overflow-hidden rounded-md p-4"
      >
        <ProductImage
          image={current.image ?? product.image}
          alt=""
          sizes={imageSizes}
          priority={priority}
          fallbackLabel={t("noPicture")}
          className={cn(soldOut && "opacity-40")}
        />
        <span className="absolute top-2 left-2 flex flex-col items-start gap-1">
          {soldOut ? (
            <span className={cn(badge, "bg-ink text-white")}>
              {t("badge.sold_out")}
            </span>
          ) : (
            current.pricing.onSale && (
              <span className={cn(badge, "bg-red-600 text-white")}>
                {formatDiscount(current.pricing.discountPercent, locale)}
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
        <Price pricing={current.pricing} />
        <Heading className="line-clamp-2 text-[0.9375rem] leading-snug font-semibold">
          <Link
            href={href}
            className="hover:text-leaf-700 rounded-xs underline-offset-2 hover:underline"
          >
            {product.name}
          </Link>
        </Heading>
        {product.brand && (
          <p className="text-ink-subtle text-[0.6875rem] font-bold tracking-wider uppercase">
            {product.brand}
          </p>
        )}

        {sizes.length > 1 ? (
          <div
            role="group"
            aria-label={t("packSize")}
            className="flex flex-wrap gap-1.5"
          >
            {sizes.map((size) => (
              <button
                key={size.id}
                type="button"
                aria-pressed={size.id === current.id}
                onClick={() => setSelectedId(size.id)}
                className={cn(
                  // The hit area is taller than the pill looks.
                  "relative rounded-full border-[1.5px] px-2.5 py-1 text-[0.8125rem] leading-tight font-semibold transition-colors duration-150 before:absolute before:inset-x-0 before:-inset-y-2",
                  size.id === current.id
                    ? "border-leaf-600 bg-leaf-50 text-leaf-700"
                    : "border-line-strong hover:border-ink-subtle bg-white",
                )}
              >
                {size.packSize.label}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-ink-muted text-[0.8125rem] font-medium">
            {current.packSize.label}
          </p>
        )}

        {reason === null && (
          <p className="text-leaf-700 flex items-center gap-1.5 text-xs font-semibold">
            <span
              aria-hidden="true"
              className="bg-leaf-600 size-1.5 shrink-0 rounded-full"
            />
            {t("inStock")}
          </p>
        )}

        <div className="mt-auto flex min-h-12 items-center justify-end pt-2">
          <AddToCart
            productId={current.id}
            name={fullName}
            ordering={current.ordering}
            size="sm"
            look="round"
          />
        </div>
      </div>
    </article>
  );
}
