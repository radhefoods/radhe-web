"use client";

import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import NextLink from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FocusEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { Link } from "@/i18n/navigation";
import type { Banner } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { shopHref } from "@/lib/navigation/shop-link";

/** The slideshow moves on by itself every six seconds (doc 17). */
const AUTOPLAY_MS = 6000;

export interface CarouselLabels {
  /** The spoken name of the carousel. */
  region: string;
  previous: string;
  next: string;
  pause: string;
  play: string;
  /** "Slide 1 of 3", one per banner. */
  slides: string[];
  /** "Go to slide 1", one per banner. */
  goTo: string[];
}

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeMotion(onChange: () => void): () => void {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function subscribeVisibility(onChange: () => void): () => void {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

/** How wide the carousel is shown: the page's container at every width. */
const SIZES =
  "(min-width: 84rem) 1280px, (min-width: 64rem) calc(100vw - 4rem), (min-width: 40rem) calc(100vw - 3rem), calc(100vw - 2rem)";

/**
 * One banner: the picture in a box of its own ratio, never cropped, so the
 * text the admin put on it stays whole on every screen (doc 17). Linked as
 * the API says: a path of the shop navigates in the shop, an address opens
 * in a new tab; without a link the picture just shows.
 */
function Slide({ banner, first }: { banner: Banner; first: boolean }) {
  const { image, linkUrl, isExternal } = banner;
  const { small, medium, large } = image.sizes;
  const picture = (
    <span
      className="bg-mist block w-full"
      style={{ aspectRatio: `${image.width} / ${image.height}` }}
    >
      {/* The API's ready-made sizes, as for the product pictures. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={medium.url}
        srcSet={`${small.url} ${small.width}w, ${medium.url} ${medium.width}w, ${large.url} ${large.width}w`}
        sizes={SIZES}
        width={image.width}
        height={image.height}
        alt={image.alt ?? ""}
        loading={first ? "eager" : "lazy"}
        fetchPriority={first ? "high" : undefined}
        decoding="async"
        draggable={false}
        className="block size-full object-contain"
      />
    </span>
  );
  // The outline of a focused link stays inside the rounded box.
  const link = "block rounded-xl focus-visible:outline-offset-[-4px]";
  if (!linkUrl) return picture;
  if (isExternal) {
    return (
      <a
        href={linkUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={link}
      >
        {picture}
      </a>
    );
  }
  const href = shopHref(linkUrl);
  return href ? (
    <Link href={href} className={link}>
      {picture}
    </Link>
  ) : (
    // A path the shop does not know by name: the proxy adds the language.
    <NextLink href={linkUrl} className={link}>
      {picture}
    </NextLink>
  );
}

/**
 * The hero carousel of the home page (doc 17): one slide per live banner,
 * in the admin's order, each keeping its picture's ratio. It scrolls and
 * snaps slide by slide, so a swipe on a phone works as it does on the
 * product rows; two round arrows (wide screens) and the dots turn it, and
 * it moves on by itself every six seconds, except while the pointer rests
 * on it, while something in it has the focus, while the tab is hidden,
 * when the visitor asked for less motion, or after the pause button. With
 * one slide there is nothing to turn: no arrows, no dots, no autoplay. Not
 * rendered at all when there is no banner (the page decides).
 */
export function HeroCarousel({
  banners,
  labels,
  className,
}: {
  banners: Banner[];
  labels: CarouselLabels;
  className?: string;
}) {
  const scroller = useRef<HTMLUListElement>(null);
  const count = banners.length;
  const [index, setIndex] = useState(0);
  // Paused by the button (stays), or resting under a pointer or a focus.
  const [paused, setPaused] = useState(false);
  const [resting, setResting] = useState(false);
  const reducedMotion = useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
  const visible = useSyncExternalStore(
    subscribeVisibility,
    () => document.visibilityState === "visible",
    () => true,
  );

  const goTo = useCallback(
    (wanted: number) => {
      const element = scroller.current;
      if (!element || count === 0) return;
      const target = ((wanted % count) + count) % count;
      element.scrollTo({
        left: target * element.clientWidth,
        behavior: reducedMotion ? "auto" : "smooth",
      });
    },
    [count, reducedMotion],
  );

  /** The slide the scroll box shows right now. */
  const shownIndex = () => {
    const element = scroller.current;
    if (!element || element.clientWidth === 0) return 0;
    return Math.round(element.scrollLeft / element.clientWidth);
  };
  const measure = () => setIndex(shownIndex());

  const playing = count > 1 && !paused && !resting && !reducedMotion && visible;
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      const element = scroller.current;
      if (!element || element.clientWidth === 0) return;
      goTo(Math.round(element.scrollLeft / element.clientWidth) + 1);
    }, AUTOPLAY_MS);
    return () => window.clearInterval(timer);
  }, [playing, goTo]);

  const onPointer = (event: PointerEvent<HTMLElement>, inside: boolean) => {
    // A finger that rests on the slide holds it; a mouse that rests, too.
    if (event.pointerType === "mouse" || event.type !== "pointerleave") {
      setResting(inside);
    }
  };
  const onFocusChange = (event: FocusEvent<HTMLElement>, inside: boolean) => {
    const next = event.relatedTarget;
    if (inside) setResting(true);
    else if (!(next instanceof Node) || !event.currentTarget.contains(next)) {
      setResting(false);
    }
  };

  const arrow =
    "border-line-strong hover:border-leaf-600 hover:text-leaf-700 shadow-card absolute top-1/2 z-10 hidden size-11 -translate-y-1/2 place-items-center rounded-full border-[1.5px] bg-white transition-[border-color,color] duration-150 md:grid";
  let dots: ReactNode = null;
  if (count > 1) {
    dots = (
      <div className="mt-3 flex items-center justify-center gap-3">
        <ul className="flex items-center">
          {banners.map((banner, position) => {
            const current = position === index;
            return (
              <li key={banner.id}>
                <button
                  type="button"
                  aria-label={labels.goTo[position]}
                  aria-current={current ? "true" : undefined}
                  onClick={() => goTo(position)}
                  className="grid h-6 min-w-6 place-items-center px-0.5"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "block h-2.5 rounded-full transition-[width,background-color] duration-200",
                      current
                        ? "bg-leaf-600 w-6"
                        : "bg-line-strong hover:bg-ink-subtle w-2.5",
                    )}
                  />
                </button>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          aria-pressed={paused}
          aria-label={paused ? labels.play : labels.pause}
          onClick={() => setPaused((current) => !current)}
          className="border-line-strong text-ink-muted hover:border-leaf-600 hover:text-leaf-700 grid size-9 place-items-center rounded-full border-[1.5px] bg-white transition-[border-color,color] duration-150"
        >
          {paused ? (
            <Play aria-hidden="true" className="size-4" />
          ) : (
            <Pause aria-hidden="true" className="size-4" />
          )}
        </button>
      </div>
    );
  }

  return (
    <section
      aria-roledescription="carousel"
      aria-label={labels.region}
      onPointerEnter={(event) => onPointer(event, true)}
      onPointerLeave={(event) => onPointer(event, false)}
      onPointerDown={(event) => onPointer(event, true)}
      onFocus={(event) => onFocusChange(event, true)}
      onBlur={(event) => onFocusChange(event, false)}
      className={cn("relative", className)}
    >
      <ul
        ref={scroller}
        onScroll={measure}
        className="no-scrollbar flex snap-x snap-mandatory items-center overflow-x-auto rounded-xl"
      >
        {banners.map((banner, position) => (
          <li
            key={banner.id}
            role="group"
            aria-roledescription="slide"
            aria-label={labels.slides[position]}
            className="w-full shrink-0 snap-center"
          >
            <Slide banner={banner} first={position === 0} />
          </li>
        ))}
      </ul>
      {count > 1 && (
        <>
          <button
            type="button"
            aria-label={labels.previous}
            onClick={() => goTo(index - 1)}
            className={cn(arrow, "left-3")}
          >
            <ChevronLeft aria-hidden="true" className="size-5" />
          </button>
          <button
            type="button"
            aria-label={labels.next}
            onClick={() => goTo(index + 1)}
            className={cn(arrow, "right-3")}
          >
            <ChevronRight aria-hidden="true" className="size-5" />
          </button>
        </>
      )}
      {dots}
    </section>
  );
}
