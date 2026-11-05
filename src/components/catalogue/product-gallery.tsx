"use client";

import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import type { ApiImage } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { ProductImage } from "./product-image";

/**
 * The pictures of a product (owner, 2026-10-19): one large picture on a
 * white tile (white since 2026-10-23, as the packshots are shot), and
 * under it a strip of thumbnails when there are several, each a button
 * that shows its picture in the large tile. Set after the owner's layout
 * reference of 2026-10-31: the thumbnails are white tiles of their own,
 * the chosen one ringed in leaf, and the top corner of the picture holds
 * the heart of the wishlist (`corner`). The first picture is the page's
 * main picture and loads at once; the tile is the `data-fly-source` of
 * the add button (its first child is the picture, as the flight expects).
 * A product without a picture shows the Radhe mark.
 */
export function ProductGallery({
  images,
  fallbackLabel,
  corner,
  className,
}: {
  images: ApiImage[];
  /** The caption under the mark when the product has no picture. */
  fallbackLabel: string;
  /** What stands in the top right corner of the picture: the heart. */
  corner?: ReactNode;
  className?: string;
}) {
  const t = useTranslations("product");
  const [index, setIndex] = useState(0);
  const shown = images[index] ?? images[0] ?? null;

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div
        data-fly-source=""
        className="surface relative aspect-square overflow-hidden rounded-2xl p-6 sm:p-8 lg:p-10"
      >
        <ProductImage
          key={shown?.id ?? "none"}
          image={shown}
          // The page is at most 84 rem wide: beyond it the picture stays
          // 566 px, and "46vw" would ask for the 1600 px file.
          sizes="(min-width: 1344px) 566px, (min-width: 1024px) 42vw, (min-width: 768px) 46vw, 92vw"
          priority={shown === images[0]}
          fallbackLabel={fallbackLabel}
        />
        {corner && (
          <div className="absolute top-3 right-3 sm:top-4 sm:right-4">
            {corner}
          </div>
        )}
      </div>

      {images.length > 1 && (
        <ul
          aria-label={t("gallery.label")}
          className="no-scrollbar flex gap-3 overflow-x-auto"
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
                    "ease-glass block size-20 overflow-hidden rounded-xl bg-white p-2 ring-1 transition-[box-shadow,transform] duration-200 active:scale-95 sm:size-24",
                    current
                      ? "ring-leaf-600 shadow-[0_0_0_3px_rgb(21_122_75/0.15)]"
                      : "ring-ink/8 shadow-card hover:ring-ink/20",
                  )}
                >
                  <ProductImage
                    image={image}
                    alt=""
                    sizes="96px"
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
