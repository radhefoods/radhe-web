"use client";

import NextLink from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
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
/** How long a slide takes to glide into place, and its easing (expo out). */
const GLIDE_MS = 700;
const GLIDE_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";
/** A pointer that moved this far is dragging, not clicking. */
const DRAG_PX = 6;
/** A drag of a fifth of the width, or a quick flick, turns the slide. */
const TURN_SHARE = 0.2;
const FLICK_PX_PER_MS = 0.5;

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

/** How wide the carousel is shown: the whole width of the window. */
const SIZES = "100vw";

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
  const link = "block focus-visible:outline-offset-[-4px]";
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

/** Where the track stands: at a slide, gliding or not, with the hand's offset. */
interface Track {
  /** -1 is the copy of the last slide before the first, `count` the copy of the first after the last. */
  position: number;
  /** Whether a change of position glides (transition) or jumps (none). */
  glide: boolean;
}

/**
 * The hero of the home page (doc 17; owner, 2026-10-19: in the place of
 * the woven band): one slide per live banner, in the admin's order, each
 * keeping its picture's ratio, across the whole width of the window
 * (owner, 2026-10-21). The slides sit on one track that moves by a
 * transform (owner, later that night: a fluid, premium slide): a change
 * glides with an expo easing, a finger or a mouse drags the track one to
 * one and lets it settle on the next, the previous or the same slide, and
 * a drag never counts as a click on the banner's link. The track loops
 * without a seam: a copy of the last slide stands before the first and
 * one of the first after the last, and the moment the track reaches a
 * copy it jumps, unseen, to the real slide. The dots turn it; the dot of
 * the shown slide fills up while the next one is on its way. It moves on
 * by itself every six seconds, except while the pointer rests on it, while
 * a drag is under way, while something in it has the focus, while the tab
 * is hidden, or when the visitor asked for less motion (then every change
 * jumps). With one slide there is nothing to turn. Not rendered at all
 * when there is no banner (the page decides).
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
  const count = banners.length;
  const viewport = useRef<HTMLDivElement>(null);
  const [track, setTrack] = useState<Track>({ position: 0, glide: true });
  /** The hand's offset while dragging, in pixels. */
  const [dragPx, setDragPx] = useState(0);
  const [dragging, setDragging] = useState(false);
  // Resting under a pointer or a focus: the autoplay waits.
  const [resting, setResting] = useState(false);
  const drag = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startedAt: number;
    moved: boolean;
    gaveUp: boolean;
  } | null>(null);
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

  /** The slide the dots name: the position brought back into the range. */
  const index = count ? ((track.position % count) + count) % count : 0;

  const glideTo = useCallback((position: number) => {
    setTrack({ position, glide: true });
  }, []);

  // At a copy, jump to the real slide without anyone seeing it; the next
  // change glides again.
  const settle = () => {
    setTrack((current) => {
      if (current.position === count) return { position: 0, glide: false };
      if (current.position === -1) return { position: count - 1, glide: false };
      return current;
    });
  };
  useEffect(() => {
    if (track.glide) return;
    const frame = window.requestAnimationFrame(() =>
      setTrack((current) => ({ ...current, glide: true })),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [track.glide]);

  const playing =
    count > 1 && !resting && !dragging && !reducedMotion && visible;
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(
      () =>
        setTrack((current) => ({
          position: current.position + 1,
          glide: true,
        })),
      AUTOPLAY_MS,
    );
    return () => window.clearInterval(timer);
  }, [playing]);

  // --- The hand drags the track ------------------------------------------

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (count < 2 || (event.pointerType === "mouse" && event.button !== 0)) {
      return;
    }
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startedAt: event.timeStamp,
      moved: false,
      gaveUp: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setResting(true);
    setDragging(true);
    // Wherever the track is on its way, it now follows the hand from here.
    setTrack((current) => ({ ...current, glide: false }));
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state || state.gaveUp || state.pointerId !== event.pointerId) return;
    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;
    if (!state.moved) {
      if (Math.abs(dx) < DRAG_PX && Math.abs(dy) < DRAG_PX) return;
      // A finger that goes up or down wants the page, not the slides.
      if (Math.abs(dy) > Math.abs(dx)) {
        state.gaveUp = true;
        event.currentTarget.releasePointerCapture(event.pointerId);
        setDragging(false);
        setTrack((current) => ({ ...current, glide: true }));
        return;
      }
      state.moved = true;
    }
    setDragPx(dx);
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state || state.pointerId !== event.pointerId) return;
    drag.current = null;
    const element = event.currentTarget;
    if (element.hasPointerCapture(event.pointerId)) {
      element.releasePointerCapture(event.pointerId);
    }
    if (event.pointerType !== "mouse") setResting(false);
    if (state.gaveUp) return;
    const width = element.clientWidth || 1;
    const dx = event.clientX - state.startX;
    const elapsed = Math.max(1, event.timeStamp - state.startedAt);
    let step = 0;
    if (
      state.moved &&
      (Math.abs(dx) > width * TURN_SHARE ||
        Math.abs(dx) / elapsed > FLICK_PX_PER_MS)
    ) {
      step = dx < 0 ? 1 : -1;
    }
    setDragPx(0);
    setDragging(false);
    setTrack((current) => ({ position: current.position + step, glide: true }));
    // A click that was really a drag must not open the banner's link.
    if (state.moved) {
      element.dataset.dragged = "";
      window.setTimeout(() => delete element.dataset.dragged, 0);
    }
  };

  const onClickCapture = (event: MouseEvent<HTMLDivElement>) => {
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

  // The copies that make the loop seamless, only when there is a loop.
  const looped = count > 1;
  const trackStyle: CSSProperties = {
    transform: `translate3d(calc(${-(track.position + (looped ? 1 : 0)) * 100}% + ${dragPx}px), 0, 0)`,
    transition:
      track.glide && !dragging
        ? `transform ${GLIDE_MS}ms ${GLIDE_EASING}`
        : "none",
  };

  const slide = (banner: Banner, position: number, copy: boolean) => (
    <li
      key={copy ? `copy-${banner.id}-${position}` : banner.id}
      role={copy ? undefined : "group"}
      aria-roledescription={copy ? undefined : "slide"}
      aria-label={copy ? undefined : labels.slides[position]}
      aria-hidden={copy || undefined}
      // Only the shown slide can be tabbed into; the others wait for the dots.
      inert={copy || position !== index}
      className="w-full shrink-0"
    >
      <Slide banner={banner} first={!copy && position === 0} />
    </li>
  );

  return (
    <section
      aria-roledescription="carousel"
      aria-label={labels.region}
      onPointerEnter={(event) => onPointer(event, true)}
      onPointerLeave={(event) => onPointer(event, false)}
      onFocus={(event) => onFocusChange(event, true)}
      onBlur={(event) => onFocusChange(event, false)}
      className={cn("group/hero relative", className)}
    >
      <div
        ref={viewport}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={onClickCapture}
        className={cn(
          // Edge to edge on phones; from `sm` a rounded glass-edged tile
          // inside the page, as the cards under it (2026-10-31).
          "bg-mist/60 touch-pan-y overflow-hidden select-none sm:rounded-3xl sm:shadow-[0_0_0_1px_rgb(23_33_27/0.06),0_24px_60px_-28px_rgb(23_33_27/0.35)]",
          looped && (dragging ? "cursor-grabbing" : "md:cursor-grab"),
        )}
      >
        <ul
          onTransitionEnd={settle}
          style={trackStyle}
          className="flex items-center will-change-transform"
        >
          {looped && slide(banners[count - 1], count - 1, true)}
          {banners.map((banner, position) => slide(banner, position, false))}
          {looped && slide(banners[0], 0, true)}
        </ul>
      </div>

      {looped && (
        /* The dots on a dark glass pill over the foot of the picture, where
           the admin keeps no text (doc 17). */
        <ul className="glass-dark absolute bottom-2.5 left-1/2 z-10 flex -translate-x-1/2 items-center rounded-full px-1.5 py-1 sm:bottom-4">
          {banners.map((banner, position) => {
            const current = position === index;
            return (
              <li key={banner.id}>
                <button
                  type="button"
                  aria-label={labels.goTo[position]}
                  aria-current={current ? "true" : undefined}
                  onClick={() => glideTo(position)}
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
                        key={track.position}
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
