"use client";

import { useTranslations } from "next-intl";
import { useRef, useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button, buttonStyles } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/error-alert";
import { PasswordField } from "@/components/ui/password-field";
import {
  checkPassword,
  type PasswordProblem,
} from "@/features/auth/validation";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api/browser";
import { fieldProblems, hasErrorCode } from "@/lib/api/errors";

type Problems = {
  password?: PasswordProblem | "passwordWeak" | "fieldInvalid";
  repeat?: "repeatMismatch";
};

/**
 * The page behind the link of the password reset email (doc 1,
 * `POST /v1/store/auth/password/reset`): the new password twice, then the
 * API sets it and ends every session of the customer. The page is public:
 * it works without a session and sends nobody away who is signed in (a
 * customer may reset the password while signed in elsewhere). The token
 * goes into the request body and nowhere else.
 */
export function ResetPasswordForm({ token }: { token: string | null }) {
  const t = useTranslations("auth");
  const [state, setState] = useState<"form" | "done" | "invalid">(
    token ? "form" : "invalid",
  );
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [problems, setProblems] = useState<Problems>({});
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);
  const passwordInput = useRef<HTMLInputElement>(null);

  if (state === "done") {
    return (
      <div className="flex flex-col gap-5">
        <Alert tone="good" title={t("resetDoneTitle")}>
          {t("resetDoneText")}
        </Alert>
        <Link
          href="/sign-in"
          className={buttonStyles({ size: "lg", block: true })}
        >
          {t("signIn")}
        </Link>
      </div>
    );
  }

  if (state === "invalid" || token === null) {
    return (
      <div className="flex flex-col gap-5">
        <Alert tone="warn" title={t("resetInvalidTitle")}>
          {t("resetInvalidText")}
        </Alert>
        <Link
          href="/forgot-password"
          className={buttonStyles({ variant: "secondary", block: true })}
        >
          {t("requestNewLink")}
        </Link>
      </div>
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending || token === null) return;
    const found: Problems = {};
    const problem = checkPassword(password);
    if (problem) found.password = problem;
    // The repetition is a check of this page only; the API sees one password.
    else if (repeat !== password) found.repeat = "repeatMismatch";
    setProblems(found);
    setError(null);
    if (found.password || found.repeat) return;
    setPending(true);
    try {
      await api.resetPassword({ token, password });
      setState("done");
    } catch (caught) {
      const fromApi = fieldProblems(caught);
      if (hasErrorCode(caught, "PASSWORD_RESET_INVALID") || fromApi.token) {
        setState("invalid");
      } else if (hasErrorCode(caught, "PASSWORD_TOO_WEAK")) {
        // The link stays valid: another password, please.
        setProblems({ password: "passwordWeak" });
        setPassword("");
        setRepeat("");
        passwordInput.current?.focus();
      } else if (fromApi.password) {
        setProblems({ password: "fieldInvalid" });
      } else {
        setError(caught);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <PasswordField
        id="reset-password"
        label={t("newPassword")}
        name="password"
        autoComplete="new-password"
        required
        minLength={8}
        maxLength={128}
        autoFocus
        inputRef={passwordInput}
        value={password}
        onChange={(event) => {
          setPassword(event.target.value);
          setProblems({});
        }}
        hint={t("passwordHint")}
        error={problems.password && t(problems.password)}
      />
      <PasswordField
        id="reset-password-repeat"
        label={t("repeatPassword")}
        name="passwordRepeat"
        autoComplete="new-password"
        required
        maxLength={128}
        value={repeat}
        onChange={(event) => {
          setRepeat(event.target.value);
          setProblems((rest) => ({ ...rest, repeat: undefined }));
        }}
        error={problems.repeat && t(problems.repeat)}
      />
      {error !== null && <ErrorAlert error={error} />}
      <Button type="submit" size="lg" block loading={pending}>
        {t("savePassword")}
      </Button>
    </form>
  );
}
