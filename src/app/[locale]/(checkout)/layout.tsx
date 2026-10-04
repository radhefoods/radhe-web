import { ChevronLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { CargoStrip } from "@/components/cargo/cargo-strip";
import { LocaleSwitcher } from "@/components/shell/locale-switcher";
import { Logo } from "@/components/shell/logo";
import { AreaMessages } from "@/i18n/area-messages";
import { Link } from "@/i18n/navigation";
import { localeOf } from "@/i18n/locale";

/**
 * The frame of the checkout: the logo, the way back to the cart, the state
 * of the pre-order. No navigation and no search: nothing here leads away
 * from confirming the order.
 */
export default async function CheckoutLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  await localeOf(params);
  const t = await getTranslations("checkout");
  const tNav = await getTranslations("nav");
  return (
    <>
      <header className="border-line border-b bg-white">
        <div className="container-page flex h-16 items-center justify-between gap-4">
          <Link href="/" aria-label={tNav("logoHome")} className="rounded-sm">
            <Logo className="h-9" />
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/cart"
              className="hover:bg-mist flex min-h-11 items-center gap-1 rounded-sm px-2 text-[0.9375rem] font-semibold"
            >
              <ChevronLeft aria-hidden="true" className="size-5" />
              {t("back")}
            </Link>
            <LocaleSwitcher />
          </div>
        </div>
      </header>
      <CargoStrip />
      <main id="main" className="flex-1 pb-16">
        <AreaMessages area="checkout">{children}</AreaMessages>
      </main>
    </>
  );
}
