"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/error-alert";
import { TextField, controlStyles } from "@/components/ui/field";
import { useSession, useSessionActions } from "@/features/session/session";
import { useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { api } from "@/lib/api/browser";
import { useErrorText } from "@/lib/api/error-text";
import { hasErrorCode } from "@/lib/api/errors";
import { cn } from "@/lib/cn";
import { returnHref, type ReturnTarget } from "@/lib/navigation/return-to";

const emailSchema = z.email().max(254);

/**
 * Signing in without a password (doc 1): the email address, then the
 * 6-digit code from the email. The first sign-in creates the account.
 * A new code can be asked for once the cooldown of the API has passed.
 */
export function SignInForm({ returnTo }: { returnTo: ReturnTarget }) {
  const t = useTranslations("auth");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const session = useSession();
  const { signedIn } = useSessionActions();
  const errorText = useErrorText();

  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [validMinutes, setValidMinutes] = useState(10);
  // The moment (device clock, ms) from which a new code may be asked for.
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(0);
  const codeInput = useRef<HTMLInputElement>(null);

  // Already signed in (or just now): go where the customer wanted to go.
  useEffect(() => {
    if (session.status === "customer") router.replace(returnHref(returnTo));
  }, [session.status, router, returnTo]);

  useEffect(() => {
    if (step !== "code") return;
    codeInput.current?.focus();
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [step]);

  const secondsToResend = Math.max(0, Math.ceil((resendAt - now) / 1000));

  function startCooldown(seconds: number) {
    const start = Date.now();
    setNow(start);
    setResendAt(start + seconds * 1000);
  }

  async function requestCode(resend: boolean) {
    const parsed = emailSchema.safeParse(email.trim().toLowerCase());
    if (!parsed.success) {
      setFieldError(t("emailInvalid"));
      return;
    }
    setPending(true);
    setError(null);
    setFieldError(null);
    setNotice(null);
    try {
      const result = await api.requestOtp({ email: parsed.data, locale });
      setEmail(parsed.data);
      setValidMinutes(Math.round(result.expiresInSeconds / 60));
      startCooldown(result.resendAfterSeconds);
      setCode("");
      setStep("code");
      if (resend) setNotice(t("resent"));
    } catch (caught) {
      if (hasErrorCode(caught, "OTP_COOLDOWN")) {
        // A code was sent a moment ago and is still valid: let it be typed.
        setEmail(parsed.data);
        startCooldown(caught.details.retryAfterSeconds);
        setStep("code");
      } else if (hasErrorCode(caught, "VALIDATION_FAILED")) {
        setFieldError(t("emailInvalid"));
      } else {
        setError(caught);
      }
    } finally {
      setPending(false);
    }
  }

  async function verify(value: string) {
    if (!/^\d{6}$/.test(value)) {
      setFieldError(t("codeInvalid"));
      return;
    }
    setPending(true);
    setError(null);
    setFieldError(null);
    setNotice(null);
    try {
      const { customer } = await api.verifyOtp({ email, code: value, locale });
      // The cart of the visit is handed to the account by the cart itself.
      signedIn(customer);
      router.replace(returnHref(returnTo));
    } catch (caught) {
      if (hasErrorCode(caught, "OTP_INVALID")) {
        // With attempts left: wrong code. Without: the code is used up or expired.
        setFieldError(caught.details ? errorText(caught) : t("codeExpired"));
        setCode("");
        codeInput.current?.focus();
      } else if (hasErrorCode(caught, "VALIDATION_FAILED")) {
        setFieldError(t("codeInvalid"));
      } else {
        setError(caught);
      }
    } finally {
      setPending(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    void (step === "email" ? requestCode(false) : verify(code));
  }

  if (step === "email") {
    return (
      <form onSubmit={submit} noValidate className="flex flex-col gap-5">
        <TextField
          id="sign-in-email"
          label={t("email")}
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={fieldError}
        />
        {error !== null && <ErrorAlert error={error} />}
        <Button type="submit" size="lg" block loading={pending}>
          {t("sendCode")}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <p className="text-ink-muted">
        {t("codeSent", { email, minutes: validMinutes })}
      </p>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="sign-in-code" className="text-sm font-bold">
          {t("code")}
        </label>
        <input
          ref={codeInput}
          id="sign-in-code"
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          required
          value={code}
          aria-invalid={fieldError ? true : undefined}
          aria-describedby={fieldError ? "sign-in-code-error" : undefined}
          onChange={(event) => {
            const digits = event.target.value.replace(/\D/g, "").slice(0, 6);
            setCode(digits);
            setFieldError(null);
            // Six digits typed or pasted: no need to press the button.
            if (digits.length === 6 && !pending) void verify(digits);
          }}
          className={cn(
            controlStyles,
            "min-h-14 text-center text-2xl font-bold tracking-[0.4em] tabular-nums",
          )}
        />
        {fieldError && (
          <p
            id="sign-in-code-error"
            role="alert"
            className="text-sm font-semibold text-red-600"
          >
            {fieldError}
          </p>
        )}
      </div>
      {notice && <Alert tone="good">{notice}</Alert>}
      {error !== null && <ErrorAlert error={error} />}
      <Button type="submit" size="lg" block loading={pending}>
        {t("signIn")}
      </Button>
      <div className="flex flex-col items-center gap-1">
        <Button
          variant="quiet"
          size="sm"
          disabled={pending || secondsToResend > 0}
          onClick={() => void requestCode(true)}
        >
          {secondsToResend > 0
            ? t("resendIn", { seconds: secondsToResend })
            : t("resend")}
        </Button>
        <Button
          variant="quiet"
          size="sm"
          disabled={pending}
          onClick={() => {
            setStep("email");
            setError(null);
            setFieldError(null);
            setNotice(null);
          }}
        >
          {t("changeEmail")}
        </Button>
      </div>
    </form>
  );
}
