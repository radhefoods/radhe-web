"use client";

import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import type { Category } from "@/lib/api/types";
import { cn } from "@/lib/cn";

/** A hovered item opens after a beat; a left one closes after a longer one. */
const OPEN_AFTER_MS = 60;
const CLOSE_AFTER_MS = 180;

function categoryHref(slug: string) {
  return { pathname: "/category/[slug]" as const, params: { slug } };
}

/** Every slug under a category, its own first. */
function slugsOf(category: Category): string[] {
  return [category.slug, ...category.children.flatMap(slugsOf)];
}

/* An item of the bar: a quiet pill that fills with frosted white under
   the pointer and takes the leaf tint on the page of its category or
   while its panel is open (2026-10-31). */
const item =
  "group-data-[open]:bg-leaf-50/80 group-data-[open]:text-leaf-700 relative flex h-9 items-center rounded-full px-3.5 text-[0.9375rem] font-semibold whitespace-nowrap transition-[background-color,color] duration-200 ease-glass hover:bg-white/70 hover:text-leaf-700 aria-[current=page]:bg-leaf-50/80 aria-[current=page]:text-leaf-700";

const subItem =
  "flex items-center justify-between gap-6 rounded-lg px-3 py-2.5 font-semibold transition-colors duration-150 hover:bg-ink/5 hover:text-leaf-700 aria-[current=page]:bg-leaf-50/80 aria-[current=page]:text-leaf-700";

/**
 * The category bar of wide screens (owner, 2026-10-16; centred since
 * 2026-10-19): the parent categories of the API, each a link to its page
 * with a leaf underline on
 * hover and on the page of the category or one of its children. A parent
 * with sub-categories has a chevron that opens a panel with them, which
 * also opens while the pointer rests on the item and stays while it moves
 * down into the panel; a short delay on leaving keeps it from vanishing on
 * the way. Keyboard: the chevron is a button (Enter or Space), Escape
 * closes and returns to it, leaving the item closes. A press anywhere
 * else closes too. Nothing but the categories is in the bar.
 *
 * Every link is in the HTML the server sends (closed panels are `hidden`),
 * so crawlers see the whole tree without a request. "All products" leads
 * the bar (owner, 2026-10-21); the phone menu keeps to the categories.
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
  const [openId, setOpenId] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const root = useRef<HTMLElement>(null);
  const baseId = useId();

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

  // A press outside the bar closes an open panel: a stray click, or a tap
  // elsewhere on a touch screen wide enough for the bar.
  useEffect(() => {
    if (!openId) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpenId(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [openId]);

  const close = () => setOpenId(null);
  const closeIf = (id: string) =>
    setOpenId((current) => (current === id ? null : current));

  return (
    <nav ref={root} aria-label={t("categories")} className={className}>
      <ul className="container-page flex h-12 flex-wrap items-center justify-center gap-x-1">
        {/* The whole range first (owner, 2026-10-21), then the categories. */}
        <li className="group relative">
          <Link
            href="/products"
            aria-current={pathname === "/products" ? "page" : undefined}
            onClick={close}
            className={item}
          >
            {t("allProducts")}
          </Link>
        </li>
        {categories.map((category) => {
          const children = category.children;
          const open = openId === category.id;
          const active =
            currentSlug !== null && slugsOf(category).includes(currentSlug);
          const panelId = `${baseId}-${category.id}`;
          return (
            <li
              key={category.id}
              data-open={open ? "" : undefined}
              className="group relative"
              onPointerEnter={(event) => {
                if (event.pointerType !== "mouse" || children.length === 0) {
                  return;
                }
                // Switch at once when another panel is already open.
                later(() => setOpenId(category.id), openId ? 0 : OPEN_AFTER_MS);
              }}
              onPointerLeave={(event) => {
                if (event.pointerType !== "mouse") return;
                later(() => closeIf(category.id), CLOSE_AFTER_MS);
              }}
              onBlur={(event) => {
                const next = event.relatedTarget;
                if (
                  !(next instanceof Node) ||
                  !event.currentTarget.contains(next)
                ) {
                  closeIf(category.id);
                }
              }}
              onKeyDown={(event) => {
                if (event.key !== "Escape" || !open) return;
                event.preventDefault();
                close();
                event.currentTarget
                  .querySelector<HTMLButtonElement>("[aria-expanded]")
                  ?.focus();
              }}
            >
              <div className="flex items-center">
                <Link
                  href={categoryHref(category.slug)}
                  aria-current={active ? "page" : undefined}
                  onClick={close}
                  className={cn(item, children.length > 0 && "pr-2")}
                >
                  {category.name}
                </Link>
                {children.length > 0 && (
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={panelId}
                    aria-label={t("subcategoriesOf", { name: category.name })}
                    onClick={() => setOpenId(open ? null : category.id)}
                    className="text-ink-subtle hover:text-leaf-700 grid size-8 place-items-center rounded-full transition-colors duration-150 hover:bg-white/70"
                  >
                    <ChevronDown
                      aria-hidden="true"
                      className={cn(
                        "size-4 transition-transform duration-200",
                        open && "rotate-180",
                      )}
                    />
                  </button>
                )}
              </div>

              {children.length > 0 && (
                // The wrapper starts at the item's edge, so the pointer
                // never crosses a gap on its way down.
                <div
                  id={panelId}
                  hidden={!open}
                  className="absolute top-full left-0 z-50 pt-2"
                >
                  <ul className="glass-strong shadow-float animate-dropdown-in min-w-60 rounded-2xl p-2 text-[0.9375rem]">
                    {children.map((child) => (
                      <li key={child.id}>
                        <Link
                          href={categoryHref(child.slug)}
                          aria-current={
                            child.slug === currentSlug ? "page" : undefined
                          }
                          onClick={close}
                          className={subItem}
                        >
                          {child.name}
                          <span
                            aria-hidden="true"
                            className="text-ink-subtle text-xs tabular-nums"
                          >
                            {child.productCount}
                          </span>
                        </Link>
                        {child.children.length > 0 && (
                          <ul className="border-ink/8 mb-1 ml-3 border-l-2 pl-1.5 text-sm">
                            {child.children.map((grandchild) => (
                              <li key={grandchild.id}>
                                <Link
                                  href={categoryHref(grandchild.slug)}
                                  aria-current={
                                    grandchild.slug === currentSlug
                                      ? "page"
                                      : undefined
                                  }
                                  onClick={close}
                                  className={cn(subItem, "py-2")}
                                >
                                  {grandchild.name}
                                  <span
                                    aria-hidden="true"
                                    className="text-ink-subtle text-xs tabular-nums"
                                  >
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
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
