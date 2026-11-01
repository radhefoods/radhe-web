import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthPage } from "@/components/auth/auth-page";
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
  const { returnTo: wanted, email } = await searchParams;
  const returnTo = parseReturnTo(wanted);
  // The guest checkout sends the address that turned out to have an
  // account (doc 20); anything else that is not an address is ignored.
  const initialEmail =
    typeof email === "string" && email.length <= 254 && email.includes("@")
      ? email
      : "";

  return (
    <AuthPage
      title={t("title")}
      intro={returnTo === "/checkout" ? t("checkoutNote") : t("intro")}
    >
      <AreaMessages area="signIn">
        <SignInForm returnTo={returnTo} initialEmail={initialEmail} />
      </AreaMessages>
    </AuthPage>
  );
}
