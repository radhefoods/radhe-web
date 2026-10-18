import { PackageCheck, ShieldCheck, Truck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { Category } from "@/lib/api/types";
import { formatMoney } from "@/lib/format/money";
import { AccountLink } from "./account-link";
import { CartLink } from "./cart-link";
import { CategoryNav } from "./category-nav";
import { LocaleSwitcher } from "./locale-switcher";
import { Logo } from "./logo";
import { MobileMenu } from "./mobile-menu";
import { SearchForm } from "./search-form";
import { WishlistLink } from "./wishlist-link";

/**
 * The top of every shop page, in three tiers like the stores people know:
 * the wheat strip with the promises of the shop, centred (wide screens
 * only); the white bar with the logo, the pill search that fills the bar
 * up to the language switch (owner, 2026-10-19), and at its right end the
 * language switch, the wishlist heart with its count, the
 * account and the cart (owner, 2026-10-19: in this order); and the centred
 * category bar with its dropdowns. On phones the search moves under the
 * logo, the categories sit behind the menu button, and the tab bar at the
 * bottom does the everyday navigation; the header then scrolls away with
 * the page.
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
  const promise = "flex items-center gap-2 whitespace-nowrap";
  const promiseIcon = "size-4 shrink-0";

  return (
    <>
      {/* A named region: every part of the page belongs to a landmark. */}
      <section
        aria-label={tSite("name")}
        className="text-ink bg-wheat-400 hidden lg:block"
      >
        <ul className="container-page flex h-10 items-center justify-center gap-10 text-[0.8125rem] font-semibold">
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
      </section>

      <header className="shadow-header z-40 bg-white md:sticky md:top-0">
        <div className="container-page flex flex-wrap items-center gap-x-2 gap-y-3 py-3 lg:h-20 lg:flex-nowrap lg:gap-x-8 lg:py-0">
          <Link
            href="/"
            aria-label={t("logoHome")}
            className="mr-auto shrink-0 rounded-sm lg:mr-0"
          >
            <Logo className="h-11 md:h-12 lg:h-15" />
          </Link>

          <SearchForm
            locale={locale}
            id="header-search"
            className="order-last w-full lg:order-none lg:w-auto lg:flex-1"
          />

          {/* The right end: language, wishlist, account, cart; the menu
              button on screens without the category bar. */}
          <div className="flex items-center gap-1 sm:gap-1.5 lg:ml-auto lg:gap-2">
            <LocaleSwitcher />
            <WishlistLink />
            <AccountLink className="hidden md:grid" />
            <CartLink className="hidden md:grid" />
            <MobileMenu categories={categories} />
          </div>
        </div>

        {categories.length > 0 && (
          <CategoryNav
            categories={categories}
            className="border-line hidden border-t lg:block"
          />
        )}
      </header>
    </>
  );
}
