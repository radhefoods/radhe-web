"use client";

import { ArrowRight, ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  categoriesOf,
  collapseTail,
  holdsSlug,
  navItems,
  type NavItem,
  type NavSection,
} from "@/features/catalogue/navigation";
import { Link, usePathname } from "@/i18n/navigation";
import type { Category } from "@/lib/api/types";
import { cn } from "@/lib/cn";

/**
 * A hovered item opens after a beat, so that a pointer on its way across
 * the bar opens nothing; a left one closes after a longer one, so that a
 * slanted way down into the panel does not lose it.
 */
const OPEN_AFTER_MS = 90;
const CLOSE_AFTER_MS = 220;

function categoryHref(slug: string) {
  return { pathname: "/category/[slug]" as const, params: { slug } };
}

/* An item of the bar: a quiet pill that fills with frosted white under
   the pointer and takes the leaf tint on the page of one of its
   categories or while its panel is open (2026-10-31). A size smaller up
   to 90 rem, where the German labels need the room. */
const item =
  "ease-glass hover:text-leaf-700 aria-[current]:bg-leaf-50/80 aria-[current]:text-leaf-700 group-data-[open]/item:bg-leaf-50/80 group-data-[open]/item:text-leaf-700 flex h-9 items-center gap-1 rounded-full px-3 text-sm font-semibold whitespace-nowrap transition-[background-color,color] duration-200 hover:bg-white/70 min-[90rem]:px-3.5 min-[90rem]:text-[0.9375rem]";

const chevron =
  "text-ink-subtle size-4 shrink-0 transition-transform duration-200 group-data-[open]/item:rotate-180 group-data-[open]/item:text-leaf-700";

/* A sub-category in a panel: its name and, quietly, how many products. */
const subLink =
  "text-ink-muted hover:text-leaf-700 hover:bg-leaf-50/70 aria-[current=page]:bg-leaf-50/80 aria-[current=page]:text-leaf-700 flex items-baseline justify-between gap-3 rounded-lg px-2.5 py-1 text-sm font-medium transition-colors duration-150 xl:py-1.5 xl:text-[0.9375rem]";

const count = "text-ink-subtle text-xs font-medium tabular-nums";

/**
 * One parent category in a panel: its name as the link to its page, over
 * a hairline, and its sub-categories under it. A block with room to spare
 * (a panel of two categories) sets them in columns. The two parts stand on
 * the rows of the panel's grid, so the hairlines of a row of blocks stay
 * in one line when one name needs two.
 */
function CategoryBlock({
  category,
  currentSlug,
  onNavigate,
}: {
  category: Category;
  currentSlug: string | null;
  onNavigate: () => void;
}) {
  return (
    <div className="row-span-2 grid min-w-0 grid-rows-subgrid gap-y-0">
      <Link
        href={categoryHref(category.slug)}
        aria-current={category.slug === currentSlug ? "page" : undefined}
        onClick={onNavigate}
        className="group/head text-ink hover:text-leaf-700 aria-[current=page]:text-leaf-700 border-ink/8 flex items-end gap-2 border-b px-2.5 pb-2 font-bold transition-colors duration-150 xl:pb-2.5"
      >
        <span className="min-w-0">
          {category.name}
          <span
            aria-hidden="true"
            className={cn(count, "ml-2 whitespace-nowrap")}
          >
            {category.productCount}
          </span>
        </span>
        <ArrowRight
          aria-hidden="true"
          className="ease-glass mb-1 ml-auto size-4 shrink-0 -translate-x-1.5 opacity-0 transition-[opacity,transform] duration-200 group-hover/head:translate-x-0 group-hover/head:opacity-100 group-focus-visible/head:translate-x-0 group-focus-visible/head:opacity-100"
        />
      </Link>
      {category.children.length > 0 && (
        <ul className="mt-2 columns-[12rem] gap-x-6 self-start">
          {category.children.map((child) => (
            <li key={child.id} className="break-inside-avoid">
              <Link
                href={categoryHref(child.slug)}
                aria-current={child.slug === currentSlug ? "page" : undefined}
                onClick={onNavigate}
                className={subLink}
              >
                {child.name}
                <span aria-hidden="true" className={count}>
                  {child.productCount}
                </span>
              </Link>
              {child.children.length > 0 && (
                <ul className="border-ink/8 mb-1 ml-2.5 border-l-2 pl-1">
                  {child.children.map((grandchild) => (
                    <li key={grandchild.id}>
                      <Link
                        href={categoryHref(grandchild.slug)}
                        aria-current={
                          grandchild.slug === currentSlug ? "page" : undefined
                        }
                        onClick={onNavigate}
                        className={cn(subLink, "xl:py-1 xl:text-sm")}
                      >
                        {grandchild.name}
                        <span aria-hidden="true" className={count}>
                          {grandchild.productCount}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * One item of the bar with its panel: a group as a button, or a category
 * that stands alone as a link with a chevron beside it. What the pointer,
 * a press and the focus do is told to the bar, which keeps the one open
 * panel.
 */
function BarItem({
  entry,
  open,
  panelId,
  currentSlug,
  className,
  onRest,
  onLeave,
  onToggle,
  onFocusOut,
  onNavigate,
}: {
  entry: NavItem;
  open: boolean;
  panelId: string;
  currentSlug: string | null;
  className?: string;
  /** The pointer came to rest on the item or its panel. */
  onRest: (key: string) => void;
  onLeave: (key: string) => void;
  /** A click, a tap, Enter or Space on the control of the panel. */
  onToggle: (key: string) => void;
  onFocusOut: (key: string) => void;
  /** A link was followed. */
  onNavigate: () => void;
}) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const key = entry.key;
  const active = holdsSlug(entry, currentSlug);
  const parents = categoriesOf(entry);
  const sections: NavSection[] =
    entry.kind === "group"
      ? entry.sections
      : [{ id: entry.group ?? "other", categories: parents }];
  const hasPanel = entry.kind === "group" || entry.category.children.length > 0;
  const labelOf = (id: NavSection["id"] | "more" | "all") =>
    id === "more"
      ? t("more")
      : id === "all"
        ? t("allCategories")
        : t(`groups.${id}`);

  return (
    <li
      data-open={open ? "" : undefined}
      className={cn("group/item flex items-center", className)}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse" && hasPanel) onRest(key);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") onLeave(key);
      }}
      onBlur={(event) => {
        const next = event.relatedTarget;
        if (!(next instanceof Node) || !event.currentTarget.contains(next)) {
          onFocusOut(key);
        }
      }}
    >
      {entry.kind === "group" ? (
        <button
          type="button"
          data-top=""
          data-opens={key}
          aria-expanded={open}
          aria-controls={panelId}
          aria-current={active ? "true" : undefined}
          onClick={() => onToggle(key)}
          className={cn(item, "pr-2.5 min-[90rem]:pr-3")}
        >
          {labelOf(entry.label)}
          <ChevronDown aria-hidden="true" className={chevron} />
        </button>
      ) : (
        <>
          <Link
            href={categoryHref(entry.category.slug)}
            data-top=""
            data-opens={hasPanel ? key : undefined}
            aria-current={active ? "page" : undefined}
            onClick={onNavigate}
            className={cn(item, hasPanel && "pr-1.5 min-[90rem]:pr-2")}
          >
            {entry.category.name}
          </Link>
          {hasPanel && (
            <button
              type="button"
              data-top=""
              data-opens={key}
              aria-expanded={open}
              aria-controls={panelId}
              aria-label={t("subcategoriesOf", {
                name: entry.category.name,
              })}
              onClick={() => onToggle(key)}
              className="hover:text-leaf-700 grid size-8 place-items-center rounded-full transition-colors duration-150 hover:bg-white/70"
            >
              <ChevronDown aria-hidden="true" className={chevron} />
            </button>
          )}
        </>
      )}

      {hasPanel && (
        // As wide as the bar and flush with its foot, so the pointer
        // crosses no gap on its way down, wherever the item stands.
        <div
          id={panelId}
          hidden={!open}
          className="absolute inset-x-0 top-full z-50"
        >
          <div className="container-page pt-2">
            <div
              // Takes the focus of a press on its own ground, so that the
              // panel does not close as if the focus had left.
              tabIndex={-1}
              className="shadow-float animate-dropdown-in max-h-[calc(100dvh-12rem)] scrollbar-thin overflow-y-auto overscroll-contain rounded-3xl bg-white p-4 text-left outline-none xl:p-6"
            >
              <div className="flex flex-col gap-6">
                {sections.map((section) => {
                  const captionId = `${panelId}-${section.id}`;
                  const captioned = sections.length > 1;
                  return (
                    <div
                      key={section.id}
                      role={captioned ? "group" : undefined}
                      aria-labelledby={captioned ? captionId : undefined}
                    >
                      {captioned && (
                        <p
                          id={captionId}
                          className="text-leaf-700 mb-2 px-2.5 text-xs font-bold tracking-[0.1em] uppercase"
                        >
                          {labelOf(section.id)}
                        </p>
                      )}
                      <div className="grid grid-cols-[repeat(auto-fit,minmax(12rem,1fr))] gap-x-6 gap-y-6">
                        {section.categories.map((category) => (
                          <CategoryBlock
                            key={category.id}
                            category={category}
                            currentSlug={currentSlug}
                            onNavigate={onNavigate}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="border-ink/8 mt-5 flex items-center justify-between gap-6 border-t px-2.5 pt-3.5 xl:mt-6 xl:pt-4">
                <p className="text-ink-subtle text-sm">
                  {t("groupSummary", {
                    categories: parents.length,
                    products: parents.reduce(
                      (sum, category) => sum + category.productCount,
                      0,
                    ),
                  })}
                </p>
                <Link
                  href="/categories"
                  aria-current={pathname === "/categories" ? "page" : undefined}
                  onClick={onNavigate}
                  className="group/all text-leaf-700 hover:text-leaf-800 flex items-center gap-1.5 rounded-sm text-sm font-semibold underline-offset-4 hover:underline"
                >
                  {t("allCategories")}
                  <ArrowRight
                    aria-hidden="true"
                    className="ease-glass size-4 transition-transform duration-200 group-hover/all:translate-x-0.5"
                  />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </li>
  );
}

/**
 * The category bar of wide screens, one row whatever the catalogue holds
 * (owner, 2026-11-11; a bar of the parent categories since 2026-10-16,
 * which the shop's nineteen filled three rows of). "All products" leads
 * (owner, 2026-10-21); then the groups of `navItems`, a handful of labels
 * that each open a mega menu: a white panel as wide as the page under the
 * bar, with the group's categories side by side, each the link to its
 * page over its sub-categories with their product counts, and at its foot
 * the way to the page of all categories. A category that stands alone is
 * a link with a chevron for its panel, as every item was before. Below
 * 80 rem the last groups share one item, "More", their categories under
 * the names of their groups.
 *
 * A panel opens while the pointer rests on its item (a beat, so that
 * crossing the bar opens nothing), stays while the pointer moves down
 * into it and closes a moment after the pointer left; the page behind
 * dims meanwhile. A click or a tap on the item opens and closes it, so
 * touch screens need no hover. Keyboard: Enter or Space on the item,
 * Tab through its links, the arrows left and right along the bar, the
 * arrow down into the panel, Escape to close and return to the item;
 * leaving the item closes. A press anywhere else closes too.
 *
 * Every link is in the HTML the server sends (closed panels are `hidden`),
 * so crawlers see the whole tree without a request.
 */
export function CategoryNav({
  categories,
  className,
}: {
  categories: Category[];
  className?: string;
}) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const params = useParams<{ slug?: string }>();
  const currentSlug =
    pathname === "/category/[slug]" && typeof params.slug === "string"
      ? params.slug
      : null;
  const items = useMemo(() => navItems(categories), [categories]);
  const narrow = useMemo(() => collapseTail(items), [items]);

  const [openKey, setOpenKey] = useState<string | null>(null);
  /** The open panel was opened by resting on its item, not by a press. */
  const byHover = useRef(false);
  /** The panel that opens next takes the focus (arrow down). */
  const focusInto = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const root = useRef<HTMLElement>(null);
  const baseId = useId();
  const panelId = (key: string) => `${baseId}-${key}`;

  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const later = (fn: () => void, ms: number) => {
    cancel();
    timer.current = setTimeout(fn, ms);
  };
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const show = (key: string, hover: boolean) => {
    byHover.current = hover;
    setOpenKey(key);
  };
  const close = () => {
    cancel();
    setOpenKey(null);
  };
  const closeIf = (key: string) =>
    setOpenKey((current) => (current === key ? null : current));

  const rest = (key: string) => {
    if (openKey === key) cancel();
    else later(() => show(key, true), OPEN_AFTER_MS);
  };
  const leave = (key: string) => later(() => closeIf(key), CLOSE_AFTER_MS);
  const toggle = (key: string) => {
    cancel();
    // A press on an item the pointer had opened keeps it open.
    if (openKey === key && !byHover.current) setOpenKey(null);
    else show(key, false);
  };

  const focusFirstLink = (key: string) =>
    document
      .getElementById(panelId(key))
      ?.querySelector<HTMLAnchorElement>("a[href]")
      ?.focus();

  // While a panel is open: a press outside the bar closes it (a stray
  // click, or a tap elsewhere on a touch screen), and so does Escape,
  // which hands the focus back to the item when it was in the panel.
  useEffect(() => {
    if (!openKey) return;
    if (focusInto.current) {
      focusInto.current = false;
      focusFirstLink(openKey);
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpenKey(null);
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (root.current?.contains(document.activeElement)) {
        event.preventDefault();
        root.current
          .querySelector<HTMLElement>(
            `[aria-controls="${CSS.escape(panelId(openKey))}"]`,
          )
          ?.focus();
      }
      setOpenKey(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
    // `panelId` and `focusFirstLink` read nothing but `baseId`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openKey]);

  // The arrows along the bar, and the arrow down into a panel.
  const onBarKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const from = event.target as HTMLElement;
    if (!from.hasAttribute("data-top")) return;
    if (event.key === "ArrowDown") {
      const key = from.dataset.opens;
      if (!key) return;
      event.preventDefault();
      if (openKey === key) {
        focusFirstLink(key);
      } else {
        cancel();
        focusInto.current = true;
        show(key, false);
      }
      return;
    }
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) {
      return;
    }
    // Only what is shown at this width: the others are `display: none`.
    const tops = [
      ...event.currentTarget.querySelectorAll<HTMLElement>("[data-top]"),
    ].filter((top) => top.offsetParent !== null);
    const step = event.key === "ArrowRight" ? 1 : -1;
    const next =
      event.key === "Home"
        ? tops[0]
        : event.key === "End"
          ? tops.at(-1)
          : tops[(tops.indexOf(from) + step + tops.length) % tops.length];
    if (!next) return;
    event.preventDefault();
    next.focus();
  };

  const barItem = (entry: NavItem, visibility?: string) => (
    <BarItem
      key={entry.key}
      entry={entry}
      open={openKey === entry.key}
      panelId={panelId(entry.key)}
      currentSlug={currentSlug}
      className={visibility}
      onRest={rest}
      onLeave={leave}
      onToggle={toggle}
      onFocusOut={closeIf}
      onNavigate={close}
    />
  );

  return (
    // Clipped sideways only: a catalogue of unusually long names must not
    // widen the page, and the panels still hang below the bar.
    <nav
      ref={root}
      aria-label={t("categories")}
      className={cn("relative overflow-x-clip", className)}
    >
      <ul
        onKeyDown={onBarKeyDown}
        className="container-page flex h-12 items-stretch justify-center gap-x-0.5 min-[90rem]:gap-x-1"
      >
        {/* The whole range first (owner, 2026-10-21), then the groups. */}
        <li className="flex items-center">
          <Link
            href="/products"
            data-top=""
            aria-current={pathname === "/products" ? "page" : undefined}
            onClick={close}
            className={item}
          >
            {t("allProducts")}
          </Link>
        </li>
        {items.map((entry, index) =>
          barItem(
            entry,
            // With "More" beside them, the last ones wait for a wider bar.
            narrow.more && index >= narrow.head.length
              ? "max-xl:hidden"
              : undefined,
          ),
        )}
        {narrow.more && barItem(narrow.more, "xl:hidden")}
      </ul>

      {/* The page behind, dimmed while a panel is open; the header stays
          clear above it. Seen only, never in the pointer's way. */}
      {openKey !== null &&
        createPortal(
          <div
            aria-hidden="true"
            className="bg-ink/20 animate-overlay-in pointer-events-none fixed inset-0 z-30 hidden lg:block"
          />,
          document.body,
        )}
    </nav>
  );
}
