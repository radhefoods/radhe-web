import {
  LayoutGrid,
  PackageCheck,
  ShieldCheck,
  Tag,
  Truck,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ProductImage } from "@/components/catalogue/product-image";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { Category } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format/money";
import { AccountLink } from "./account-link";
import { CartLink } from "./cart-link";
import { LocaleSwitcher } from "./locale-switcher";
import { Logo } from "./logo";
import { MobileMenu } from "./mobile-menu";
import { SearchForm } from "./search-form";

/**
 * The top of every shop page, in three tiers like the stores people know:
 * the wheat strip with the promises of the shop and the language (wide
 * screens only), the white bar with logo, the pill search, the account and
 * cart icons, and the category chips with the offers at their end. On phones
 * the search moves under the logo, the categories sit behind the menu
 * button, and the tab bar at the bottom does the everyday navigation; the
 * header then scrolls away with the page.
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
  const chip =
    "flex h-11 items-center gap-2 rounded-full bg-mist px-4 text-sm font-semibold whitespace-nowrap transition-colors duration-150 hover:bg-cloud";

  return (
    <>
      {/* A named region: every part of the page belongs to a landmark. */}
      <section
        aria-label={tSite("name")}
        className="text-ink bg-wheat-400 hidden lg:block"
      >
        <div className="container-page flex h-10 items-center justify-between gap-6 text-[0.8125rem] font-semibold">
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
          <LocaleSwitcher tone="wheat" />
        </div>
      </section>

      <header className="shadow-header z-40 bg-white md:sticky md:top-0">
        <div className="container-page flex flex-wrap items-center gap-x-2 gap-y-2.5 py-3 lg:h-20 lg:flex-nowrap lg:gap-x-6 lg:py-0">
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
            className="order-last w-full lg:order-none lg:w-auto lg:max-w-2xl lg:flex-1"
          />

          <div className="flex items-center gap-2">
            <LocaleSwitcher className="lg:hidden" />
            <AccountLink className="hidden md:grid" />
            <CartLink className="hidden md:grid" />
            <MobileMenu categories={categories} />
          </div>
        </div>

        {categories.length > 0 && (
          <nav aria-label={t("main")} className="hidden lg:block">
            <ul className="container-page no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-3">
              <li>
                <Link href="/products" className={cn(chip, "font-bold")}>
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
                    className={cn(chip, item.image && "pl-1.5")}
                  >
                    {item.image && (
                      <span
                        aria-hidden="true"
                        className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-full bg-white p-1"
                      >
                        <ProductImage
                          image={item.image}
                          alt=""
                          sizes="32px"
                          fallbackLabel=""
                        />
                      </span>
                    )}
                    {item.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/how-it-works" className={chip}>
                  {t("howItWorks")}
                </Link>
              </li>
              <li className="ml-auto">
                <Link
                  href={{ pathname: "/products", query: { onSale: "1" } }}
                  className="flex h-11 items-center gap-1.5 rounded-full bg-red-50 px-4 text-sm font-bold whitespace-nowrap text-red-600 transition-colors duration-150 hover:bg-red-100"
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
