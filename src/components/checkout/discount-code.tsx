"use client";

import { TicketPercent } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/error-alert";
import { controlStyles } from "@/components/ui/field";
import type { Locale } from "@/i18n/routing";
import { api } from "@/lib/api/browser";
import { hasErrorCode } from "@/lib/api/errors";
import type { Bill, BillDiscount, DiscountReason } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format/money";

/**
 * The discount code of the checkout page (doc 9.6): a field with "Apply"
 * while no code is kept with the cart; the code with what it saves and a
 * "Remove" link once one is. Every answer of the API is the full bill and is
 * handed up, so the page shows the discount row and the new total at once.
 * One code per order. A code that was applied and stopped applying (the
 * cart shrank below its minimum, the code ran out) is shown with its reason
 * until it is removed; the checkout refuses it anyway.
 */
export function DiscountCode({
  discount,
  onBill,
  className,
}: {
  /** `bill.discount`: the code kept with the cart, or `null`. */
  discount: BillDiscount | null;
  /** The bill the API answered; replaces the one on the page. */
  onBill: (bill: Bill) => void;
  className?: string;
}) {
  const t = useTranslations("checkout.discount");
  const locale = useLocale() as Locale;
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  /** Why the typed code was refused (`400 DISCOUNT_NOT_APPLICABLE`). */
  const [reason, setReason] = useState<DiscountReason | null>(null);
  /** Anything else that went wrong: the network, the rate limit. */
  const [error, setError] = useState<unknown>(null);

  async function apply(event: FormEvent) {
    event.preventDefault();
    const typed = code.trim();
    if (!typed || busy) return;
    setBusy(true);
    setReason(null);
    setError(null);
    try {
      // Sent as typed; the API upper-cases it.
      onBill(await api.applyDiscount(typed));
      setCode("");
    } catch (caught) {
      if (hasErrorCode(caught, "DISCOUNT_NOT_APPLICABLE")) {
        setReason(caught.details.reason);
      } else {
        setError(caught);
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      onBill(await api.removeDiscount());
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  }

  if (discount) {
    const applied = discount.applied;
    return (
      <div className={cn("flex flex-col gap-2", className)}>
        <div className="border-line flex items-center gap-3 rounded-lg border bg-white px-3.5 py-3">
          <TicketPercent
            aria-hidden="true"
            className={cn(
              "size-5 shrink-0",
              applied ? "text-leaf-700" : "text-wheat-800",
            )}
          />
          <p className="min-w-0 flex-1 text-sm leading-snug">
            <span className="block text-[0.9375rem] font-bold">
              {t(applied ? "applied" : "notApplied", { code: discount.code })}
            </span>
            <span
              className={cn(
                "block",
                applied ? "text-leaf-700" : "text-wheat-800 font-semibold",
              )}
            >
              {applied
                ? t("saving", { amount: formatMoney(discount.amount, locale) })
                : t(`reason.${discount.reason ?? "not_found"}`)}
            </span>
          </p>
          <button
            type="button"
            onClick={() => void remove()}
            disabled={busy}
            aria-label={t("removeNamed", { code: discount.code })}
            className="text-leaf-700 disabled:text-ink-subtle min-h-11 shrink-0 rounded-sm px-1 text-sm font-semibold underline underline-offset-4"
          >
            {t("remove")}
          </button>
        </div>
        {error !== null && <ErrorAlert error={error} />}
      </div>
    );
  }

  const errorId = "checkout-discount-error";
  return (
    <form
      onSubmit={(event) => void apply(event)}
      noValidate
      className={cn("flex flex-col gap-1.5", className)}
    >
      <label htmlFor="checkout-discount" className="text-sm font-semibold">
        {t("label")}
      </label>
      <div className="flex gap-2">
        <input
          id="checkout-discount"
          value={code}
          onChange={(event) => {
            setCode(event.target.value);
            setReason(null);
          }}
          maxLength={40}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          aria-invalid={reason ? true : undefined}
          aria-describedby={reason ? errorId : undefined}
          // Shown in capitals like the code is stored; sent as typed.
          className={cn(controlStyles, "min-w-0 flex-1 uppercase")}
        />
        <Button
          type="submit"
          variant="secondary"
          loading={busy}
          disabled={code.trim() === ""}
          className="shrink-0"
        >
          {t("apply")}
        </Button>
      </div>
      {reason && (
        <p
          id={errorId}
          role="alert"
          className="text-sm font-semibold text-red-800"
        >
          {t(`reason.${reason}`)}
        </p>
      )}
      {error !== null && <ErrorAlert error={error} />}
    </form>
  );
}
