"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import type { ApiImage } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { ProductImage } from "./product-image";
import { PackSizeDiscount } from "./product-purchase";

/**
 * The pictures of a product (owner, 2026-10-19): one large picture on a
 * white tile with a hairline (white since 2026-10-23, as the packshots are
 * shot), and under it a strip of thumbnails when there are several,
 * each a button that shows its picture in the large tile. The first
 * picture is the page's main picture and loads at once; the tile is the
 * `data-fly-source` of the add button (its first child is the picture, as
 * the flight expects). A product without a picture shows the Radhe mark.
 */
export function ProductGallery({
  images,
  fallbackLabel,
  className,
}: {
  images: ApiImage[];
  /** The caption under the mark when the product has no picture. */
  fallbackLabel: string;
  className?: string;
}) {
  const t = useTranslations("product");
  const [index, setIndex] = useState(0);
  const shown = images[index] ?? images[0] ?? null;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div
        data-fly-source=""
        className="border-line relative aspect-square overflow-hidden rounded-xl border bg-white p-6 sm:p-8"
      >
        <ProductImage
          key={shown?.id ?? "none"}
          image={shown}
          sizes="(min-width: 768px) 46vw, 92vw"
          priority={shown === images[0]}
          fallbackLabel={fallbackLabel}
        />
        <PackSizeDiscount className="absolute top-3 left-3 rounded-full bg-red-600 px-3 py-1.5 text-sm font-bold text-white tabular-nums" />
      </div>

      {images.length > 1 && (
        <ul
          aria-label={t("gallery.label")}
          className="no-scrollbar flex gap-2 overflow-x-auto"
        >
          {images.map((image, position) => {
            const current = image === shown;
            return (
              <li key={image.id} className="shrink-0">
                <button
                  type="button"
                  aria-label={t("gallery.picture", {
                    index: position + 1,
                    count: images.length,
                  })}
                  aria-pressed={current}
                  onClick={() => setIndex(position)}
                  className={cn(
                    "block size-18 overflow-hidden rounded-md border-2 bg-white p-1.5 transition-colors duration-150 sm:size-20",
                    current
                      ? "border-leaf-600"
                      : "border-line hover:border-line-strong",
                  )}
                >
                  <ProductImage
                    image={image}
                    alt=""
                    sizes="80px"
                    fallbackLabel=""
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
