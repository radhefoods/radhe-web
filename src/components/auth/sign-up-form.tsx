"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Alert } from "@/components/ui/alert";
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
import type { ReferralFailReason, SignUpStarted } from "@/lib/api/types";
import {
  DEFAULT_RETURN_TARGET,
  returnHref,
  type ReturnTarget,
} from "@/lib/navigation/return-to";
import {
  checkReferralCode,
  forgetReferralCode,
  isReferralCode,
  normalizeReferralCode,
  REFERRAL_CODE_MAX,
  rememberReferralCode,
} from "@/lib/referral/referral-code";
import { useReferralCode } from "@/lib/referral/use-referral-code";
import { authLink } from "./auth-page";

type Field = "firstName" | "lastName" | "email" | "password" | "referralCode";
type Problem =
  | NameProblem
  | EmailProblem
  | PasswordProblem
  | "passwordWeak"
  | "fieldInvalid"
  | "referralInvalid"
  | "referralUnknown";
type Problems = Partial<Record<Field, Problem>>;

/** Six digits, as the email carries them. */
const CODE = /^\d{6}$/;

/** The seconds until a moment, never below zero. */
function secondsUntil(at: number, now: number): number {
  return Math.max(0, Math.ceil((at - now) / 1000));
}

/** A clock that ticks once a second until a moment, then stops by itself. */
function useNow(until: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => {
      const next = Date.now();
      setNow(next);
      if (next >= until) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [until]);
  return now;
}

/**
 * The code step of the sign-up (doc 1): the six digits from the email,
 * "Resend code" (disabled for `resendAfterSeconds` after every email) and
 * "Start again". A wrong code says how many tries are left; a sign-up
 * that expired or was used up goes back to the form.
 */
function CodeStep({
  started,
  onVerified,
  onStartAgain,
  onExpired,
}: {
  started: SignUpStarted;
  onVerified: (
    referral: { applied: boolean; reason: ReferralFailReason | null },
    customer: Parameters<ReturnType<typeof useSessionActions>["signedIn"]>[0],
  ) => void;
  onStartAgain: () => void;
  /** `SIGNUP_NOT_FOUND`: the code expired or the attempts are used up. */
  onExpired: () => void;
}) {
  const t = useTranslations("auth");
  const [code, setCode] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  // When a code may be asked for again: a minute after the last email.
  const [resendAt, setResendAt] = useState(
    () => Date.now() + started.resendAfterSeconds * 1000,
  );
  const now = useNow(resendAt);
  const wait = secondsUntil(resendAt, now);
  const { signedIn } = useSessionActions();
  const focusCode = () => document.getElementById("sign-up-code")?.focus();

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const typed = code.replace(/\s+/g, "");
    if (!CODE.test(typed)) {
      setProblem(t("codeInvalid"));
      focusCode();
      return;
    }
    setPending(true);
    setProblem(null);
    setError(null);
    try {
      const result = await api.signUpVerify({
        email: started.email,
        code: typed,
      });
      signedIn(result.customer);
      forgetReferralCode();
      onVerified(result.referral, result.customer);
    } catch (caught) {
      setPending(false);
      if (hasErrorCode(caught, "SIGNUP_CODE_INVALID")) {
        setProblem(
          t("codeWrong", { attemptsLeft: caught.details.attemptsLeft }),
        );
        setCode("");
        focusCode();
      } else if (hasErrorCode(caught, "SIGNUP_NOT_FOUND")) {
        onExpired();
      } else {
        setError(caught);
      }
    }
  }

  async function resend() {
    if (resending || wait > 0) return;
    setResending(true);
    setResent(false);
    setError(null);
    try {
      await api.signUpResend({ email: started.email });
      setResent(true);
      setResendAt(Date.now() + started.resendAfterSeconds * 1000);
    } catch (caught) {
      setError(caught);
    } finally {
      setResending(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <p className="text-ink-muted">
        {t("codeIntro", {
          email: started.email,
          minutes: started.validMinutes,
        })}
      </p>
      <TextField
        id="sign-up-code"
        label={t("code")}
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={6}
        required
        autoFocus
        value={code}
        onChange={(event) => {
          setCode(event.target.value.replace(/\D/g, "").slice(0, 6));
          setProblem(null);
        }}
        hint={t("codeHint")}
        error={problem}
        className="max-w-48"
        // Wide digits: six of them are read at a glance.
        style={{ letterSpacing: "0.35em", fontVariantNumeric: "tabular-nums" }}
      />
      {resent && (
        <p role="status" className="text-leaf-700 text-sm font-semibold">
          {t("resent")}
        </p>
      )}
      {error !== null && <ErrorAlert error={error} />}
      <Button type="submit" size="lg" block loading={pending}>
        {t("confirmCode")}
      </Button>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="quiet"
          size="sm"
          disabled={wait > 0}
          loading={resending}
          onClick={() => void resend()}
        >
          {wait > 0 ? t("resendIn", { seconds: wait }) : t("resend")}
        </Button>
        <Button variant="quiet" size="sm" onClick={onStartAgain}>
          {t("startAgain")}
        </Button>
      </div>
    </form>
  );
}

/**
 * What the API said of a referral code before the account exists (doc 21):
 * who invites with it, that nobody does, or that it could not be asked
 * (busy, offline), in which case the sign-up sends the code all the same
 * and the verify answer decides.
 */
type CodeCheck =
  | { kind: "checking" }
  | { kind: "known"; firstName: string | null }
  | { kind: "unknown" }
  | { kind: "unavailable" };

/** How long typing may pause before a code of full length is looked up. */
const LOOKUP_DELAY_MS = 500;

/** What became of the referral code once the account was made (doc 21). */
type ReferralOutcome = {
  code: string;
  applied: boolean;
  reason: ReferralFailReason | null;
};

/**
 * Creating the account (doc 1): first and last name, email, password; then
 * the code from the email, which makes the account and signs it in. The
 * customer goes on to where they came from, and the cart of the visit
 * follows (the cart itself hands it over). An address that has an account
 * already says so at the field, with the ways to sign in and to a new
 * password.
 *
 * The referral code (doc 21): the code of the invitation link (`?ref=` on
 * this page, or kept from an earlier visit) fills an optional "Referral
 * code" field, which can be changed; without one the field waits behind
 * "Have a referral code?". A code of full
 * length is looked up once typing pauses, or when the field is left (never
 * on every keystroke: 10 lookups a minute per address): the person who
 * invites is named under the field, an unknown code is refused at once.
 * The code travels with the sign-up, the API applies it once the emailed
 * code was right, and the answer says whether it counted for this person:
 * a line says so, or why not, before going on.
 */
export function SignUpForm({
  returnTo,
  linkCode = null,
}: {
  returnTo: ReturnTarget;
  /** The `ref` of this page's address, already checked. */
  linkCode?: string | null;
}) {
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
  /** The code step, once the API emailed one; `done` while the referral line shows. */
  const [step, setStep] = useState<
    | { kind: "form"; expired?: boolean }
    | { kind: "code"; started: SignUpStarted; referralCode: string | null }
    | { kind: "done"; referral: ReferralOutcome }
  >({ kind: "form" });

  // The referral code: the link of this page first, then the one kept from
  // an earlier link (browser only, so it appears once the page is live),
  // and what the customer typed over either.
  const keptCode = useReferralCode();
  const knownCode = linkCode ?? keptCode;
  const [typedCode, setTypedCode] = useState<string | null>(null);
  const referralCode = typedCode ?? knownCode ?? "";
  const [codeFieldOpen, setCodeFieldOpen] = useState(false);
  const showCodeField = codeFieldOpen || knownCode !== null;
  // Whether the field still shows the code of the link, untouched.
  const fromLink = knownCode !== null && typedCode === null;
  const referralInput = useRef<HTMLInputElement>(null);
  const normalizedCode = normalizeReferralCode(referralCode);

  useEffect(() => {
    // A link opened on this very page is kept like a link to any page.
    if (linkCode) rememberReferralCode(linkCode);
  }, [linkCode]);

  // What the API said of each code typed so far, so that no code is asked
  // about twice: `results` for the callbacks, `checks` its copy for the page.
  const results = useRef(new Map<string, CodeCheck>());
  const lookups = useRef(new Map<string, Promise<CodeCheck>>());
  const [checks, setChecks] = useState<ReadonlyMap<string, CodeCheck>>(
    () => new Map(),
  );
  const lookUp = useCallback((code: string): Promise<CodeCheck> => {
    const running = lookups.current.get(code);
    if (running) return running;
    const before = results.current.get(code);
    if (before && before.kind !== "unavailable") return Promise.resolve(before);
    const remember = (result: CodeCheck) => {
      results.current.set(code, result);
      setChecks(new Map(results.current));
    };
    remember({ kind: "checking" });
    const lookup = api
      .checkReferralCode(code)
      .then((answer): CodeCheck => ({
        kind: "known",
        firstName: answer.inviter.firstName,
      }))
      .catch((caught): CodeCheck =>
        hasErrorCode(caught, "REFERRAL_CODE_UNKNOWN")
          ? { kind: "unknown" }
          : { kind: "unavailable" },
      )
      .then((result) => {
        lookups.current.delete(code);
        remember(result);
        return result;
      });
    lookups.current.set(code, lookup);
    return lookup;
  }, []);
  const check = isReferralCode(normalizedCode)
    ? checks.get(normalizedCode)
    : undefined;

  useEffect(() => {
    // A code of full length is looked up once typing pauses. An answer the
    // API could not give is asked for again only on leaving the field or
    // on submitting, not in a loop.
    if (!isReferralCode(normalizedCode)) return;
    const before = results.current.get(normalizedCode);
    if (before && before.kind !== "unavailable") return;
    const timer = window.setTimeout(
      () => void lookUp(normalizedCode),
      LOOKUP_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [normalizedCode, lookUp]);

  useEffect(() => {
    if (session.status === "customer" && step.kind !== "done") {
      router.replace(returnHref(returnTo));
    }
  }, [session.status, router, returnTo, step.kind]);

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
      referralCode: checkReferralCode(referralCode),
    });
    setProblems(found);
    setEmailTaken(false);
    setError(null);
    if (Object.values(found).some(Boolean)) {
      if (found.referralCode) referralInput.current?.focus();
      return;
    }
    const code = normalizedCode || null;
    setPending(true);
    if (code) {
      // An unknown code is refused here; one the API could not check goes
      // with the sign-up, and the verify answer says what became of it.
      if ((await lookUp(code)).kind === "unknown") {
        setPending(false);
        setProblems({ referralCode: "referralUnknown" });
        referralInput.current?.focus();
        return;
      }
      // Kept until the account exists: a page reloaded during the code
      // step, or a sign-up started again, still knows the code.
      rememberReferralCode(code);
    }
    try {
      const result = await api.signUp({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: normalizeEmail(email),
        password,
        locale,
        ...(code && { referralCode: code }),
      });
      if ("customer" in result) {
        // An API older than 2026-11-01 made the account at once.
        signedIn(result.customer);
        forgetReferralCode();
        router.replace(returnHref(returnTo));
        return;
      }
      setPending(false);
      setStep({ kind: "code", started: result, referralCode: code });
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
          [
            "firstName",
            "lastName",
            "email",
            "password",
            "referralCode",
          ] as const
        ).filter((field) => field in fromApi);
        if (fields.length > 0) {
          setProblems(
            Object.fromEntries(
              fields.map((field) => [
                field,
                field === "referralCode" ? "referralInvalid" : "fieldInvalid",
              ]),
            ),
          );
          if (fields.includes("referralCode")) referralInput.current?.focus();
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

  if (step.kind === "code") {
    const sentCode = step.referralCode;
    return (
      <CodeStep
        started={step.started}
        onVerified={(referral) => {
          // Without a code there is nothing to say: straight on.
          if (sentCode === null) router.replace(returnHref(returnTo));
          else
            setStep({
              kind: "done",
              referral: { code: sentCode, ...referral },
            });
        }}
        onStartAgain={() => setStep({ kind: "form" })}
        onExpired={() => setStep({ kind: "form", expired: true })}
      />
    );
  }

  if (step.kind === "done") {
    const { referral } = step;
    return (
      <div className="flex flex-col gap-5">
        {referral.applied ? (
          <Alert tone="good" title={t("doneTitle")}>
            {t("referralApplied")}
          </Alert>
        ) : (
          <Alert tone="info" title={t("doneTitle")}>
            {t(`referralNotApplied.${referral.reason ?? "other"}`, {
              code: referral.code,
            })}
          </Alert>
        )}
        <Button
          size="lg"
          block
          onClick={() => router.replace(returnHref(returnTo))}
        >
          {t("continue")}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      {step.expired && <Alert tone="warn">{t("codeExpired")}</Alert>}
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
      {showCodeField ? (
        <TextField
          id="sign-up-referral"
          label={t("referralCode")}
          name="referralCode"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={REFERRAL_CODE_MAX}
          inputRef={referralInput}
          autoFocus={codeFieldOpen && knownCode === null}
          value={referralCode}
          onChange={(event) => {
            setTypedCode(event.target.value.toUpperCase().replace(/\s+/g, ""));
            clear("referralCode");
          }}
          onBlur={() => {
            if (isReferralCode(normalizedCode)) void lookUp(normalizedCode);
          }}
          hint={
            check?.kind === "checking" ? (
              t("referralChecking")
            ) : check?.kind === "known" ? (
              <span className="text-leaf-700 font-semibold">
                {check.firstName
                  ? t("referralInviter", { name: check.firstName })
                  : t("referralValid")}
              </span>
            ) : fromLink ? (
              t("referralFromLink")
            ) : (
              t("referralHint")
            )
          }
          error={
            problems.referralCode
              ? t(problems.referralCode)
              : check?.kind === "unknown"
                ? t("referralUnknown")
                : undefined
          }
          className="sm:max-w-72"
          style={{
            letterSpacing: "0.08em",
            fontVariantNumeric: "tabular-nums",
          }}
        />
      ) : (
        <div className="-mt-1">
          <button
            type="button"
            onClick={() => setCodeFieldOpen(true)}
            className={authLink}
          >
            {t("referralHaveCode")}
          </button>
        </div>
      )}
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
      <p className="border-ink/8 text-ink-muted border-t pt-5 text-center text-[0.9375rem]">
        {t("haveAccount")}{" "}
        <Link href={signInHref} className={authLink}>
          {t("signIn")}
        </Link>
      </p>
    </form>
  );
}
