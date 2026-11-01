"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/error-alert";
import { controlStyles } from "@/components/ui/field";
import { orderQueryKey } from "@/features/orders/orders";
import type { Locale } from "@/i18n/routing";
import { api } from "@/lib/api/browser";
import { hasErrorCode } from "@/lib/api/errors";
import type { OrderDetail, OrderFeedback as Feedback } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { StarPicker } from "./star-picker";

/**
 * "How was it?" on a delivered order (doc 22): the stars for the order,
 * the stars for the delivery, a comment, once per order; afterwards the
 * line with what was given. Only Radhe Foods sees it.
 */
export function OrderFeedback({
  order,
  className,
}: {
  order: OrderDetail;
  className?: string;
}) {
  const t = useTranslations("reviews");
  const locale = useLocale() as Locale;
  const client = useQueryClient();
  const [rating, setRating] = useState<number | null>(null);
  const [delivery, setDelivery] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [given, setGiven] = useState<Feedback | null>(order.feedback ?? null);
  const [thanked, setThanked] = useState(false);

  if (!given && !order.canGiveFeedback) return null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (rating === null) {
      setProblem(t("ratingMissing"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { feedback } = await api.giveOrderFeedback(order.orderNumber, {
        rating,
        ...(delivery !== null && { deliveryRating: delivery }),
        ...(comment.trim() && { comment: comment.trim() }),
      });
      setGiven(feedback);
      setThanked(true);
      client.setQueryData(orderQueryKey(order.orderNumber, locale), {
        ...order,
        feedback,
        canGiveFeedback: false,
      });
    } catch (caught) {
      if (hasErrorCode(caught, "FEEDBACK_ALREADY_GIVEN")) {
        void client.invalidateQueries({
          queryKey: orderQueryKey(order.orderNumber, locale),
        });
      }
      setError(caught);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-labelledby="order-feedback"
      className={cn("flex flex-col gap-3", className)}
    >
      <h2 id="order-feedback" className="font-display text-ink text-xl">
        {t("feedbackTitle")}
      </h2>
      {given ? (
        <>
          {thanked && <Alert tone="good">{t("feedbackThanks")}</Alert>}
          <p className="text-[0.9375rem]">
            {t("feedbackGiven", { rating: given.rating })}
            {given.deliveryRating !== null && (
              <>
                {" "}
                {t("feedbackGivenDelivery", { rating: given.deliveryRating })}
              </>
            )}
          </p>
          {given.comment && (
            <p className="text-ink-muted text-[0.9375rem] whitespace-pre-line">
              {given.comment}
            </p>
          )}
        </>
      ) : (
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <p className="text-ink-muted text-[0.9375rem]">
            {t("feedbackIntro")}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <StarPicker
              name="feedback-rating"
              legend={t("feedbackOrder")}
              value={rating}
              onChange={(value) => {
                setRating(value);
                setProblem(null);
              }}
              labelOf={(value) => t("stars", { count: value })}
              error={problem}
            />
            <StarPicker
              name="feedback-delivery"
              legend={t("feedbackDelivery")}
              value={delivery}
              onChange={setDelivery}
              labelOf={(value) => t("stars", { count: value })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="feedback-comment" className="text-sm font-semibold">
              {t("feedbackComment")}
            </label>
            <textarea
              id="feedback-comment"
              rows={3}
              maxLength={1000}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              className={cn(controlStyles, "py-3")}
            />
          </div>
          {error !== null && <ErrorAlert error={error} />}
          <Button type="submit" className="self-start" loading={busy}>
            {t("feedbackSend")}
          </Button>
        </form>
      )}
    </section>
  );
}
