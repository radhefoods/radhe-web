import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { NotificationsView } from "@/components/account/notifications-view";
import { getSettings } from "@/features/catalogue/data";
import { localeOf } from "@/i18n/locale";

type Props = PageProps<"/[locale]/account/notifications">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await localeOf(params);
  const t = await getTranslations("account");
  return { title: t("notifications.metaTitle") };
}

/**
 * "Notifications" in the account (doc 26): what the customer waits for.
 * The page exists while the shop offers "Notify me"; switched off, nothing
 * of the feature is shown, and the page is not found.
 */
export default async function Page({ params }: Props) {
  await localeOf(params);
  const settings = await getSettings();
  if (settings?.stockAlerts?.enabled !== true) notFound();
  return <NotificationsView />;
}
