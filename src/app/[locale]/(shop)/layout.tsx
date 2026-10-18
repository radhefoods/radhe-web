import { CartProblem } from "@/components/cart/cart-problem";
import { CartSummaryBar } from "@/components/cart/cart-summary-bar";
import { WishlistProblem } from "@/components/catalogue/wishlist-problem";
import { Footer } from "@/components/shell/footer";
import { Header } from "@/components/shell/header";
import { TabBar } from "@/components/shell/tab-bar";
import { getCategories, getSettings } from "@/features/catalogue/data";
import { localeOf } from "@/i18n/locale";

/** The frame of every shop page: header, footer, tab bar. */
export default async function ShopLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const locale = await localeOf(params);
  const [categories, settings] = await Promise.all([
    getCategories(locale),
    getSettings(),
  ]);

  return (
    <>
      <Header
        locale={locale}
        categories={categories}
        freeFrom={settings?.deliveryFee.freeFrom ?? null}
      />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer categories={categories} />
      <CartProblem />
      <WishlistProblem />
      <CartSummaryBar />
      <TabBar />
    </>
  );
}
