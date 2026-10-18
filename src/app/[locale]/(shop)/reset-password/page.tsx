import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthPage } from "@/components/auth/auth-page";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { AreaMessages } from "@/i18n/area-messages";
import { localeOf } from "@/i18n/locale";

type Props = PageProps<"/[locale]/reset-password">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await localeOf(params);
  const t = await getTranslations("auth");
  return {
    title: t("resetMetaTitle"),
    robots: { index: false, follow: false },
    // The address carries the token of the email: it goes to no other site.
    referrer: "no-referrer",
  };
}

/**
 * `/reset-password?token=…`, the page behind the link of the password reset
 * email (doc 1). The path is fixed by the email and the same in both
 * languages; the proxy adds the customer's language and keeps the query.
 * Public: no session needed, and a signed-in customer is not sent away.
 */
export default async function ResetPasswordPage({
  params,
  searchParams,
}: Props) {
  await localeOf(params);
  const t = await getTranslations("auth");
  const raw = (await searchParams).token;
  const token = typeof raw === "string" && raw.trim() ? raw.trim() : null;
  return (
    <AuthPage title={t("resetTitle")} intro={token ? t("resetIntro") : null}>
      <AreaMessages area="signIn">
        <ResetPasswordForm token={token} />
      </AreaMessages>
    </AuthPage>
  );
}
