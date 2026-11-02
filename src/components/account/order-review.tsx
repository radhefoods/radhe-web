"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { RatingStars } from "@/components/reviews/rating-stars";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { ErrorAlert } from "@/components/ui/error-alert";
import { controlStyles } from "@/components/ui/field";
import {
  MY_REVIEWS_QUERY_KEY,
  REVIEWABLE_QUERY_KEY,
  REVIEW_STATUS_TONE,
  REVIEW_TEXT_MAX,
  REVIEW_TEXT_MIN,
  orderReviewQueryKey,
} from "@/features/reviews/reviews";
import type { Locale } from "@/i18n/routing";
import { api } from "@/lib/api/browser";
import { fieldProblems, hasErrorCode } from "@/lib/api/errors";
import type { MyReview, OrderDetail, OrderReviewState } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format/dates";
import { StarPicker } from "./star-picker";

/**
 * The review of a delivered order (ORDER_REVIEWS 4), read with the order:
 * the form while the API says one can be written ("Your order" with five
 * stars, "Tell us about your experience" with its count), and afterwards
 * the review with its status (waiting for approval, published, not
 * published with the note) and the answer of Radhe Foods. Written once:
 * nothing to edit or delete. Nothing on an API without the route.
 */
export function OrderReview({
  order,
  className,
}: {
  order: OrderDetail;
  className?: string;
}) {
  const t = useTranslations("reviews");
  const locale = useLocale() as Locale;
  const client = useQueryClient();
  const key = orderReviewQueryKey(order.orderNumber, locale);
  const query = useQuery({
    queryKey: key,
    queryFn: () => api.getOrderReview(order.orderNumber),
    staleTime: 0,
    retry: (failures, error) =>
      failures < 2 && !hasErrorCode(error, "NOT_FOUND"),
  });
  const [thanked, setThanked] = useState(false);
  const state = query.data;
  if (!state || (!state.review && !state.canReview)) return null;

  function store(review: MyReview) {
    const next: OrderReviewState = { review, canReview: false };
    client.setQueryData(key, next);
    void client.invalidateQueries({ queryKey: MY_REVIEWS_QUERY_KEY });
    void client.invalidateQueries({ queryKey: REVIEWABLE_QUERY_KEY });
  }

  return (
    <section
      aria-labelledby="order-review"
      className={cn("flex flex-col gap-3", className)}
    >
      <h2 id="order-review" className="font-display text-ink text-xl">
        {t("sectionTitle")}
      </h2>
      {state.review ? (
        <>
          {thanked && <Alert tone="good">{t("thanks")}</Alert>}
          <WrittenReview review={state.review} locale={locale} />
        </>
      ) : (
        <ReviewForm
          orderNumber={order.orderNumber}
          onWritten={(review) => {
            setThanked(true);
            store(review);
          }}
          onAlreadyWritten={() => void query.refetch()}
        />
      )}
    </section>
  );
}

/** The review as written: the stars, the words, the date, the status, the note, the answer. */
function WrittenReview({
  review,
  locale,
}: {
  review: MyReview;
  locale: Locale;
}) {
  const t = useTranslations("reviews");
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <RatingStars
          average={review.rating}
          label={t("stars", { count: review.rating })}
          size="md"
        />
        <Chip tone={REVIEW_STATUS_TONE[review.status]}>
          {t(`status.${review.status}`)}
        </Chip>
      </div>
      <p className="text-[0.9375rem] whitespace-pre-line">{review.text}</p>
      <p className="text-ink-muted text-sm">
        {t("writtenOn", { date: formatDate(review.writtenAt, locale) })}
      </p>
      {review.status === "rejected" && review.rejectionNote && (
        <p className="text-sm font-semibold text-red-800">
          {t("rejectionNote", { note: review.rejectionNote })}
        </p>
      )}
      {review.reply && (
        <div className="bg-leaf-50/70 ring-leaf-600/10 rounded-xl px-4 py-3 ring-1">
          <p className="text-leaf-700 text-sm font-bold">{t("reply")}</p>
          <p className="mt-1 text-[0.9375rem] whitespace-pre-line">
            {review.reply.text}
          </p>
        </div>
      )}
    </div>
  );
}

function ReviewForm({
  orderNumber,
  onWritten,
  onAlreadyWritten,
}: {
  orderNumber: string;
  onWritten: (review: MyReview) => void;
  /** The API has one already: the caller reads it afresh. */
  onAlreadyWritten: () => void;
}) {
  const t = useTranslations("reviews");
  const locale = useLocale() as Locale;
  const [rating, setRating] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [problems, setProblems] = useState<{
    rating?: string;
    text?: string;
  }>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const found: typeof problems = {};
    if (rating === null) found.rating = t("ratingMissing");
    if (text.trim().length < REVIEW_TEXT_MIN) found.text = t("textTooShort");
    setProblems(found);
    if (found.rating || found.text) return;
    setBusy(true);
    setError(null);
    try {
      const { review } = await api.writeOrderReview(orderNumber, {
        rating: rating!,
        text: text.trim(),
        locale,
      });
      onWritten(review);
    } catch (caught) {
      if (hasErrorCode(caught, "REVIEW_ALREADY_WRITTEN")) {
        onAlreadyWritten();
        return;
      }
      const fromApi = fieldProblems(caught);
      if (fromApi.text || fromApi.rating) {
        setProblems({
          ...(fromApi.text && { text: t("textTooShort") }),
          ...(fromApi.rating && { rating: t("ratingMissing") }),
        });
      } else {
        setError(caught);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <p className="text-ink-muted text-[0.9375rem]">{t("formIntro")}</p>
      <StarPicker
        name="review-rating"
        legend={t("rating")}
        value={rating}
        onChange={(value) => {
          setRating(value);
          setProblems((rest) => ({ ...rest, rating: undefined }));
        }}
        labelOf={(value) => t("stars", { count: value })}
        error={problems.rating}
      />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="review-text" className="text-sm font-semibold">
          {t("text")}
        </label>
        <textarea
          id="review-text"
          rows={5}
          maxLength={REVIEW_TEXT_MAX}
          value={text}
          aria-invalid={problems.text ? true : undefined}
          aria-describedby="review-text-hint"
          onChange={(event) => {
            setText(event.target.value);
            setProblems((rest) => ({ ...rest, text: undefined }));
          }}
          className={cn(controlStyles, "py-3")}
        />
        <p
          id="review-text-hint"
          className={cn(
            "flex justify-between gap-3 text-sm",
            problems.text ? "font-semibold text-red-800" : "text-ink-muted",
          )}
        >
          <span>{problems.text ?? t("textHint")}</span>
          <span className="shrink-0 tabular-nums">
            {text.length} / {REVIEW_TEXT_MAX}
          </span>
        </p>
      </div>
      {error !== null && <ErrorAlert error={error} />}
      <Button type="submit" className="self-start" loading={busy}>
        {t("submit")}
      </Button>
    </form>
  );
}
