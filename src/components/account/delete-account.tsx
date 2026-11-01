"use client";

import { Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/error-alert";
import { PasswordField } from "@/components/ui/password-field";
import { setSessionHint } from "@/features/session/session";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { api } from "@/lib/api/browser";
import { hasErrorCode, type ErrorDetails } from "@/lib/api/errors";
import { cn } from "@/lib/cn";

/**
 * Closing the account for good (doc 2, `POST /v1/store/me/delete`): the
 * password, a box to tick, and the plain warning that there is no way
 * back. Orders and invoices stay for the books without the name. While an
 * order, a return or a report is still open the API refuses, and the
 * section lists what is open. On success the customer is signed out and
 * the home page loads afresh.
 */
export function DeleteAccount({ className }: { className?: string }) {
  const t = useTranslations("profile.delete");
  const locale = useLocale() as Locale;
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [wrongPassword, setWrongPassword] = useState(false);
  const [blocked, setBlocked] = useState<
    ErrorDetails["CUSTOMER_HAS_OPEN_ORDERS"] | null
  >(null);
  const [error, setError] = useState<unknown>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setAttempted(true);
    setWrongPassword(false);
    if (!confirm || password.length === 0) return;
    setBusy(true);
    setError(null);
    setBlocked(null);
    try {
      await api.deleteAccount({ password, confirm: true });
      setSessionHint(false);
      // A full load: nothing of the account stays in the browser's memory.
      window.location.assign(getPathname({ href: "/", locale }));
    } catch (caught) {
      setBusy(false);
      if (hasErrorCode(caught, "CUSTOMER_CREDENTIALS_INVALID")) {
        setWrongPassword(true);
        setPassword("");
      } else if (hasErrorCode(caught, "CUSTOMER_HAS_OPEN_ORDERS")) {
        setBlocked(caught.details);
      } else {
        setError(caught);
      }
    }
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      aria-labelledby="profile-delete"
      className={cn("ring-1 ring-red-600/15", className)}
    >
      <h2 id="profile-delete" className="font-display text-ink text-xl">
        {t("title")}
      </h2>
      <p className="text-ink-muted text-[0.9375rem]">{t("text")}</p>
      {blocked && (
        <Alert tone="warn" title={t("blockedTitle")}>
          {blocked.orderNumbers.length > 0 && (
            <p>
              {t("blockedOrders", {
                orderNumbers: blocked.orderNumbers.join(", "),
              })}
            </p>
          )}
          {(blocked.openReturns > 0 || blocked.openIssues > 0) && (
            <p>
              {[
                blocked.openReturns > 0 &&
                  t("blockedReturns", { count: blocked.openReturns }),
                blocked.openIssues > 0 &&
                  t("blockedIssues", { count: blocked.openIssues }),
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
          <p>{t("blockedText")}</p>
        </Alert>
      )}
      <PasswordField
        id="profile-delete-password"
        label={t("password")}
        name="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(event) => {
          setPassword(event.target.value);
          setWrongPassword(false);
        }}
        error={
          wrongPassword
            ? t("wrongPassword")
            : attempted && password.length === 0
              ? t("passwordMissing")
              : undefined
        }
        className="max-w-sm"
      />
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          className="accent-leaf-600 mt-0.5 size-6 shrink-0"
          checked={confirm}
          onChange={(event) => setConfirm(event.target.checked)}
          aria-describedby={
            attempted && !confirm ? "profile-delete-confirm-error" : undefined
          }
        />
        <span>{t("confirm")}</span>
      </label>
      {attempted && !confirm && (
        <p
          id="profile-delete-confirm-error"
          role="alert"
          className="text-sm font-semibold text-red-800"
        >
          {t("confirmMissing")}
        </p>
      )}
      {error !== null && <ErrorAlert error={error} />}
      <Button
        type="submit"
        variant="danger"
        loading={busy}
        className="self-start"
      >
        {!busy && <Trash2 aria-hidden="true" className="size-4" />}
        {t("button")}
      </Button>
    </form>
  );
}
