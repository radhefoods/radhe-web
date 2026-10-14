import { cn } from "@/lib/cn";

/**
 * The Radhe wordmark with the peacock feather. The wordmark is the leaf
 * green of the shop (recoloured from the delivered blue with the owner's
 * approval of 2026-10-14; the feather is untouched, the shape unchanged).
 * The files are drawn for light backgrounds: use them on white or mist,
 * not on the dark bands. `logo/radhe-logo-green.png` is the full-size
 * source; the delivered blue original is next to it.
 */
export function Logo({ className }: { className?: string }) {
  return (
    // The files are small and already sized (160, 240 and 480 px wide; the
    // logo is shown 73 to 100 px wide, so the 240 and 480 px files serve
    // sharp screens): the image optimizer adds nothing.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/radhe-logo-240.webp"
      srcSet="/brand/radhe-logo-160.webp 160w, /brand/radhe-logo-240.webp 240w, /brand/radhe-logo-480.webp 480w"
      sizes="100px"
      width={240}
      height={144}
      alt="Radhe Foods"
      className={cn("h-10 w-auto", className)}
    />
  );
}
