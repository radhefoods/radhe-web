import { cn } from "@/lib/cn";

/**
 * The Radhe wordmark with the peacock feather, as delivered. Only one
 * version exists, drawn for light backgrounds: use it on white or mist,
 * never on the dark bands, and never recolour it.
 */
export function Logo({ className }: { className?: string }) {
  return (
    // The files are small and already sized (160, 240 and 480 px wide; the
    // logo is shown about 80 px wide): the image optimizer adds nothing.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/radhe-logo-240.webp"
      srcSet="/brand/radhe-logo-160.webp 160w, /brand/radhe-logo-240.webp 240w, /brand/radhe-logo-480.webp 480w"
      sizes="80px"
      width={240}
      height={144}
      alt="Radhe Foods"
      className={cn("h-10 w-auto", className)}
    />
  );
}
