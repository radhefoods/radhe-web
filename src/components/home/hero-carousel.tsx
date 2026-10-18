"use client";

import NextLink from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FocusEvent,
  type MouseEvent,
  type PointerEvent,
} from "react";
import { Link } from "@/i18n/navigation";
import type { Banner } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { shopHref } from "@/lib/navigation/shop-link";

/** The slideshow moves on by itself every six seconds (doc 17). */
const AUTOPLAY_MS = 6000;
/** A mouse that moved this far is dragging, not clicking. */
const DRAG_PX = 6;
/** A drag of a fifth of the width, or a quick flick, turns the slide. */
const TURN_SHARE = 0.2;
const FLICK_PX_PER_MS = 0.5;
/** How long the smooth scroll to the snapped slide takes, roughly. */
const SETTLE_MS = 450;

export interface CarouselLabels {
  /** The spoken name of the carousel. */
  region: string;
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

/**
 * How wide the carousel is shown: edge to edge on phones, the page's
 * container from small screens on.
 */
const SIZES =
  "(min-width: 84rem) 1280px, (min-width: 64rem) calc(100vw - 4rem), (min-width: 40rem) calc(100vw - 3rem), 100vw";

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
  const link = "block focus-visible:outline-offset-[-4px] sm:rounded-xl";
  if (!linkUrl) return picture;
  if (isExternal) {
    return (
      <a
        href={linkUrl}
        target="_blank"
        rel="noopener noreferrer"
        draggable={false}
        className={link}
      >
        {picture}
      </a>
    );
  }
  const href = shopHref(linkUrl);
  return href ? (
    <Link href={href} draggable={false} className={link}>
      {picture}
    </Link>
  ) : (
    // A path the shop does not know by name: the proxy adds the language.
    <NextLink href={linkUrl} draggable={false} className={link}>
      {picture}
    </NextLink>
  );
}

/**
 * The hero of the home page (doc 17; owner, 2026-10-19: in the place of
 * the woven band): one slide per live banner, in the admin's order, each
 * keeping its picture's ratio, edge to edge on phones and a rounded panel
 * from small screens on. It is a scroll-snap row: a finger swipes it as
 * the browser does, and a mouse drags it (owner, later that night: no
 * arrows, no pause button, only the dots); on release it settles on the
 * next, the previous or the same slide, and a drag never counts as a
 * click on the banner's link. It moves on by itself every six seconds,
 * except while the pointer rests on it, while a drag or a swipe is under
 * way, while something in it has the focus, while the tab is hidden, or
 * when the visitor asked for less motion; the dot of the shown slide fills
 * up while the next one is on its way. With one slide there is nothing to
 * turn. Not rendered at all when there is no banner (the page decides).
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
  // Resting under a pointer, a finger or a focus: the autoplay waits.
  const [resting, setResting] = useState(false);
  // A mouse drag under way: the row follows the pointer, snapping off.
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{
    startX: number;
    startLeft: number;
    startedAt: number;
    moved: boolean;
  } | null>(null);
  const settling = useRef<number | null>(null);
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

  const playing =
    count > 1 && !resting && !dragging && !reducedMotion && visible;
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      const element = scroller.current;
      if (!element || element.clientWidth === 0) return;
      goTo(Math.round(element.scrollLeft / element.clientWidth) + 1);
    }, AUTOPLAY_MS);
    return () => window.clearInterval(timer);
  }, [playing, goTo]);
  useEffect(
    () => () => {
      if (settling.current) window.clearTimeout(settling.current);
    },
    [],
  );

  // --- The mouse drags the row; a finger swipes it natively ---------------

  const onPointerDown = (event: PointerEvent<HTMLUListElement>) => {
    setResting(true);
    if (event.pointerType !== "mouse" || event.button !== 0 || count < 2) {
      return;
    }
    const element = event.currentTarget;
    if (settling.current) window.clearTimeout(settling.current);
    drag.current = {
      startX: event.clientX,
      startLeft: element.scrollLeft,
      startedAt: event.timeStamp,
      moved: false,
    };
    element.setPointerCapture(event.pointerId);
    setDragging(true);
  };

  const onPointerMove = (event: PointerEvent<HTMLUListElement>) => {
    const state = drag.current;
    if (!state) return;
    const dx = event.clientX - state.startX;
    if (!state.moved && Math.abs(dx) < DRAG_PX) return;
    state.moved = true;
    event.currentTarget.scrollLeft = state.startLeft - dx;
  };

  const endDrag = (event: PointerEvent<HTMLUListElement>) => {
    const state = drag.current;
    if (event.pointerType !== "mouse") {
      // The finger lifted: the autoplay may go on after a moment.
      setResting(false);
      return;
    }
    if (!state) return;
    drag.current = null;
    const element = event.currentTarget;
    if (element.hasPointerCapture(event.pointerId)) {
      element.releasePointerCapture(event.pointerId);
    }
    const width = element.clientWidth;
    const dx = event.clientX - state.startX;
    const elapsed = Math.max(1, event.timeStamp - state.startedAt);
    const from = Math.round(state.startLeft / width);
    let target = from;
    if (
      Math.abs(dx) > width * TURN_SHARE ||
      Math.abs(dx) / elapsed > FLICK_PX_PER_MS
    ) {
      target = from + (dx < 0 ? 1 : -1);
    }
    // Settle on the slide before the snapping comes back, so the row
    // glides there instead of jumping.
    const clamped = Math.min(count - 1, Math.max(0, target));
    element.scrollTo({
      left: clamped * width,
      behavior: reducedMotion ? "auto" : "smooth",
    });
    settling.current = window.setTimeout(() => {
      setDragging(false);
      settling.current = null;
    }, SETTLE_MS);
    // A click that was really a drag must not open the banner's link.
    if (state.moved) {
      element.dataset.dragged = "";
      window.setTimeout(() => delete element.dataset.dragged, 0);
    }
  };

  const onClickCapture = (event: MouseEvent<HTMLUListElement>) => {
    if (event.currentTarget.dataset.dragged !== undefined) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  const onPointer = (event: PointerEvent<HTMLElement>, inside: boolean) => {
    if (event.pointerType === "mouse") setResting(inside);
  };
  const onFocusChange = (event: FocusEvent<HTMLElement>, inside: boolean) => {
    const next = event.relatedTarget;
    if (inside) setResting(true);
    else if (!(next instanceof Node) || !event.currentTarget.contains(next)) {
      setResting(false);
    }
  };

  return (
    <section
      aria-roledescription="carousel"
      aria-label={labels.region}
      onPointerEnter={(event) => onPointer(event, true)}
      onPointerLeave={(event) => onPointer(event, false)}
      onFocus={(event) => onFocusChange(event, true)}
      onBlur={(event) => onFocusChange(event, false)}
      className={cn("relative -mx-4 sm:mx-0", className)}
    >
      <ul
        ref={scroller}
        onScroll={measure}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={onClickCapture}
        className={cn(
          "no-scrollbar bg-mist flex snap-x items-center overflow-x-auto sm:rounded-xl",
          // Off while the mouse drags, so the row follows the hand.
          dragging
            ? "cursor-grabbing snap-none select-none"
            : "snap-mandatory md:cursor-grab",
        )}
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
        /* The dots on a dark glass pill over the foot of the picture, where
           the admin keeps no text (doc 17). */
        <ul className="bg-ink/45 absolute bottom-2.5 left-1/2 z-10 flex -translate-x-1/2 items-center rounded-full px-1.5 py-1 backdrop-blur-sm sm:bottom-4">
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
                      "relative block h-2 overflow-hidden rounded-full transition-[width,background-color] duration-300",
                      current
                        ? "w-7 bg-white/35"
                        : "w-2 bg-white/60 hover:bg-white",
                    )}
                  >
                    {/* Fills up while the next slide is on its way. */}
                    {current && playing && (
                      <span
                        key={index}
                        className="animate-dot-fill absolute inset-0 origin-left rounded-full bg-white"
                        style={{ animationDuration: `${AUTOPLAY_MS}ms` }}
                      />
                    )}
                    {current && !playing && (
                      <span className="absolute inset-0 rounded-full bg-white" />
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
