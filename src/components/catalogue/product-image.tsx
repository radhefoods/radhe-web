import type { ApiImage } from "@/lib/api/types";
import { cn } from "@/lib/cn";

/**
 * A product picture from the API. The API delivers three ready-made WebP
 * sizes (320, 800, 1600 px) with their dimensions; the browser picks one
 * through `srcset`. The addresses are used exactly as given.
 *
 * A product without a picture is never an empty tile: the Radhe mark
 * stands in, ghosted on the tile like a watermark, with a small caption
 * where there is room for one (owner, 2026-10-16: a proper fallback).
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
  priority?: boolean;
  /** The caption under the mark when the product has no picture; "" for none (small tiles). */
  fallbackLabel: string;
  className?: string;
}) {
  if (!image) {
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
  const { small, medium, large } = image.sizes;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={medium.url}
      srcSet={`${small.url} ${small.width}w, ${medium.url} ${medium.width}w, ${large.url} ${large.width}w`}
      sizes={sizes}
      width={medium.width}
      height={medium.height}
      alt={alt ?? image.alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      className={cn("size-full object-contain", className)}
    />
  );
}
