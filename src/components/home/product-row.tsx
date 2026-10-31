"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

type Href = ComponentProps<typeof Link>["href"];

/**
 * A section with a row of cards that scrolls sideways (owner, 2026-10-16):
 * the heading with its tagline, the link to the full list, and from medium
 * screens on two round arrows that move one page at a time and dim at the
 * ends. The arrows exist only while the row holds more than fits (owner,
 * 2026-10-19). The row snaps card by card, bleeds into the page gutter so
 * a swipe on a phone runs edge to edge, and shows a sliver of the next
 * card as a hint. Its scroll box has room above and below, so a card that
 * lifts on hover is never cut. The cards are the server's: this component
 * only holds the scroller and its arrows. Used on the home page and, for
 * the related products and the categories, on the product page.
 *
 * A row can have more cards than it holds (`more`, the rows of the home
 * page since 2026-10-24): then the forward arrow stays alive at the end,
 * scrolling within a screen of the end asks for the next cards, and a
 * turn asked for at the end goes on as soon as they (or their placeholders)
 * arrive.
 */
export function ProductRow({
  id,
  title,
  tagline,
  href,
  link,
  linkLabel,
  labels,
  more,
  children,
}: {
  id: string;
  title: string;
  tagline?: string | null;
  href: Href;
  /** The visible text of the link to the full list. */
  link: string;
  /** Its spoken name, naming the list: "See all Rice". */
  linkLabel: string;
  labels: { back: string; forward: string };
  /** Whether cards beyond the children exist, and how to ask for them. */
  more?: { hasMore: boolean; load: () => void };
  children: ReactNode;
}) {
  const scroller = useRef<HTMLUListElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  // Whether there is more than fits; true until measured, so the arrows
  // are in the HTML the server sends and vanish only when not needed.
  const [scrollable, setScrollable] = useState(true);
  // A turn asked for at the end while more cards were on their way.
  const turnWhenMore = useRef(false);
  const hasMore = more?.hasMore ?? false;

  const measure = useCallback(() => {
    const element = scroller.current;
    if (!element) return;
    const most = element.scrollWidth - element.clientWidth;
    setScrollable(most > 1);
    setAtStart(element.scrollLeft <= 1);
    setAtEnd(element.scrollLeft >= most - 1);
  }, []);

  // The ends depend on the width: measured on mount and whenever it changes.
  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [measure]);

  const turn = useCallback((direction: -1 | 1) => {
    const element = scroller.current;
    if (!element) return;
    element.scrollBy({
      left: direction * element.clientWidth,
      behavior: "smooth",
    });
  }, []);

  // The cards changed (a page arrived, or its placeholders): the ends
  // moved, and a turn that waited for them goes on.
  useEffect(() => {
    measure();
    if (turnWhenMore.current) {
      turnWhenMore.current = false;
      turn(1);
    }
  }, [children, measure, turn]);

  const onScroll = () => {
    measure();
    const element = scroller.current;
    if (!hasMore || !element) return;
    // Within a screen of the end: ask for the next cards now, so they are
    // there by the time the visitor gets there.
    const left = element.scrollWidth - element.clientWidth - element.scrollLeft;
    if (left < element.clientWidth) more?.load();
  };

  const forward = () => {
    if (atEnd && hasMore) {
      turnWhenMore.current = true;
      more?.load();
    } else {
      turn(1);
    }
  };

  const arrow =
    "glass-soft hover:text-leaf-700 ease-glass grid size-11 place-items-center rounded-full transition-[background-color,color,opacity,transform,box-shadow] duration-200 hover:bg-white/90 hover:shadow-lift active:scale-95 disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-ink disabled:hover:shadow-none disabled:active:scale-100";

  return (
    <section aria-labelledby={id}>
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2
            id={id}
            className="font-display text-ink text-[1.625rem] sm:text-3xl"
          >
            {title}
          </h2>
          {tagline && (
            <p className="text-ink-muted mt-1 text-[0.9375rem]">{tagline}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <Link
            href={href}
            aria-label={linkLabel}
            className="text-leaf-700 hover:bg-leaf-50/80 flex min-h-9 items-center rounded-full px-3 text-[0.9375rem] font-semibold whitespace-nowrap transition-colors duration-200"
          >
            {link}
          </Link>
          <div
            className={cn(
              "hidden gap-2 md:flex",
              !scrollable && !hasMore && "md:hidden",
            )}
          >
            <button
              type="button"
              aria-label={labels.back}
              disabled={atStart}
              onClick={() => turn(-1)}
              className={arrow}
            >
              <ChevronLeft aria-hidden="true" className="size-5" />
            </button>
            <button
              type="button"
              aria-label={labels.forward}
              disabled={atEnd && !hasMore}
              onClick={forward}
              className={arrow}
            >
              <ChevronRight aria-hidden="true" className="size-5" />
            </button>
          </div>
        </div>
      </div>

      <ul
        ref={scroller}
        onScroll={onScroll}
        className={cn(
          // Bleeds into the gutter of the page on either side and scrolls
          // under it; at rest the first card lines up with the heading.
          // The vertical padding (taken back by the negative margin) is
          // room for the lift and the shadow of a hovered card.
          "no-scrollbar -mx-4 mt-1 -mb-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-4 py-4 sm:-mx-6 sm:scroll-px-6 sm:gap-4 sm:px-6 lg:-mx-8 lg:scroll-px-8 lg:px-8",
          "scroll-px-4",
        )}
      >
        {children}
      </ul>
    </section>
  );
}

/** One card of the row: two and a sliver on phones, then three, four, five. */
export function ProductRowItem({ children }: { children: ReactNode }) {
  return (
    <li className="w-[44%] shrink-0 snap-start sm:w-[calc((100%-2rem)/3)] lg:w-[calc((100%-3rem)/4)] xl:w-[calc((100%-4rem)/5)]">
      {children}
    </li>
  );
}
