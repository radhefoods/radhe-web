"use client";

import { useCallback, useState } from "react";
import type { ApiImage } from "@/lib/api/types";
import { isBroken, srcSetOf } from "@/lib/catalogue/pictures";
import { cn } from "@/lib/cn";

/**
 * A product picture from the API. The API delivers three ready-made WebP
 * sizes (320, 800, 1600 px) with their dimensions; the browser picks one
 * through `srcset`. The addresses are used exactly as given.
 *
 * A pack size without a picture is never an empty tile, and never shown
 * with the picture of another size (doc VARIANT_IMAGES): the Radhe mark
 * stands in, ghosted on the tile like a watermark, with a small caption
 * where there is room for one (owner, 2026-10-16: a proper fallback).
 *
 * A picture whose file cannot be loaded is shown the same way, instead of
 * the browser's sign for a broken picture (owner, 2026-11-11). The API
 * deletes a file when the admin replaces or removes the picture, and a
 * page of the last five minutes, a cart or a search of before may still
 * name it.
 *
 * @param sizes how wide the picture is shown, as for `<img sizes>`
 * @param priority load at once and first: the main picture of a page
 */
export function ProductImage({
  image,
  alt,
  sizes,
  priority = false,
  fallbackLabel,
  className,
}: {
  image: ApiImage | null;
  alt?: string;
  sizes: string;
  priority?: boolean | "eager";
  /** The caption under the mark when there is no picture; "" for none (small tiles). */
  fallbackLabel: string;
  className?: string;
}) {
  // The file that could not be loaded: kept by its address, so that
  // another picture in the same place is tried for itself.
  const [failed, setFailed] = useState<string | null>(null);
  // A picture of the server's page can fail before this component listens
  // (the error is not told twice): looked at once, when it is on the page.
  const look = useCallback((picture: HTMLImageElement | null) => {
    if (picture && isBroken(picture)) setFailed(picture.getAttribute("src"));
  }, []);

  if (!image || failed === image.sizes.medium.url) {
    return (
      <div
        className={cn(
          "flex size-full flex-col items-center justify-center gap-3 bg-[radial-gradient(closest-side,rgb(255_255_255_/_0.75),transparent)]",
          className,
        )}
      >
        {/* The brand files, small and already sized (see the header's logo). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/radhe-logo-240.webp"
          srcSet="/brand/radhe-logo-160.webp 160w, /brand/radhe-logo-240.webp 240w, /brand/radhe-logo-480.webp 480w"
          sizes="160px"
          width={240}
          height={144}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          className="w-[52%] max-w-40 opacity-30"
        />
        {fallbackLabel && (
          <span className="text-ink-subtle px-2 text-center text-[0.6875rem] font-bold tracking-wider uppercase">
            {fallbackLabel}
          </span>
        )}
      </div>
    );
  }
  const { medium } = image.sizes;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={look}
      src={medium.url}
      srcSet={srcSetOf(image)}
      sizes={sizes}
      width={medium.width}
      height={medium.height}
      alt={alt ?? image.alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority === true ? "high" : undefined}
      decoding="async"
      onError={() => setFailed(medium.url)}
      className={cn("size-full object-contain", className)}
    />
  );
}
