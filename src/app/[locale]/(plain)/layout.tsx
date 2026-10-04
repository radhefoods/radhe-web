import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/shell/logo";
import { AreaMessages } from "@/i18n/area-messages";
import { Link } from "@/i18n/navigation";
import { localeOf } from "@/i18n/locale";

/**
 * The frame of the pages behind links in emails (payment link, unsubscribe):
 * the logo and the page. No navigation, no cart, no language switch: these
 * pages do one thing, in the language the link belongs to.
 */
export default async function PlainLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  await localeOf(params);
  const t = await getTranslations("nav");
  return (
    <>
      <header className="border-line border-b bg-white">
        <div className="container-page flex h-16 items-center">
          <Link href="/" aria-label={t("logoHome")} className="rounded-sm">
            <Logo className="h-9" />
          </Link>
        </div>
      </header>
      <main id="main" className="flex-1 pb-16">
        <AreaMessages area="emailLinks">{children}</AreaMessages>
      </main>
    </>
  );
}
