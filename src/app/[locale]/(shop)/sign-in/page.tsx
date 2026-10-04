import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { GoogleSignIn } from "@/components/auth/google-sign-in";
import { SignInForm } from "@/components/auth/sign-in-form";
import { AreaMessages } from "@/i18n/area-messages";
import { localeOf } from "@/i18n/locale";
import { parseReturnTo } from "@/lib/navigation/return-to";

type Props = PageProps<"/[locale]/sign-in">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await localeOf(params);
  const t = await getTranslations("auth");
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

export default async function SignInPage({ params, searchParams }: Props) {
  await localeOf(params);
  const t = await getTranslations("auth");
  // Only pages of the shop's own list are accepted as a way back.
  const returnTo = parseReturnTo((await searchParams).returnTo);

  return (
    <div className="container-page py-10 sm:py-16">
      <div className="mx-auto flex max-w-md flex-col gap-6">
        <header className="space-y-3">
          <h1 className="font-display text-4xl text-blue-900 sm:text-5xl">
            {t("title")}
          </h1>
          <p className="text-ink-muted">
            {returnTo === "/checkout" ? t("checkoutNote") : t("intro")}
          </p>
        </header>
        <AreaMessages area="signIn">
          <GoogleSignIn returnTo={returnTo} divider={t("or")} />
          <SignInForm returnTo={returnTo} />
        </AreaMessages>
        {returnTo === "/checkout" && (
          <p className="text-ink-muted text-sm">{t("intro")}</p>
        )}
      </div>
    </div>
  );
}
