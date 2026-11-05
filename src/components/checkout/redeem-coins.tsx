"use client";

import { Coins } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/error-alert";
import { useMyRewards } from "@/features/account/rewards";
import type { Locale } from "@/i18n/routing";
import { api } from "@/lib/api/browser";
import { hasErrorCode } from "@/lib/api/errors";
import type { Bill, BillRewards, RewardsReason } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format/money";
import { compactInput } from "./discount-code";

/**
 * The coins of the checkout page (REWARDS 8), under the discount code and
 * built like it: while the bill allows coins, a box with what the customer
 * has and the most this cart takes, a number field (the most, to begin
 * with), "Redeem" and "Redeem all"; once applied, the coins with what they
 * save and a "Remove" link. While the bill names a reason instead, that
 * reason in a line (nothing for `no_coins`: a customer without coins is
 * not told about them here). Every answer of the API is the full bill and
 * is handed up, so the row and the total change at once. The bill is the
 * API's bill: nothing is computed here.
 */
export function RedeemCoins({
  rewards,
  onBill,
  className,
}: {
  /** `bill.rewards`: `null` for a visitor or a guest, absent on an older API. */
  rewards: BillRewards | null | undefined;
  /** The bill the API answered; replaces the one on the page. */
  onBill: (bill: Bill) => void;
  className?: string;
}) {
  const t = useTranslations("checkout.rewards");
  const locale = useLocale() as Locale;
  /** What was typed; `null` follows the most the bill allows. */
  const [typed, setTyped] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** Why the coins asked for were refused (`400 REWARDS_NOT_APPLICABLE`). */
  const [reason, setReason] = useState<RewardsReason | null>(null);
  /** The typed count is not a whole number from 1 up. */
  const [problem, setProblem] = useState(false);
  /** Anything else that went wrong: the network, the rate limit. */
  const [error, setError] = useState<unknown>(null);
  const offering = !!rewards && !rewards.applied && rewards.maxCoins > 0;
  // The balance for the first sentence; the bill itself has no balance.
  const mine = useMyRewards(offering);

  async function redeem(coins?: number) {
    if (busy) return;
    setBusy(true);
    setReason(null);
    setProblem(false);
    setError(null);
    try {
      onBill(await api.redeemCoins(coins));
      setTyped(null);
    } catch (caught) {
      if (hasErrorCode(caught, "REWARDS_NOT_APPLICABLE")) {
        setReason(caught.details.reason);
      } else {
        setError(caught);
      }
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const count = Number(typed ?? rewards?.maxCoins ?? 0);
    if (!Number.isInteger(count) || count < 1) {
      setProblem(true);
      return;
    }
    // Sent as typed; the API caps it at the most the bill allows.
    void redeem(count);
  }

  async function remove() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      onBill(await api.removeCoins());
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  }

  if (!rewards) return null;

  if (rewards.applied) {
    return (
      <div className={cn("flex flex-col gap-2", className)}>
        <div className="ring-ink/6 flex items-center gap-3 rounded-xl bg-white/80 px-3 py-2.5 ring-1">
          <Coins aria-hidden="true" className="text-leaf-700 size-5 shrink-0" />
          <p className="min-w-0 flex-1 text-[0.8125rem] leading-snug">
            <span className="block text-sm font-bold">
              {t("applied", { coins: rewards.coins })}
            </span>
            <span className="text-leaf-700 block">
              {t("saving", { amount: formatMoney(rewards.amount, locale) })}
            </span>
          </p>
          <button
            type="button"
            onClick={() => void remove()}
            disabled={busy}
            aria-label={t("removeNamed")}
            className="text-leaf-700 disabled:text-ink-subtle min-h-10 shrink-0 rounded-sm px-1 text-sm font-semibold underline underline-offset-4"
          >
            {t("remove")}
          </button>
        </div>
        {error !== null && <ErrorAlert error={error} />}
      </div>
    );
  }

  if (rewards.maxCoins <= 0) {
    // The bill says why not; a customer without coins is not told here.
    if (!rewards.reason || rewards.reason === "no_coins") return null;
    return (
      <p
        className={cn(
          "text-ink-muted flex items-start gap-2.5 text-sm",
          className,
        )}
      >
        <Coins
          aria-hidden="true"
          className="text-ink-subtle mt-0.5 size-5 shrink-0"
        />
        <span>{t(`reason.${rewards.reason}`)}</span>
      </p>
    );
  }

  const value = typed ?? String(rewards.maxCoins);
  const balance = mine.data?.account.available ?? null;
  const errorId = "checkout-coins-error";
  const shownReason = problem
    ? t("invalid")
    : reason
      ? t(`reason.${reason}`)
      : null;
  return (
    <form
      method="post"
      onSubmit={submit}
      noValidate
      className={cn("flex flex-col gap-1.5", className)}
    >
      <label
        htmlFor="checkout-coins"
        className="text-ink-subtle text-xs font-bold tracking-[0.1em] uppercase"
      >
        {t("label")}
      </label>
      <p className="text-sm">
        {balance !== null && (
          <>
            <span className="font-semibold">
              {t("balance", { coins: balance })}
            </span>{" "}
          </>
        )}
        {t("upTo", {
          coins: rewards.maxCoins,
          amount: formatMoney(rewards.maxAmount, locale),
        })}
      </p>
      <div className="flex gap-2">
        <input
          id="checkout-coins"
          type="number"
          inputMode="numeric"
          min={1}
          max={rewards.maxCoins}
          step={1}
          value={value}
          onChange={(event) => {
            setTyped(event.target.value);
            setReason(null);
            setProblem(false);
          }}
          aria-label={t("field")}
          aria-invalid={shownReason ? true : undefined}
          aria-describedby={shownReason ? errorId : undefined}
          className={cn(compactInput, "max-w-32 tabular-nums")}
        />
        <Button
          type="submit"
          variant="secondary"
          size="sm"
          loading={busy}
          className="min-h-10 shrink-0 px-4 text-sm"
        >
          {t("redeem")}
        </Button>
        <button
          type="button"
          onClick={() => void redeem()}
          disabled={busy}
          className="text-leaf-700 disabled:text-ink-subtle min-h-10 rounded-sm px-1 text-sm font-semibold underline underline-offset-4"
        >
          {t("redeemAll")}
        </button>
      </div>
      {shownReason && (
        <p
          id={errorId}
          role="alert"
          className="text-sm font-semibold text-red-800"
        >
          {shownReason}
        </p>
      )}
      {error !== null && <ErrorAlert error={error} />}
    </form>
  );
}
