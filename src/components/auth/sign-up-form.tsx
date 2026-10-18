"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/error-alert";
import { TextField } from "@/components/ui/field";
import { PasswordField } from "@/components/ui/password-field";
import {
  checkEmail,
  checkName,
  checkPassword,
  normalizeEmail,
  problemsOf,
  type EmailProblem,
  type NameProblem,
  type PasswordProblem,
} from "@/features/auth/validation";
import { useSession, useSessionActions } from "@/features/session/session";
import { Link, useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { api } from "@/lib/api/browser";
import { fieldProblems, hasErrorCode } from "@/lib/api/errors";
import {
  DEFAULT_RETURN_TARGET,
  returnHref,
  type ReturnTarget,
} from "@/lib/navigation/return-to";
import { authLink } from "./auth-page";

type Field = "firstName" | "lastName" | "email" | "password";
type Problem =
  | NameProblem
  | EmailProblem
  | PasswordProblem
  | "passwordWeak"
  | "fieldInvalid";
type Problems = Partial<Record<Field, Problem>>;

/**
 * Creating the account (doc 1, `POST /v1/store/auth/signup`): first and
 * last name, email, password. A `201` is a sign-in: the customer goes on
 * to where they came from, and the cart of the visit follows (the cart
 * itself hands it over). An address that has an account already says so
 * at the field, with the ways to sign in and to a new password.
 */
export function SignUpForm({ returnTo }: { returnTo: ReturnTarget }) {
  const t = useTranslations("auth");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const session = useSession();
  const { signedIn } = useSessionActions();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [problems, setProblems] = useState<Problems>({});
  const [emailTaken, setEmailTaken] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);
  const passwordInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (session.status === "customer") router.replace(returnHref(returnTo));
  }, [session.status, router, returnTo]);

  function clear(field: Field) {
    setProblems((rest) => ({ ...rest, [field]: undefined }));
    if (field === "email") setEmailTaken(false);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const found: Problems = problemsOf({
      firstName: checkName(firstName),
      lastName: checkName(lastName),
      email: checkEmail(email),
      password: checkPassword(password),
    });
    setProblems(found);
    setEmailTaken(false);
    setError(null);
    if (Object.values(found).some(Boolean)) return;
    setPending(true);
    try {
      const { customer } = await api.signUp({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: normalizeEmail(email),
        password,
        locale,
      });
      signedIn(customer);
      router.replace(returnHref(returnTo));
    } catch (caught) {
      if (hasErrorCode(caught, "CUSTOMER_EMAIL_TAKEN")) {
        setEmailTaken(true);
      } else if (hasErrorCode(caught, "PASSWORD_TOO_WEAK")) {
        setProblems({ password: "passwordWeak" });
        setPassword("");
        passwordInput.current?.focus();
      } else {
        const fromApi = fieldProblems(caught);
        const fields = (
          ["firstName", "lastName", "email", "password"] as const
        ).filter((field) => field in fromApi);
        if (fields.length > 0) {
          setProblems(
            Object.fromEntries(fields.map((field) => [field, "fieldInvalid"])),
          );
        } else {
          setError(caught);
        }
      }
      setPending(false);
    }
  }

  const signInHref =
    returnTo === DEFAULT_RETURN_TARGET
      ? "/sign-in"
      : { pathname: "/sign-in" as const, query: { returnTo } };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          id="sign-up-first-name"
          label={t("firstName")}
          name="firstName"
          autoComplete="given-name"
          required
          maxLength={80}
          value={firstName}
          onChange={(event) => {
            setFirstName(event.target.value);
            clear("firstName");
          }}
          error={problems.firstName && t(problems.firstName)}
        />
        <TextField
          id="sign-up-last-name"
          label={t("lastName")}
          name="lastName"
          autoComplete="family-name"
          required
          maxLength={80}
          value={lastName}
          onChange={(event) => {
            setLastName(event.target.value);
            clear("lastName");
          }}
          error={problems.lastName && t(problems.lastName)}
        />
      </div>
      <TextField
        id="sign-up-email"
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
          clear("email");
        }}
        error={
          emailTaken ? (
            <>
              {t("emailTaken")}{" "}
              <Link href={signInHref} className={authLink}>
                {t("emailTakenSignIn")}
              </Link>
              {" · "}
              <Link href="/forgot-password" className={authLink}>
                {t("emailTakenForgot")}
              </Link>
            </>
          ) : (
            problems.email && t(problems.email)
          )
        }
      />
      <PasswordField
        id="sign-up-password"
        label={t("password")}
        name="password"
        autoComplete="new-password"
        required
        minLength={8}
        maxLength={128}
        inputRef={passwordInput}
        value={password}
        onChange={(event) => {
          setPassword(event.target.value);
          clear("password");
        }}
        hint={t("passwordHint")}
        error={problems.password && t(problems.password)}
      />
      <p className="text-ink-muted text-sm">
        {t.rich("legalNote", {
          privacy: (chunks) => (
            <Link href="/legal/privacy" className={authLink}>
              {chunks}
            </Link>
          ),
        })}
      </p>
      {error !== null && <ErrorAlert error={error} />}
      <Button type="submit" size="lg" block loading={pending}>
        {t("create")}
      </Button>
      <p className="border-line text-ink-muted border-t pt-5 text-center text-[0.9375rem]">
        {t("haveAccount")}{" "}
        <Link href={signInHref} className={authLink}>
          {t("signIn")}
        </Link>
      </p>
    </form>
  );
}
