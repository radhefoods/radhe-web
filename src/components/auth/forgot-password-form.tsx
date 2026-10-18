"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/error-alert";
import { TextField } from "@/components/ui/field";
import {
  checkEmail,
  normalizeEmail,
  type EmailProblem,
} from "@/features/auth/validation";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { api } from "@/lib/api/browser";
import { fieldProblems } from "@/lib/api/errors";
import { authLink } from "./auth-page";

/**
 * "Forgot password?" (doc 1, `POST /v1/store/auth/password/forgot`): the
 * address, and the API emails a link. The answer is the same whether or
 * not the address has an account, and so is this page: it never says. The
 * email can be sent again; the API quietly sends at most three an hour.
 */
export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const locale = useLocale() as Locale;
  const [email, setEmail] = useState("");
  const [problem, setProblem] = useState<EmailProblem | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);
  // How many times the email was asked for.
  const [sent, setSent] = useState(0);

  async function send() {
    const found = checkEmail(email);
    setProblem(found);
    setError(null);
    if (found) return;
    setPending(true);
    try {
      await api.forgotPassword({ email: normalizeEmail(email), locale });
      setSent((count) => count + 1);
    } catch (caught) {
      if (fieldProblems(caught).email) setProblem("emailInvalid");
      else setError(caught);
    } finally {
      setPending(false);
    }
  }

  if (sent > 0) {
    return (
      <div className="flex flex-col gap-5">
        <Alert tone="good" title={t("sentTitle")}>
          <p>{t("sentText")}</p>
          {sent > 1 && <p className="font-semibold">{t("sentAgain")}</p>}
        </Alert>
        <p className="text-ink-muted text-[0.9375rem]">{t("sentHint")}</p>
        {error !== null && <ErrorAlert error={error} />}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <Button
            variant="secondary"
            size="sm"
            loading={pending}
            onClick={() => void send()}
          >
            {t("sendAgain")}
          </Button>
          <Link href="/sign-in" className={authLink}>
            {t("backToSignIn")}
          </Link>
        </div>
      </div>
    );
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!pending) void send();
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <TextField
        id="forgot-email"
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
          setProblem(null);
        }}
        error={problem && t(problem)}
      />
      {error !== null && <ErrorAlert error={error} />}
      <Button type="submit" size="lg" block loading={pending}>
        {t("sendLink")}
      </Button>
      <p className="text-center text-sm">
        <Link href="/sign-in" className={authLink}>
          {t("backToSignIn")}
        </Link>
      </p>
    </form>
  );
}
