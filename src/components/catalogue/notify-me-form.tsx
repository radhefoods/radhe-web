"use client";

import { Bell, BellRing, MailCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/error-alert";
import { TextField } from "@/components/ui/field";
import { checkEmail, normalizeEmail } from "@/features/auth/validation";
import type { StockAlertAsked } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import type { NotifyControl } from "./notify-me";

// The form of a visitor for "Notify me" (doc 26) and what follows it, for
// the block of the product page and for the panel of a card.

/** What a visitor is told after the form: confirm the address, or wait. */
export function NotifyMeAsked({ answer }: { answer: StockAlertAsked }) {
  const t = useTranslations("stockAlerts");
  return answer.confirmationRequired ? (
    <Alert
      tone="good"
      title={t("confirmTitle")}
      icon={<MailCheck aria-hidden="true" className="size-5" />}
    >
      <p>{t("confirmText")}</p>
    </Alert>
  ) : (
    <Alert
      tone="good"
      icon={<BellRing aria-hidden="true" className="size-5" />}
    >
      <p>{t("guestDone")}</p>
    </Alert>
  );
}

/**
 * The form: the address, and the box that says what is agreed to. Both are
 * checked before the request; the API has the last word, and its answer is
 * the same whether or not the address was waiting already.
 */
export function NotifyMeForm({
  control,
  idBase,
  className,
}: {
  control: NotifyControl;
  /** Unique on the page: the ids of the fields start with it. */
  idBase: string;
  className?: string;
}) {
  const t = useTranslations("stockAlerts");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [problems, setProblems] = useState({ email: false, consent: false });
  const field = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLInputElement>(null);
  // The form opened because "Notify me" was tapped: the address is next.
  useEffect(() => {
    field.current?.focus();
  }, []);

  const { busy, error } = control.local;
  const consentError = `${idBase}-consent-error`;

  async function send(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const found = { email: checkEmail(email) !== null, consent: !consent };
    setProblems(found);
    if (found.email) return field.current?.focus();
    if (found.consent) return box.current?.focus();
    const refused = await control.submit(normalizeEmail(email));
    if (refused) setProblems(refused);
  }

  return (
    <form
      method="post"
      onSubmit={send}
      noValidate
      className={cn("flex flex-col gap-4", className)}
    >
      <TextField
        id={`${idBase}-email`}
        inputRef={field}
        label={t("email")}
        type="email"
        name="email"
        autoComplete="email"
        inputMode="email"
        autoCapitalize="none"
        spellCheck={false}
        required
        value={email}
        onChange={(event) => {
          setEmail(event.target.value);
          setProblems((known) => ({ ...known, email: false }));
        }}
        error={problems.email && t("emailInvalid")}
      />
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={`${idBase}-consent`}
          className="flex cursor-pointer items-start gap-3"
        >
          <input
            id={`${idBase}-consent`}
            ref={box}
            type="checkbox"
            name="consent"
            required
            checked={consent}
            onChange={(event) => {
              setConsent(event.target.checked);
              setProblems((known) => ({ ...known, consent: false }));
            }}
            aria-invalid={problems.consent || undefined}
            aria-describedby={problems.consent ? consentError : undefined}
            className="accent-leaf-600 mt-0.5 size-5 shrink-0"
          />
          <span className="text-sm leading-relaxed">{t("consent")}</span>
        </label>
        {problems.consent && (
          <p
            id={consentError}
            role="alert"
            className="text-sm font-semibold text-red-800"
          >
            {t("consentRequired")}
          </p>
        )}
      </div>
      {error !== null && <ErrorAlert error={error} />}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" loading={busy} className="min-w-40 flex-1">
          <Bell aria-hidden="true" className="size-4 shrink-0" />
          {t("notify")}
        </Button>
        <Button variant="quiet" onClick={control.closeForm}>
          {t("back")}
        </Button>
      </div>
    </form>
  );
}
