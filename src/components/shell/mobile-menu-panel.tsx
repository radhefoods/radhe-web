"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import {
  useId,
  useMemo,
  useState,
  type MouseEvent,
  type RefObject,
} from "react";
import { Sheet } from "@/components/ui/sheet";
import {
  categoriesOf,
  holdsSlug,
  navItems,
} from "@/features/catalogue/navigation";
import { Link, usePathname } from "@/i18n/navigation";
import type { Category } from "@/lib/api/types";
import { cn } from "@/lib/cn";

/** How long a group takes to fold open (the `duration-200` below). */
const UNFOLD_MS = 200;

function categoryHref(slug: string) {
  return { pathname: "/category/[slug]" as const, params: { slug } };
}

/* A sub-category as a chip, like those of the page of all categories. */
const chip =
  "glass-soft text-ink-muted hover:text-leaf-700 aria-[current=page]:text-leaf-700 inline-flex min-h-9 items-center rounded-full px-3 text-sm font-semibold transition-colors duration-150 aria-[current=page]:bg-white/90";

/** The sub-categories of a category, and what lies below them, as chips. */
function SubCategories({
  category,
  label,
  currentSlug,
  onNavigate,
  className,
}: {
  category: Category;
  label: string;
  currentSlug: string | null;
  onNavigate: () => void;
  className?: string;
}) {
  const below = category.children.flatMap((child) => [
    child,
    ...child.children,
  ]);
  if (below.length === 0) return null;
  return (
    <ul aria-label={label} className={cn("flex flex-wrap gap-1.5", className)}>
      {below.map((entry) => (
        <li key={entry.id}>
          <Link
            href={categoryHref(entry.slug)}
            aria-current={entry.slug === currentSlug ? "page" : undefined}
            onClick={onNavigate}
            className={chip}
          >
            {entry.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * The panel behind the menu button on small screens: the categories of the
 * API and nothing else (owner, 2026-10-16), in the groups of the bar of
 * wide screens (owner, 2026-11-11; nineteen rows were two screens of
 * scrolling). A group is a row with its name and, under it, the names of
 * its categories, so that all of them are read at a glance; a tap folds
 * it open, one group at a time: each category as the link to its page,
 * with its sub-categories as chips under it. A category that stands alone
 * is a row that leads to its page, with a chevron that folds its
 * sub-categories out, as every row was before. The group of the page the
 * customer is on is open when the menu opens. Loaded when the menu is
 * first opened (see `MobileMenu`), so the dialog code is not part of every
 * page.
 */
export function MobileMenuPanel({
  categories,
  open,
  onOpenChange,
  button,
}: {
  categories: Category[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The menu button: focus goes back to it when the panel closes. */
  button: RefObject<HTMLButtonElement | null>;
}) {
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("categories")}
      closeLabel={tCommon("close")}
      returnFocusTo={button}
    >
      {/* Mounted with the sheet: each time it opens, the group of the
          page the customer is on is the open one. */}
      <CategoryList
        categories={categories}
        onNavigate={() => onOpenChange(false)}
      />
    </Sheet>
  );
}

function CategoryList({
  categories,
  onNavigate: close,
}: {
  categories: Category[];
  onNavigate: () => void;
}) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const params = useParams<{ slug?: string }>();
  const currentSlug =
    pathname === "/category/[slug]" && typeof params.slug === "string"
      ? params.slug
      : null;
  const items = useMemo(() => navItems(categories), [categories]);
  const [expanded, setExpanded] = useState<string | null>(
    () => items.find((item) => holdsSlug(item, currentSlug))?.key ?? null,
  );
  const baseId = useId();

  const row =
    "ring-ink/6 ease-glass flex min-h-13 items-stretch rounded-xl bg-white/55 ring-1 transition-[background-color,box-shadow] duration-200";
  const rowOpen = "shadow-card bg-white/90";
  const fold = (isOpen: boolean) =>
    cn(
      // Folds open by growing its one grid row from nothing.
      "grid transition-[grid-template-rows,visibility] duration-200",
      isOpen ? "visible grid-rows-[1fr]" : "invisible grid-rows-[0fr]",
    );

  return (
    <nav aria-label={t("categories")}>
      <ul className="flex flex-col gap-1.5">
        {items.map((item) => {
          const isOpen = expanded === item.key;
          const panelId = `${baseId}-${item.key}`;
          const toggle = (event: MouseEvent<HTMLButtonElement>) => {
            setExpanded(isOpen ? null : item.key);
            if (isOpen) return;
            // Once unfolded, the group is brought into view: one low in
            // the list would open below the edge of the sheet.
            const row = event.currentTarget.closest("li");
            setTimeout(() => {
              row?.scrollIntoView({
                block: "nearest",
                behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
                  .matches
                  ? "auto"
                  : "smooth",
              });
            }, UNFOLD_MS);
          };

          if (item.kind === "category") {
            const { category } = item;
            const hasChildren = category.children.length > 0;
            return (
              <li key={item.key}>
                <div className={cn(row, isOpen && rowOpen)}>
                  <Link
                    href={categoryHref(category.slug)}
                    aria-current={
                      category.slug === currentSlug ? "page" : undefined
                    }
                    onClick={close}
                    className="hover:text-leaf-700 aria-[current=page]:text-leaf-700 flex min-w-0 flex-1 items-center px-4 text-[1.0625rem] font-bold transition-colors duration-150"
                  >
                    {category.name}
                  </Link>
                  {hasChildren ? (
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      aria-label={t("subcategoriesOf", {
                        name: category.name,
                      })}
                      onClick={toggle}
                      className="text-ink-subtle hover:text-leaf-700 grid w-13 shrink-0 place-items-center rounded-r-xl transition-colors duration-150"
                    >
                      <ChevronDown
                        aria-hidden="true"
                        className={cn(
                          "size-5 transition-transform duration-200",
                          isOpen && "rotate-180",
                        )}
                      />
                    </button>
                  ) : (
                    <ChevronRight
                      aria-hidden="true"
                      className="text-ink-subtle mr-4 size-5 self-center"
                    />
                  )}
                </div>
                {hasChildren && (
                  <div id={panelId} className={fold(isOpen)}>
                    <div className="min-h-0 overflow-hidden">
                      <div inert={!isOpen} className="px-2 pt-2.5 pb-2">
                        <SubCategories
                          category={category}
                          label={t("subcategoriesOf", {
                            name: category.name,
                          })}
                          currentSlug={currentSlug}
                          onNavigate={close}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </li>
            );
          }

          const parents = categoriesOf(item);
          const label =
            item.label === "more"
              ? t("more")
              : item.label === "all"
                ? t("allCategories")
                : t(`groups.${item.label}`);
          return (
            <li key={item.key}>
              <div className={cn(row, isOpen && rowOpen)}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={toggle}
                  className="group/row flex min-w-0 flex-1 items-center gap-3 rounded-xl py-2.5 pr-3.5 pl-4 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block text-[1.0625rem] leading-snug font-bold transition-colors duration-150",
                        isOpen && "text-leaf-700",
                      )}
                    >
                      {label}
                    </span>
                    {/* What the group holds, read before it is opened. */}
                    <span className="text-ink-muted mt-0.5 line-clamp-2 block text-[0.8125rem] leading-snug">
                      {parents.map((category) => category.name).join(" · ")}
                    </span>
                  </span>
                  <ChevronDown
                    aria-hidden="true"
                    className={cn(
                      "text-ink-subtle group-hover/row:text-leaf-700 size-5 shrink-0 transition-[transform,color] duration-200",
                      isOpen && "rotate-180",
                    )}
                  />
                </button>
              </div>
              <div id={panelId} className={fold(isOpen)}>
                <div className="min-h-0 overflow-hidden">
                  <ul
                    inert={!isOpen}
                    className="divide-ink/8 flex flex-col divide-y px-2 pt-1 pb-2"
                  >
                    {parents.map((category) => (
                      <li key={category.id} className="py-1">
                        <Link
                          href={categoryHref(category.slug)}
                          aria-current={
                            category.slug === currentSlug ? "page" : undefined
                          }
                          onClick={close}
                          className="hover:text-leaf-700 aria-[current=page]:text-leaf-700 flex min-h-11 items-center gap-2 rounded-sm px-2 font-bold transition-colors duration-150"
                        >
                          <span className="min-w-0 flex-1">
                            {category.name}
                          </span>
                          <span
                            aria-hidden="true"
                            className="text-ink-subtle text-xs font-medium tabular-nums"
                          >
                            {category.productCount}
                          </span>
                          <ChevronRight
                            aria-hidden="true"
                            className="text-ink-subtle size-4 shrink-0"
                          />
                        </Link>
                        <SubCategories
                          category={category}
                          label={t("subcategoriesOf", {
                            name: category.name,
                          })}
                          currentSlug={currentSlug}
                          onNavigate={close}
                          className="px-2 pb-2"
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
