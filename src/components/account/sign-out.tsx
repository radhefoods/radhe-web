"use client";

import { LogOut } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button, type ButtonVariant } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/error-alert";
import { setSessionHint } from "@/features/session/session";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { api } from "@/lib/api/browser";

/**
 * Signs out: on this device, or (`everywhere`) on all devices. Afterwards
 * the home page is loaded afresh, so nothing of the customer stays in the
 * browser's memory: no cached order, address or invoice.
 */
export function SignOutButton({
  everywhere = false,
  variant = "secondary",
}: {
  everywhere?: boolean;
  variant?: ButtonVariant;
}) {
  const t = useTranslations("profile");
  const locale = useLocale() as Locale;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant={variant}
        size="sm"
        loading={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await (everywhere ? api.logoutAll() : api.logout());
            setSessionHint(false);
            // A full load, not a route change: it empties the memory, and the
            // account page cannot redirect to the sign-in page meanwhile.
            window.location.assign(getPathname({ href: "/", locale }));
          } catch (caught) {
            setError(caught);
            setBusy(false);
          }
        }}
      >
        {!busy && <LogOut aria-hidden="true" className="size-4" />}
        {everywhere ? t("signOutAll") : t("signOut")}
      </Button>
      {error !== null && <ErrorAlert error={error} />}
    </div>
  );
}
