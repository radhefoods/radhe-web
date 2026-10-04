import { ImageOff } from "lucide-react";
import type { ApiImage } from "@/lib/api/types";
import { cn } from "@/lib/cn";

/**
 * A product picture from the API. The API delivers three ready-made WebP
 * sizes (320, 800, 1600 px) with their dimensions; the browser picks one
 * through `srcset`. The addresses are used exactly as given.
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
  /** Shown when the product has no picture. */
  fallbackLabel: string;
  className?: string;
}) {
  if (!image) {
    return (
      <div
        className={cn(
          "text-ink-subtle flex size-full flex-col items-center justify-center gap-2 text-xs font-semibold",
          className,
        )}
      >
        <ImageOff aria-hidden="true" className="size-6" />
        {fallbackLabel}
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
