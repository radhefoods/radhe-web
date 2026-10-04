"use client";

import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import type { RefObject } from "react";
import { Sheet } from "@/components/ui/sheet";
import { Link } from "@/i18n/navigation";
import type { Category } from "@/lib/api/types";

/**
 * The panel behind the menu button on small screens: all categories. It is
 * loaded when the menu is first opened (see `MobileMenu`), so the dialog
 * code is not part of every page.
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
  const close = () => onOpenChange(false);
  const row =
    "flex min-h-12 items-center justify-between gap-3 rounded-sm px-2 text-[1.0625rem] font-semibold hover:bg-mist";

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("categories")}
      closeLabel={tCommon("close")}
      returnFocusTo={button}
    >
      <nav aria-label={t("categories")}>
        <ul className="flex flex-col">
          <li>
            <Link href="/products" onClick={close} className={row}>
              {t("allProducts")}
              <ChevronRight
                aria-hidden="true"
                className="text-ink-subtle size-5"
              />
            </Link>
          </li>
          {categories.map((category) => (
            <li key={category.id}>
              <Link
                href={{
                  pathname: "/category/[slug]",
                  params: { slug: category.slug },
                }}
                onClick={close}
                className={row}
              >
                {category.name}
                <ChevronRight
                  aria-hidden="true"
                  className="text-ink-subtle size-5"
                />
              </Link>
              {category.children.length > 0 && (
                <ul className="border-line mb-2 ml-2 flex flex-col border-l pl-3">
                  {category.children.map((child) => (
                    <li key={child.id}>
                      <Link
                        href={{
                          pathname: "/category/[slug]",
                          params: { slug: child.slug },
                        }}
                        onClick={close}
                        className="text-ink-muted hover:bg-mist hover:text-ink flex min-h-11 items-center rounded-sm px-2"
                      >
                        {child.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </Sheet>
  );
}
