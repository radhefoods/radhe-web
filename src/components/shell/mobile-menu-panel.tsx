"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, type RefObject } from "react";
import { Sheet } from "@/components/ui/sheet";
import { Link } from "@/i18n/navigation";
import type { Category } from "@/lib/api/types";
import { cn } from "@/lib/cn";

function categoryHref(slug: string) {
  return { pathname: "/category/[slug]" as const, params: { slug } };
}

/**
 * The panel behind the menu button on small screens: the categories of the
 * API and nothing else (owner, 2026-10-16). A parent is a row that leads
 * to its page; a parent with sub-categories has a chevron at its end that
 * folds them out beneath it, one parent at a time. Loaded when the menu is
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
  const [expanded, setExpanded] = useState<string | null>(null);
  const baseId = useId();
  const close = () => onOpenChange(false);
  const child =
    "text-ink-muted hover:text-ink flex min-h-11 items-center justify-between gap-4 rounded-sm px-2 font-semibold transition-colors duration-150";
  const count = "text-ink-subtle text-xs tabular-nums";

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("categories")}
      closeLabel={tCommon("close")}
      returnFocusTo={button}
    >
      <nav aria-label={t("categories")}>
        <ul className="flex flex-col gap-1.5">
          {categories.map((category) => {
            const children = category.children;
            const isOpen = expanded === category.id;
            const panelId = `${baseId}-${category.id}`;
            return (
              <li key={category.id}>
                <div
                  className={cn(
                    "ring-ink/6 ease-glass flex min-h-13 items-stretch rounded-xl bg-white/55 ring-1 transition-[background-color,box-shadow] duration-200",
                    isOpen && "shadow-card bg-white/90",
                  )}
                >
                  <Link
                    href={categoryHref(category.slug)}
                    onClick={close}
                    className="hover:text-leaf-700 flex min-w-0 flex-1 items-center px-4 text-[1.0625rem] font-bold transition-colors duration-150"
                  >
                    {category.name}
                  </Link>
                  {children.length > 0 ? (
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      aria-label={t("subcategoriesOf", {
                        name: category.name,
                      })}
                      onClick={() => setExpanded(isOpen ? null : category.id)}
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

                {children.length > 0 && (
                  // Folds open by growing its one grid row from nothing.
                  <div
                    id={panelId}
                    className={cn(
                      "grid transition-[grid-template-rows,visibility] duration-200",
                      isOpen
                        ? "visible grid-rows-[1fr]"
                        : "invisible grid-rows-[0fr]",
                    )}
                  >
                    <div className="min-h-0 overflow-hidden">
                      <ul
                        inert={!isOpen}
                        className="border-ink/8 my-1 ml-4 flex flex-col border-l-2 pl-3"
                      >
                        {children.map((sub) => (
                          <li key={sub.id}>
                            <Link
                              href={categoryHref(sub.slug)}
                              onClick={close}
                              className={child}
                            >
                              {sub.name}
                              <span aria-hidden="true" className={count}>
                                {sub.productCount}
                              </span>
                            </Link>
                            {sub.children.length > 0 && (
                              <ul className="border-ink/8 mb-1 ml-2 flex flex-col border-l-2 pl-2 text-sm">
                                {sub.children.map((grandchild) => (
                                  <li key={grandchild.id}>
                                    <Link
                                      href={categoryHref(grandchild.slug)}
                                      onClick={close}
                                      className={cn(child, "min-h-10")}
                                    >
                                      {grandchild.name}
                                      <span
                                        aria-hidden="true"
                                        className={count}
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
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </Sheet>
  );
}
