import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import type { ReactNode } from "react";
import { clientMessages, type ClientArea } from "./client-messages";

/**
 * Gives the client components of one area of the shop (account, checkout,
 * sign-in, the links from emails) the translations only they need, on top
 * of the basic ones every page carries.
 */
export async function AreaMessages({
  area,
  children,
}: {
  area: ClientArea;
  children: ReactNode;
}) {
  const messages = await getMessages();
  return (
    <NextIntlClientProvider messages={clientMessages(messages, area)}>
      {children}
    </NextIntlClientProvider>
  );
}
