import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { Category } from "@/lib/api/types";
import { AccountLink } from "./account-link";
import { CartLink } from "./cart-link";
import { LocaleSwitcher } from "./locale-switcher";
import { Logo } from "./logo";
import { MobileMenu } from "./mobile-menu";
import { SearchForm } from "./search-form";

/**
 * The top of every shop page: logo, search, language, account and cart, and
 * on wide screens the categories. On phones the categories sit behind the
 * menu button and the tab bar at the bottom does the everyday navigation.
 */
export async function Header({
  locale,
  categories,
}: {
  locale: Locale;
  categories: Category[];
}) {
  const t = await getTranslations("nav");
  return (
    <header className="border-line sticky top-0 z-40 border-b bg-white/95 backdrop-blur-sm">
      <div className="container-page flex h-16 items-center gap-3 lg:h-[4.5rem] lg:gap-6">
        <Link
          href="/"
          aria-label={t("logoHome")}
          className="shrink-0 rounded-sm"
        >
          <Logo className="h-9 lg:h-11" />
        </Link>

        <SearchForm
          locale={locale}
          id="header-search"
          className="ml-2 hidden max-w-xl flex-1 md:block"
        />

        <div className="ml-auto flex items-center gap-1 lg:gap-2">
          <LocaleSwitcher className="mr-1" />
          <AccountLink className="hidden md:grid" />
          <span className="hidden md:block">
            <CartLink />
          </span>
          <MobileMenu categories={categories} />
        </div>
      </div>

      {categories.length > 0 && (
        <nav
          aria-label={t("main")}
          className="border-line hidden border-t lg:block"
        >
          <ul className="container-page no-scrollbar flex gap-1 overflow-x-auto py-1">
            <li>
              <Link
                href="/products"
                className="hover:bg-mist flex h-10 items-center rounded-sm px-3 text-[0.9375rem] font-bold whitespace-nowrap"
              >
                {t("allProducts")}
              </Link>
            </li>
            {categories.map((category) => (
              <li key={category.id}>
                <Link
                  href={{
                    pathname: "/category/[slug]",
                    params: { slug: category.slug },
                  }}
                  className="text-ink-muted hover:bg-mist hover:text-ink flex h-10 items-center rounded-sm px-3 text-[0.9375rem] font-semibold whitespace-nowrap"
                >
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
