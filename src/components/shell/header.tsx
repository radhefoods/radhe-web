import {
  LayoutGrid,
  PackageCheck,
  ShieldCheck,
  Tag,
  Truck,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { Category } from "@/lib/api/types";
import { formatMoney } from "@/lib/format/money";
import { AccountLink } from "./account-link";
import { CartLink } from "./cart-link";
import { LocaleSwitcher } from "./locale-switcher";
import { Logo } from "./logo";
import { MobileMenu } from "./mobile-menu";
import { SearchForm } from "./search-form";

/**
 * The top of every shop page, in three tiers like the stores people know:
 * a dark strip with the promises of the shop and the language (wide screens
 * only), the main bar with logo, search, account and cart, and the
 * categories with the offers at their end. On phones the search moves under
 * the logo, the categories sit behind the menu button, and the tab bar at
 * the bottom does the everyday navigation; the header then scrolls away
 * with the page.
 */
export async function Header({
  locale,
  categories,
  freeFrom,
}: {
  locale: Locale;
  categories: Category[];
  /** The order value from which delivery is free, or null when unknown. */
  freeFrom: number | null;
}) {
  const [t, tHome, tSite] = await Promise.all([
    getTranslations("nav"),
    getTranslations("home"),
    getTranslations("site"),
  ]);
  const promise = "flex items-center gap-1.5 whitespace-nowrap";
  const promiseIcon = "text-saffron-400 size-4 shrink-0";
  const category =
    "text-ink-muted hover:bg-mist hover:text-ink flex h-11 items-center rounded-sm px-3 text-[0.9375rem] font-semibold whitespace-nowrap";

  return (
    <>
      {/* A named region: every part of the page belongs to a landmark. */}
      <section
        aria-label={tSite("name")}
        className="hidden bg-blue-900 text-white lg:block"
      >
        <div className="container-page flex h-9 items-center justify-between gap-6 text-[0.8125rem] font-medium">
          <ul className="flex items-center gap-6">
            <li className={promise}>
              <ShieldCheck aria-hidden="true" className={promiseIcon} />
              {tHome("trustPay")}
            </li>
            <li className={promise}>
              <Truck aria-hidden="true" className={promiseIcon} />
              {tHome("trustDelivery")}
            </li>
            {freeFrom !== null && (
              <li className={promise}>
                <PackageCheck aria-hidden="true" className={promiseIcon} />
                {tHome("trustFree", { amount: formatMoney(freeFrom, locale) })}
              </li>
            )}
          </ul>
          <LocaleSwitcher tone="dark" />
        </div>
      </section>

      <header className="border-line z-40 border-b bg-white md:sticky md:top-0">
        <div className="container-page flex flex-wrap items-center gap-x-2 gap-y-2.5 py-2.5 lg:h-[4.75rem] lg:flex-nowrap lg:gap-x-6 lg:py-0">
          <Link
            href="/"
            aria-label={t("logoHome")}
            className="mr-auto shrink-0 rounded-sm lg:mr-0"
          >
            <Logo className="h-9 lg:h-11" />
          </Link>

          <SearchForm
            locale={locale}
            id="header-search"
            className="order-last w-full lg:order-none lg:w-auto lg:max-w-2xl lg:flex-1"
          />

          <div className="flex items-center gap-1 lg:gap-2">
            <LocaleSwitcher className="lg:hidden" />
            <AccountLink className="hidden md:flex" />
            <CartLink className="hidden md:flex" />
            <MobileMenu categories={categories} />
          </div>
        </div>

        {categories.length > 0 && (
          <nav
            aria-label={t("main")}
            className="border-line hidden border-t lg:block"
          >
            <ul className="container-page no-scrollbar flex items-center gap-1 overflow-x-auto">
              <li className="mr-2">
                <Link
                  href="/products"
                  className="flex h-11 items-center gap-2 rounded-sm pr-3 text-[0.9375rem] font-bold whitespace-nowrap hover:text-blue-700"
                >
                  <LayoutGrid aria-hidden="true" className="size-[1.125rem]" />
                  {t("allCategories")}
                </Link>
              </li>
              {categories.map((item) => (
                <li key={item.id}>
                  <Link
                    href={{
                      pathname: "/category/[slug]",
                      params: { slug: item.slug },
                    }}
                    className={category}
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/how-it-works" className={category}>
                  {t("howItWorks")}
                </Link>
              </li>
              <li className="ml-auto">
                <Link
                  href={{ pathname: "/products", query: { onSale: "1" } }}
                  className="flex h-11 items-center gap-1.5 rounded-sm px-3 text-[0.9375rem] font-bold whitespace-nowrap text-red-600 hover:bg-red-50"
                >
                  <Tag aria-hidden="true" className="size-4" />
                  {t("offers")}
                </Link>
              </li>
            </ul>
          </nav>
        )}
      </header>
    </>
  );
}
