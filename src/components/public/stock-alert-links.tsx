"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { Button, buttonStyles } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/error-alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api/browser";
import { hasErrorCode } from "@/lib/api/errors";
import type {
  StockAlertConfirmed,
  StockAlertUnsubscribed,
} from "@/lib/api/types";

// The two pages behind the links of the back-in-stock emails (doc 26). No
// sign-in: the token of the link is the key. What the API tells about the
// request is little on purpose (the pack size by its id, the address with
// most of it hidden), so the pages name no product.

/**
 * A link the API does not accept: its token is not genuine, its request
 * was never confirmed and is gone, or the token is not even one (cut short
 * on its way: the API refuses it as invalid data).
 */
function isInvalidLink(error: unknown): boolean {
  return (
    hasErrorCode(error, "STOCK_ALERT_TOKEN_INVALID") ||
    hasErrorCode(error, "VALIDATION_FAILED")
  );
}

/** The way on from every state of the two pages. */
function ToShop() {
  const t = useTranslations("stockAlertLinks");
  return (
    <Link
      href="/products"
      className={buttonStyles({ variant: "secondary", className: "self-start" })}
    >
      {t("toShop")}
    </Link>
  );
}

/** The link is not genuine, or its request was never confirmed and is gone. */
function InvalidLink() {
  const t = useTranslations("stockAlertLinks");
  return (
    <div className="flex flex-col gap-4">
      <Alert tone="warn" title={t("invalidTitle")}>
        {t("invalidText")}
      </Alert>
      <ToShop />
    </div>
  );
}

/**
 * Takes requests back with a token, for both pages: the request of the
 * link, or with `all` every request of the same address that still waits.
 */
function useUnsubscribe(token: string | null) {
  const [busy, setBusy] = useState<"one" | "all" | null>(null);
  const [result, setResult] = useState<StockAlertUnsubscribed | null>(null);
  /** Which call answered last: the second button reads differently. */
  const [took, setTook] = useState<"one" | "all" | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function unsubscribe(all: boolean) {
    if (!token || busy) return;
    setBusy(all ? "all" : "one");
    setError(null);
    try {
      // The token is passed through exactly as it came.
      setResult(await api.unsubscribeStockAlert(token, all));
      setTook(all ? "all" : "one");
    } catch (caught) {
      if (isInvalidLink(caught)) setInvalid(true);
      else setError(caught);
    } finally {
      setBusy(null);
    }
  }
  return { busy, result, took, invalid, error, unsubscribe };
}

/**
 * What follows a request that was taken back: that no email comes, and,
 * while the address still waits for other pack sizes, the button that
 * takes those back too.
 */
function Unsubscribed({
  state,
  children,
}: {
  state: ReturnType<typeof useUnsubscribe>;
  children?: ReactNode;
}) {
  const t = useTranslations("stockAlertLinks");
  const { result, took, busy, error, unsubscribe } = state;
  if (!result) return null;
  return (
    <div className="flex flex-col gap-4">
      <Alert tone="good" title={t("cancelledTitle")}>
        {took === "all" ? t("allCancelled") : t("cancelledText")}
      </Alert>
      {result.waiting > 0 && (
        <>
          <p className="text-ink-muted">
            {t("othersWaiting", { count: result.waiting })}
          </p>
          <Button
            variant="secondary"
            className="self-start"
            loading={busy === "all"}
            onClick={() => void unsubscribe(true)}
          >
            {t("cancelAll", { count: result.waiting })}
          </Button>
        </>
      )}
      {error !== null && <ErrorAlert error={error} />}
      {children}
      <ToShop />
    </div>
  );
}

/**
 * `/stock-alerts/confirm?token=…`, the page behind the link of the
 * confirmation email. The address is confirmed once, by the browser after
 * the page has loaded and never while the server renders it: a page that
 * is fetched ahead or rendered twice must not count as the customer's
 * click. Using the link again changes nothing, so a program that opens it
 * first does no harm either. The answer carries the token that takes the
 * request back, for "Cancel this notification".
 */
export function StockAlertConfirmView({ token }: { token: string | null }) {
  const t = useTranslations("stockAlertLinks");
  const [confirmed, setConfirmed] = useState<StockAlertConfirmed | null>(null);
  const [invalid, setInvalid] = useState(token === null);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  const cancelling = useUnsubscribe(confirmed?.unsubscribeToken ?? null);

  // One call per try, also where React runs an effect twice (development).
  const call = useRef<{
    key: string;
    answer: Promise<StockAlertConfirmed>;
  } | null>(null);
  useEffect(() => {
    if (!token) return;
    const key = `${attempt}:${token}`;
    if (call.current?.key !== key) {
      // The token is passed through exactly as it came.
      call.current = { key, answer: api.confirmStockAlert(token) };
    }
    let current = true;
    call.current.answer
      .then((result) => {
        if (current) setConfirmed(result);
      })
      .catch((caught: unknown) => {
        if (!current) return;
        if (isInvalidLink(caught)) setInvalid(true);
        else setError(caught);
      });
    return () => {
      current = false;
    };
  }, [token, attempt]);

  if (invalid || cancelling.invalid) return <InvalidLink />;
  if (cancelling.result) return <Unsubscribed state={cancelling} />;

  if (error !== null) {
    return (
      <ErrorAlert
        error={error}
        onRetry={() => {
          setError(null);
          setAttempt((count) => count + 1);
        }}
      />
    );
  }

  if (!confirmed) {
    return (
      <div className="flex flex-col gap-4" role="status">
        <p className="text-lg">{t("confirming")}</p>
        <Skeleton className="h-20 rounded-lg" />
      </div>
    );
  }

  const { status, email } = confirmed.alert;
  // The email went out before the link was used, or the request has ended.
  if (status !== "active" && status !== "unconfirmed") {
    return (
      <div className="flex flex-col gap-4">
        <Alert
          tone="info"
          title={status === "notified" ? t("notifiedTitle") : t("closedTitle")}
        >
          {status === "notified" ? t("notifiedText") : t("closedText")}
        </Alert>
        <ToShop />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Alert tone="good" title={t("confirmedTitle")}>
        {t("confirmedText", { email })}
      </Alert>
      {cancelling.error !== null && <ErrorAlert error={cancelling.error} />}
      <div className="flex flex-wrap items-center gap-3">
        <ToShop />
        <Button
          variant="quiet"
          loading={cancelling.busy === "one"}
          onClick={() => void cancelling.unsubscribe(false)}
        >
          {t("cancelThis")}
        </Button>
      </div>
    </div>
  );
}

/**
 * `/stock-alerts/unsubscribe?token=…`, the page behind the unsubscribe
 * link of the email that says a pack size is back. Nothing is called
 * before the button is pressed: mail programs and security scanners open
 * the links of an email on their own, and nobody should lose their
 * notification that way.
 */
export function StockAlertUnsubscribeView({ token }: { token: string | null }) {
  const t = useTranslations("stockAlertLinks");
  const state = useUnsubscribe(token);

  if (!token || state.invalid) return <InvalidLink />;
  if (state.result) return <Unsubscribed state={state} />;

  return (
    <div className="flex flex-col gap-5">
      <p className="text-lg">{t("unsubscribeText")}</p>
      {state.error !== null && <ErrorAlert error={state.error} />}
      <Button
        size="lg"
        className="self-start"
        loading={state.busy === "one"}
        onClick={() => void state.unsubscribe(false)}
      >
        {t("unsubscribe")}
      </Button>
    </div>
  );
}
