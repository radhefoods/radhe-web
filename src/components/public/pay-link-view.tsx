"use client";

import { Check } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/error-alert";
import { isSafePaymentUrl } from "@/features/orders/payment-url";
import type { Locale } from "@/i18n/routing";
import { api } from "@/lib/api/browser";
import { ApiError } from "@/lib/api/errors";
import type { PayLink } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format/dates";
import { formatMoney } from "@/lib/format/money";

/**
 * The page behind the payment link of an email (doc 10.4): the order and
 * the amount, and one button to the payment page. No sign-in: the token in
 * the address is the key, and it pays this one order and nothing else.
 */
export function PayLinkView({
  token,
  payLink,
}: {
  token: string;
  payLink: PayLink;
}) {
  const t = useTranslations("payLink");
  const tPayment = useTranslations("payment");
  const locale = useLocale() as Locale;
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const { payment } = payLink;
  const owing = payment.status === "due" || payment.status === "overdue";
  const overdue = payment.status === "overdue" || payment.isOverdue === true;

  async function payNow() {
    setStarting(true);
    setError(null);
    try {
      const { url } = await api.createPayLinkCheckout(token);
      if (!isSafePaymentUrl(url)) {
        throw new ApiError({
          status: 502,
          code: "PAYMENT_PROVIDER_ERROR",
          message: "The payment page has an address that is not accepted.",
        });
      }
      window.location.assign(url);
    } catch (caught) {
      setError(caught);
      setStarting(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-lg">
        {payLink.firstName
          ? t("greeting", { name: payLink.firstName })
          : t("greetingPlain")}{" "}
        {t("intro", { orderNumber: payLink.orderNumber })}
      </p>

      {owing ? (
        <div
          className={cn(
            "border-line flex flex-col gap-3 rounded-xl border bg-white p-5",
            overdue && "border-red-200 bg-red-50",
          )}
        >
          <p className="flex flex-wrap items-baseline justify-between gap-3">
            <span className="font-bold">{tPayment("amountDue")}</span>
            <span className="text-3xl font-bold tabular-nums">
              {formatMoney(payment.amountDue, locale)}
            </span>
          </p>
          {payment.invoice && (
            <p className="text-ink-muted text-sm">
              {tPayment("invoice", { number: payment.invoice.number })}
            </p>
          )}
          {payment.deadline && (
            <p className={cn(overdue && "font-semibold text-red-800")}>
              {tPayment(overdue ? "wasDue" : "payBy", {
                date: formatDate(payment.deadline, locale),
              })}
            </p>
          )}
          {payment.canPayOnline ? (
            <>
              <Button
                variant="pay"
                size="lg"
                block
                loading={starting}
                onClick={() => void payNow()}
              >
                {tPayment("payNow", {
                  amount: formatMoney(payment.amountDue, locale),
                })}
              </Button>
              <p className="text-ink-muted text-center text-sm">
                {tPayment("payMethods")}
              </p>
            </>
          ) : (
            !payment.cashPossible && (
              <Alert tone="info">{tPayment("noOnline")}</Alert>
            )
          )}
          {payment.cashPossible && (
            <p className="text-[0.9375rem]">{tPayment("cashHint")}</p>
          )}
          {error !== null && <ErrorAlert error={error} />}
        </div>
      ) : payment.status === "paid" ? (
        <p className="flex items-center gap-2 rounded-xl bg-teal-50 p-5 font-bold text-teal-700">
          <Check aria-hidden="true" className="size-5" strokeWidth={3} />
          {t("paid")}
        </p>
      ) : (
        <Alert tone="info">{t("nothingDue")}</Alert>
      )}
    </div>
  );
}
