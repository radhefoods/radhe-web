import { CargoStrip } from "@/components/cargo/cargo-strip";
import { CartProblem } from "@/components/cart/cart-problem";
import { CartSummaryBar } from "@/components/cart/cart-summary-bar";
import { Footer } from "@/components/shell/footer";
import { Header } from "@/components/shell/header";
import { TabBar } from "@/components/shell/tab-bar";
import { getCategories } from "@/features/catalogue/data";
import { localeOf } from "@/i18n/locale";

/** The frame of every shop page: header, pre-order strip, footer, tab bar. */
export default async function ShopLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const locale = await localeOf(params);
  const categories = await getCategories(locale);

  return (
    <>
      <Header locale={locale} categories={categories} />
      <CargoStrip />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer categories={categories} />
      <CartProblem />
      <CartSummaryBar />
      <TabBar />
    </>
  );
}
