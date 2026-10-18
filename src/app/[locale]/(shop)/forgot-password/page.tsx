import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthPage } from "@/components/auth/auth-page";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { AreaMessages } from "@/i18n/area-messages";
import { localeOf } from "@/i18n/locale";

type Props = PageProps<"/[locale]/forgot-password">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await localeOf(params);
  const t = await getTranslations("auth");
  return {
    title: t("forgotMetaTitle"),
    robots: { index: false, follow: false },
  };
}

// Also for a signed-in customer: there is no other way to a new password
// (doc 1, "no change-password page").
export default async function ForgotPasswordPage({ params }: Props) {
  await localeOf(params);
  const t = await getTranslations("auth");
  return (
    <AuthPage title={t("forgotTitle")} intro={t("forgotIntro")}>
      <AreaMessages area="signIn">
        <ForgotPasswordForm />
      </AreaMessages>
    </AuthPage>
  );
}
