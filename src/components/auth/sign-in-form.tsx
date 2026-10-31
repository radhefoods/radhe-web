"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/error-alert";
import { TextField } from "@/components/ui/field";
import { PasswordField } from "@/components/ui/password-field";
import {
  checkEmail,
  checkPasswordPresent,
  normalizeEmail,
  problemsOf,
  type EmailProblem,
  type PasswordProblem,
} from "@/features/auth/validation";
import { useSession, useSessionActions } from "@/features/session/session";
import { Link, useRouter } from "@/i18n/navigation";
import { api } from "@/lib/api/browser";
import { fieldProblems } from "@/lib/api/errors";
import {
  DEFAULT_RETURN_TARGET,
  returnHref,
  type ReturnTarget,
} from "@/lib/navigation/return-to";
import { authLink } from "./auth-page";

type Problems = Partial<
  Record<"email" | "password", EmailProblem | PasswordProblem>
>;

/**
 * Signing in with email and password (doc 1, `POST /v1/store/auth/login`).
 * A wrong password and an unknown address get the same one message, on
 * purpose: nothing here says whether an address has an account. The ways
 * to the other two pages, "Forgot password?" and "Create an account", keep
 * the page the customer wanted to reach.
 */
export function SignInForm({ returnTo }: { returnTo: ReturnTarget }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const session = useSession();
  const { signedIn } = useSessionActions();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [problems, setProblems] = useState<Problems>({});
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);
  const passwordInput = useRef<HTMLInputElement>(null);

  // Already signed in (or just now): go where the customer wanted to go.
  useEffect(() => {
    if (session.status === "customer") router.replace(returnHref(returnTo));
  }, [session.status, router, returnTo]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const found = problemsOf({
      email: checkEmail(email),
      password: checkPasswordPresent(password),
    });
    setProblems(found);
    setError(null);
    if (found.email || found.password) return;
    setPending(true);
    try {
      const { customer } = await api.login({
        email: normalizeEmail(email),
        password,
      });
      // The cart of the visit is handed to the account by the cart itself.
      signedIn(customer);
      router.replace(returnHref(returnTo));
    } catch (caught) {
      const fromApi = fieldProblems(caught);
      if (fromApi.email || fromApi.password) {
        setProblems({
          ...(fromApi.email && { email: "emailInvalid" }),
          ...(fromApi.password && { password: "passwordRequired" }),
        });
      } else {
        // One message under the form; the email stays, the password is
        // typed again.
        setError(caught);
      }
      setPassword("");
      passwordInput.current?.focus();
      setPending(false);
    }
  }

  const signUpHref =
    returnTo === DEFAULT_RETURN_TARGET
      ? "/sign-up"
      : { pathname: "/sign-up" as const, query: { returnTo } };

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
        onChange={(event) => {
          setEmail(event.target.value);
          setProblems((rest) => ({ ...rest, email: undefined }));
        }}
        error={problems.email && t(problems.email)}
      />
      <PasswordField
        id="sign-in-password"
        label={t("password")}
        name="password"
        autoComplete="current-password"
        required
        inputRef={passwordInput}
        value={password}
        onChange={(event) => {
          setPassword(event.target.value);
          setProblems((rest) => ({ ...rest, password: undefined }));
        }}
        error={problems.password && t(problems.password)}
      />
      {error !== null && <ErrorAlert error={error} />}
      <Button type="submit" size="lg" block loading={pending}>
        {t("signIn")}
      </Button>
      <p className="text-center text-sm">
        <Link href="/forgot-password" className={authLink}>
          {t("forgot")}
        </Link>
      </p>
      <p className="border-ink/8 text-ink-muted border-t pt-5 text-center text-[0.9375rem]">
        {t("noAccount")}{" "}
        <Link href={signUpHref} className={authLink}>
          {t("createAccount")}
        </Link>
      </p>
    </form>
  );
}
