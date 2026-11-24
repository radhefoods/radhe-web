import { ChevronLeft, Lock } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "@/components/shell/locale-switcher";
import { Logo } from "@/components/shell/logo";
import { AreaMessages } from "@/i18n/area-messages";
import { Link } from "@/i18n/navigation";
import { localeOf } from "@/i18n/locale";

/**
 * The frame of the checkout: a pill of glass that floats at the head of
 * the page with the logo, the word that this is the secure checkout, the
 * way back to the cart and the language (owner, 2026-11-24, after the
 * checkout design "Liquid Glass" of the lab). No navigation and no
 * search: nothing here leads away from placing the order.
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
      <header className="glass sticky top-3 z-40 mx-auto mt-3 flex min-h-15 w-[calc(100%-1.5rem)] max-w-[72.5rem] items-center gap-3 rounded-full py-1.5 pr-2 pl-4 sm:w-[calc(100%-3rem)] sm:pl-5">
        <Link href="/" aria-label={tNav("logoHome")} className="rounded-sm">
          <Logo className="h-9 md:h-10" />
        </Link>
        <p className="text-leaf-700 flex items-center gap-1.5 text-[0.8125rem] font-semibold">
          <Lock aria-hidden="true" className="size-4" strokeWidth={2.25} />
          <span className="max-sm:sr-only">{t("secure")}</span>
        </p>
        <div className="ml-auto flex items-center gap-1.5 sm:gap-3">
          <Link
            href="/cart"
            aria-label={t("back")}
            className="ease-glass flex size-10 items-center justify-center gap-1 rounded-full bg-white/70 text-sm font-semibold shadow-[0_0_0_1px_rgb(23_33_27/0.09)] transition-[background-color,transform] duration-200 hover:bg-white active:scale-[0.98] sm:size-auto sm:min-h-10 sm:pr-3.5 sm:pl-2"
          >
            <ChevronLeft aria-hidden="true" className="size-5" />
            <span className="max-sm:hidden">{t("back")}</span>
          </Link>
          <LocaleSwitcher />
        </div>
      </header>
      <main id="main" className="flex-1 pb-28 lg:pb-16">
        <AreaMessages area="checkout">{children}</AreaMessages>
      </main>
    </>
  );
}
