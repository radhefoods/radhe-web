import { CartProblem } from "@/components/cart/cart-problem";
import { CartSummaryBar } from "@/components/cart/cart-summary-bar";
import { StockAlertNotice } from "@/components/catalogue/stock-alert-notice";
import { WishlistProblem } from "@/components/catalogue/wishlist-problem";
import { Footer } from "@/components/shell/footer";
import { Header } from "@/components/shell/header";
import { InvitationNotice } from "@/components/shell/invitation-notice";
import { TabBar } from "@/components/shell/tab-bar";
import { getCategories, getSettings } from "@/features/catalogue/data";
import { deliveryPromiseOf } from "@/features/catalogue/delivery-promise";
import { getPublishedLegal } from "@/features/legal/data";
import { StockAlertsProvider } from "@/features/stock-alerts/stock-alerts";
import { localeOf } from "@/i18n/locale";

/** The frame of every shop page: header, footer, tab bar. */
export default async function ShopLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const locale = await localeOf(params);
  const [categories, settings, legal] = await Promise.all([
    getCategories(locale),
    getSettings(),
    getPublishedLegal(),
  ]);
  const promise = deliveryPromiseOf(settings);

  return (
    // "Notify me" (doc 26) is offered while the settings say so; an API
    // without the switch, and settings that could not be read, mean no.
    <StockAlertsProvider enabled={settings?.stockAlerts?.enabled === true}>
      <Header
        locale={locale}
        categories={categories}
        freeFrom={promise.freeFrom}
        boxCapacity={promise.boxCapacity}
      />
      <InvitationNotice />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer
        categories={categories}
        publishedLegal={legal && legal.map((page) => page.type)}
      />
      <CartProblem />
      <WishlistProblem />
      <StockAlertNotice />
      <CartSummaryBar />
      <TabBar />
    </StockAlertsProvider>
  );
}
