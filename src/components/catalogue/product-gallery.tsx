"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, type ReactNode } from "react";
import type { ApiImage } from "@/lib/api/types";
import { srcSetOf } from "@/lib/catalogue/pictures";
import { cn } from "@/lib/cn";
import { ProductImage } from "./product-image";

/**
 * How wide the large picture is shown. The page is at most 84 rem wide:
 * beyond it the picture stays 566 px, and "46vw" would ask for the
 * 1600 px file.
 */
const GALLERY_SIZES =
  "(min-width: 1344px) 566px, (min-width: 1024px) 42vw, (min-width: 768px) 46vw, 92vw";

/** How long a browser without `requestIdleCallback` is given to settle. */
const SETTLE_MS = 2000;

/** The pictures on their way, held so that no fetch is dropped half way. */
const underway = new Set<HTMLImageElement>();

/**
 * Fetches pictures the gallery may show next, once the page has loaded
 * and the browser is idle, at low priority and with the `srcset` and the
 * `sizes` of the large picture, so that the browser keeps exactly the file
 * it will show. Nothing on a connection that asks to save data.
 */
export function usePicturesAhead(images: ApiImage[]): void {
  useEffect(() => {
    if (images.length === 0) return;
    const connection = (
      navigator as Navigator & {
        connection?: { saveData?: boolean; effectiveType?: string };
      }
    ).connection;
    if (connection?.saveData || connection?.effectiveType?.endsWith("2g")) {
      return;
    }

    let idle: number | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const fetchAll = () => {
      for (const image of images) {
        const picture = new Image();
        const done = () => underway.delete(picture);
        picture.onload = done;
        picture.onerror = done;
        underway.add(picture);
        picture.decoding = "async";
        picture.fetchPriority = "low";
        picture.sizes = GALLERY_SIZES;
        picture.srcset = srcSetOf(image);
        picture.src = image.sizes.medium.url;
      }
    };
    const whenIdle = () => {
      if (typeof window.requestIdleCallback === "function") {
        idle = window.requestIdleCallback(fetchAll, { timeout: 2 * SETTLE_MS });
      } else {
        timer = setTimeout(fetchAll, SETTLE_MS);
      }
    };
    if (document.readyState === "complete") whenIdle();
    else window.addEventListener("load", whenIdle, { once: true });

    return () => {
      window.removeEventListener("load", whenIdle);
      if (idle !== undefined) window.cancelIdleCallback(idle);
      clearTimeout(timer);
    };
  }, [images]);
}

/**
 * The pictures of one pack size of a product (owner, 2026-10-19; per pack
 * size since 2026-11-11, doc VARIANT_IMAGES): one large picture on a
 * white tile (white since 2026-10-23, as the packshots are shot), and
 * under it a strip of thumbnails when there are several, each a button
 * that shows its picture in the large tile. Set after the owner's layout
 * reference of 2026-10-31: the thumbnails are white tiles of their own,
 * the chosen one ringed in leaf, and the top corner of the picture holds
 * the heart of the wishlist (`corner`). The first picture is the page's
 * main picture and loads at once; the tile is the `data-fly-source` of
 * the add button (its first child is the picture, as the flight expects).
 * A size without a picture shows the Radhe mark and no thumbnails, never
 * the picture of another size.
 */
export function ProductGallery({
  sizeId,
  images,
  fallbackLabel,
  corner,
  className,
}: {
  /** The pack size the pictures belong to. */
  sizeId: string;
  /** Its gallery, main picture first; empty when it has no picture. */
  images: ApiImage[];
  /** The caption under the mark when the size has no picture. */
  fallbackLabel: string;
  /** What stands in the top right corner of the picture: the heart. */
  corner?: ReactNode;
  className?: string;
}) {
  const t = useTranslations("product");
  // The chosen picture is kept with the size it belongs to. Another size
  // starts at its own first picture, and so does this one when the
  // customer comes back to it: the choice is dropped with the size.
  const [chosen, setChosen] = useState({ sizeId, index: 0 });
  if (chosen.sizeId !== sizeId) setChosen({ sizeId, index: 0 });
  const index = chosen.sizeId === sizeId ? chosen.index : 0;
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
          sizes={GALLERY_SIZES}
          priority={shown !== null && shown === images[0]}
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
                  onClick={() => setChosen({ sizeId, index: position })}
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
