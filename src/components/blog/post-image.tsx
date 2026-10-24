import type { ApiImage } from "@/lib/api/types";
import { cn } from "@/lib/cn";

/**
 * The featured picture of a post, from the API's three ready-made widths
 * (480, 1024, 1920; doc 19), filling its box. A post without a picture
 * shows the Radhe mark ghosted on mist, as a product without one does.
 *
 * @param sizes how wide the picture is shown, as for `<img sizes>`
 * @param priority load at once and first: the picture that heads an article
 */
export function PostImage({
  image,
  sizes,
  priority = false,
  className,
}: {
  image: ApiImage | null;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  if (!image) {
    return (
      <div
        className={cn(
          "bg-mist flex size-full items-center justify-center",
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
          className="w-[36%] max-w-40 opacity-30"
        />
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
      alt={image.alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      className={cn("size-full object-cover", className)}
    />
  );
}
