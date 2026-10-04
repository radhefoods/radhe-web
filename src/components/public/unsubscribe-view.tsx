"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button, buttonStyles } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/error-alert";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api/browser";
import { hasErrorCode } from "@/lib/api/errors";

/**
 * The page behind the unsubscribe link of a news email (doc 4). One tap
 * switches the news off; no sign-in.
 *
 * The page asks for that one tap instead of unsubscribing by itself when it
 * opens: mail programs and security scanners open links in emails on their
 * own, and nobody should lose their news that way.
 */
export function UnsubscribeView({ token }: { token: string }) {
  const t = useTranslations("unsubscribe");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [error, setError] = useState<unknown>(null);

  if (email !== null) {
    return (
      <div className="flex flex-col gap-4">
        <Alert tone="good" title={t("doneTitle")}>
          {t("doneText", { email })}
        </Alert>
        <p className="text-ink-muted">{t("again")}</p>
        <Link
          href="/account/profile"
          className={buttonStyles({
            variant: "secondary",
            className: "self-start",
          })}
        >
          {t("toProfile")}
        </Link>
      </div>
    );
  }

  if (invalid) {
    return (
      <div className="flex flex-col gap-4">
        <Alert tone="warn" title={t("invalidTitle")}>
          {t("invalidText")}
        </Alert>
        <Link
          href="/account/profile"
          className={buttonStyles({
            variant: "secondary",
            className: "self-start",
          })}
        >
          {t("toProfile")}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-lg">{t("text")}</p>
      {error !== null && <ErrorAlert error={error} />}
      <Button
        size="lg"
        className="self-start"
        loading={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            // The token is passed through exactly as it came.
            const result = await api.unsubscribe(token);
            setEmail(result.email);
          } catch (caught) {
            if (hasErrorCode(caught, "CUSTOMER_NOT_FOUND")) setInvalid(true);
            else setError(caught);
          } finally {
            setBusy(false);
          }
        }}
      >
        {t("confirm")}
      </Button>
    </div>
  );
}
