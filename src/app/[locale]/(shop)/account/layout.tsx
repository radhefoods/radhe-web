import type { Metadata } from "next";
import { AccountShell } from "@/components/account/account-shell";
import { AreaMessages } from "@/i18n/area-messages";
import { localeOf } from "@/i18n/locale";

// The account belongs to one customer: nothing here is for a search engine.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AccountLayout({
  children,
  params,
}: LayoutProps<"/[locale]/account">) {
  await localeOf(params);
  return (
    <AreaMessages area="account">
      <AccountShell>{children}</AccountShell>
    </AreaMessages>
  );
}
