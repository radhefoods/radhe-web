import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthPage } from "@/components/auth/auth-page";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { AreaMessages } from "@/i18n/area-messages";
import { localeOf } from "@/i18n/locale";
import { parseReturnTo } from "@/lib/navigation/return-to";

type Props = PageProps<"/[locale]/sign-up">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await localeOf(params);
  const t = await getTranslations("auth");
  return {
    title: t("signUpMetaTitle"),
    robots: { index: false, follow: false },
  };
}

export default async function SignUpPage({ params, searchParams }: Props) {
  await localeOf(params);
  const t = await getTranslations("auth");
  // The same way back as the sign-in page: the checkout, an order, the account.
  const returnTo = parseReturnTo((await searchParams).returnTo);

  return (
    <AuthPage
      title={t("signUpTitle")}
      intro={
        returnTo === "/checkout" ? t("signUpCheckoutNote") : t("signUpIntro")
      }
    >
      <AreaMessages area="signIn">
        <SignUpForm returnTo={returnTo} />
      </AreaMessages>
    </AuthPage>
  );
}
