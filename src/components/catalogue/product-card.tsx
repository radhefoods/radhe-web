"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useOrderingOpen } from "@/features/cargo/cargo";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { ProductSummary } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatDiscount } from "@/lib/format/money";
import { AddToCart, orderingReason } from "./add-to-cart";
import { Price } from "./price";
import { ProductImage } from "./product-image";

/**
 * A product in a list. Photo first; the pack sizes can be switched on the
 * card itself (each size is its own product with its own price and page);
 * the price per kilo sits under the price; one tap adds it to the cart.
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
  const open = useOrderingOpen();
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
  const soldOut = orderingReason(current.ordering, open) === "sold_out";
  const Heading = headingLevel;

  return (
    <article className="border-line hover:border-line-strong hover:shadow-card relative flex h-full flex-col overflow-hidden rounded-lg border bg-white transition-[box-shadow,border-color] duration-150">
      <Link
        href={href}
        tabIndex={-1}
        aria-hidden="true"
        className="bg-mist relative block aspect-square"
      >
        <ProductImage
          image={current.image ?? product.image}
          alt=""
          sizes={imageSizes}
          priority={priority}
          fallbackLabel={t("noPicture")}
          className={cn(soldOut && "opacity-60")}
        />
        <span className="absolute top-2 left-2 flex flex-col items-start gap-1">
          {soldOut ? (
            <span className="bg-ink rounded-xs px-2 py-0.5 text-xs font-bold text-white">
              {t("badge.sold_out")}
            </span>
          ) : (
            current.pricing.onSale && (
              <span className="bg-chili rounded-xs px-2 py-0.5 text-xs font-bold text-white tabular-nums">
                {formatDiscount(current.pricing.discountPercent, locale)}
              </span>
            )
          )}
          {product.storageType !== "ambient" && (
            <span className="rounded-xs bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-800">
              {t(`badge.${product.storageType}`)}
            </span>
          )}
        </span>
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-3 sm:p-3.5">
        {product.brand && (
          <p className="text-ink-muted text-[0.6875rem] font-bold tracking-wider uppercase">
            {product.brand}
          </p>
        )}
        <Heading className="text-[0.9375rem] leading-snug font-bold sm:text-base">
          <Link
            href={href}
            className="rounded-xs hover:text-blue-700 hover:underline"
          >
            {product.name}
          </Link>
        </Heading>

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
                  // The hit area is taller than the chip looks.
                  "relative rounded-xs border px-2 py-1 text-[0.8125rem] leading-tight font-semibold before:absolute before:inset-x-0 before:-inset-y-2",
                  size.id === current.id
                    ? "border-blue-600 bg-blue-50 text-blue-800 ring-1 ring-blue-600"
                    : "border-line-strong hover:border-ink-subtle bg-white",
                )}
              >
                {size.packSize.label}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-ink-muted text-[0.8125rem]">
            {current.packSize.label}
          </p>
        )}

        <Price pricing={current.pricing} className="mt-auto pt-1" />
        <AddToCart
          productId={current.id}
          name={fullName}
          ordering={current.ordering}
          size="sm"
        />
      </div>
    </article>
  );
}
