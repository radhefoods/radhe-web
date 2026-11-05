"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { RatingStars } from "@/components/reviews/rating-stars";
import { buttonStyles } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { ErrorAlert } from "@/components/ui/error-alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MY_REVIEWS_QUERY_KEY,
  REVIEWABLE_QUERY_KEY,
  REVIEW_STATUS_TONE,
} from "@/features/reviews/reviews";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { api } from "@/lib/api/browser";
import type { MyReview, OrderSummary } from "@/lib/api/types";
import { formatDate } from "@/lib/format/dates";

const panel = "glass-strong rounded-2xl p-4 sm:p-5";

/** The link to an order, as the rows name it. */
function OrderLink({ orderNumber }: { orderNumber: string }) {
  const t = useTranslations("reviews");
  return (
    <Link
      href={{
        pathname: "/account/orders/[orderNumber]",
        params: { orderNumber },
      }}
      className="text-leaf-700 rounded-xs text-lg font-bold underline-offset-4 hover:underline"
    >
      {t("orderNumber", { orderNumber })}
    </Link>
  );
}

/** A delivered order without a review: its pictures, its date, and the way to the form. */
function ReviewableOrder({ order }: { order: OrderSummary }) {
  const t = useTranslations("reviews");
  const locale = useLocale() as Locale;
  return (
    <li className={panel}>
      <div className="flex flex-wrap items-center gap-4">
        <ul className="flex -space-x-2" aria-hidden="true">
          {order.preview.map(
            (item, index) =>
              item.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={index}
                  src={item.imageUrl}
                  alt=""
                  width={44}
                  height={44}
                  loading="lazy"
                  className="bg-mist size-11 rounded-lg border-2 border-white object-cover shadow-[0_1px_3px_rgb(23_33_27/0.1)]"
                />
              ),
          )}
        </ul>
        <div className="min-w-0 flex-1">
          <OrderLink orderNumber={order.orderNumber} />
          <p className="text-ink-muted text-sm">
            {order.delivery.deliveredAt &&
              t("deliveredOn", {
                date: formatDate(order.delivery.deliveredAt, locale),
              })}
            {" · "}
            {t("itemCount", { count: order.itemCount })}
          </p>
        </div>
        <Link
          href={{
            pathname: "/account/orders/[orderNumber]",
            params: { orderNumber: order.orderNumber },
          }}
          className={buttonStyles({ variant: "secondary", size: "sm" })}
        >
          {t("write")}
        </Link>
      </div>
    </li>
  );
}

/** One of the customer's reviews with its status, the note, the answer. */
function WrittenReview({ review }: { review: MyReview }) {
  const t = useTranslations("reviews");
  const locale = useLocale() as Locale;
  return (
    <li className={panel}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <OrderLink orderNumber={review.orderNumber} />
        <Chip tone={REVIEW_STATUS_TONE[review.status]}>
          {t(`status.${review.status}`)}
        </Chip>
      </div>
      <RatingStars
        average={review.rating}
        label={t("stars", { count: review.rating })}
        className="mt-2"
      />
      <p className="mt-2 text-[0.9375rem] whitespace-pre-line">{review.text}</p>
      <p className="text-ink-muted mt-2 text-sm">
        {t("writtenOn", { date: formatDate(review.writtenAt, locale) })}
      </p>
      {review.status === "rejected" && review.rejectionNote && (
        <p className="mt-2 text-sm font-semibold text-red-800">
          {t("rejectionNote", { note: review.rejectionNote })}
        </p>
      )}
      {review.reply && (
        <div className="bg-leaf-50/70 ring-leaf-600/10 mt-3 rounded-xl px-4 py-3 ring-1">
          <p className="text-leaf-700 text-sm font-bold">{t("reply")}</p>
          <p className="mt-1 text-[0.9375rem] whitespace-pre-line">
            {review.reply.text}
          </p>
        </div>
      )}
    </li>
  );
}

/**
 * The reviews page of the account (ORDER_REVIEWS 4): the delivered orders
 * that wait for a review, each leading to its order page where the form
 * is, and the reviews written so far with their status (waiting for
 * approval, published, not published with the note) and the answer of
 * Radhe Foods. Written once: nothing to edit or delete.
 */
export function ReviewsView() {
  const t = useTranslations("reviews");
  const tAccount = useTranslations("account");
  const reviewable = useQuery({
    queryKey: REVIEWABLE_QUERY_KEY,
    queryFn: async () => (await api.listReviewable()).items,
    staleTime: 0,
  });
  const mine = useQuery({
    queryKey: MY_REVIEWS_QUERY_KEY,
    queryFn: async () => (await api.listMyReviews()).items,
    staleTime: 0,
  });
  const loadError = reviewable.error ?? mine.error;
  const orders = reviewable.data;
  const written = mine.data;

  return (
    <div className="flex flex-col gap-6">
      <header className="space-y-2">
        <h1 className="font-display text-ink text-3xl sm:text-4xl">
          {t("title")}
        </h1>
        <p className="text-ink-muted max-w-2xl">{t("pageIntro")}</p>
      </header>

      {loadError && (!orders || !written) ? (
        <ErrorAlert
          error={loadError}
          title={tAccount("loadError")}
          onRetry={() => {
            void reviewable.refetch();
            void mine.refetch();
          }}
        />
      ) : !orders || !written ? (
        <div className="space-y-3" aria-hidden="true">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      ) : (
        <>
          <section
            aria-labelledby="reviews-open"
            className="flex flex-col gap-3"
          >
            <h2 id="reviews-open" className="font-display text-ink text-xl">
              {t("reviewable")}
            </h2>
            {orders.length === 0 ? (
              <p className="glass text-ink-muted rounded-2xl px-5 py-6">
                {t("nothingToReview")}
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {orders.map((order) => (
                  <ReviewableOrder key={order.orderNumber} order={order} />
                ))}
              </ul>
            )}
          </section>

          <section
            aria-labelledby="reviews-mine"
            className="flex flex-col gap-3"
          >
            <h2 id="reviews-mine" className="font-display text-ink text-xl">
              {t("mine")}
            </h2>
            {written.length === 0 ? (
              <p className="glass text-ink-muted rounded-2xl px-5 py-6">
                {t("noneYet")}
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {written.map((review) => (
                  <WrittenReview key={review.id} review={review} />
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
