import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { NotificationsView } from "@/components/account/notifications-view";
import { getSettings } from "@/features/catalogue/data";
import { localeOf } from "@/i18n/locale";

type Props = PageProps<"/[locale]/account/notifications">;

/** Whether the shop offers "Notify me" (doc 26): the page exists only then. */
async function offered(): Promise<boolean> {
  return (await getSettings())?.stockAlerts?.enabled === true;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await localeOf(params);
  if (!(await offered())) {
    const t = await getTranslations("notFound");
    return { title: t("title") };
  }
  const t = await getTranslations("account");
  return { title: t("notifications.metaTitle") };
}

/**
 * "Notifications" in the account (doc 26): what the customer waits for.
 * The page exists while the shop offers "Notify me"; switched off, nothing
 * of the feature is shown, and the page is the shop's "not found". Like
 * every page of the account it is put on the screen by the browser, once
 * the account's frame knows who is here: the address itself answers 200,
 * and a visitor is sent to the sign-in first.
 */
export default async function Page({ params }: Props) {
  await localeOf(params);
  if (!(await offered())) notFound();
  return <NotificationsView />;
}
