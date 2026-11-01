"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { RatingStars } from "@/components/catalogue/rating-stars";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Chip, type ChipTone } from "@/components/ui/chip";
import { ErrorAlert } from "@/components/ui/error-alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { api } from "@/lib/api/browser";
import type { MyReview, ReviewStatus, ReviewableItem } from "@/lib/api/types";
import { formatDate } from "@/lib/format/dates";
import { formatProductName } from "@/lib/format/product-name";
import { ReviewSheet } from "./review-sheet";

export const MY_REVIEWS_QUERY_KEY = ["account", "reviews"] as const;
export const REVIEWABLE_QUERY_KEY = ["account", "reviewable"] as const;

const STATUS_TONE: Record<ReviewStatus, ChipTone> = {
  pending: "wheat",
  published: "green",
  rejected: "red",
};

const panel = "glass-strong rounded-2xl p-4 flex gap-4";

function Picture({
  product,
}: {
  product: { slug: string; name: string; imageUrl: string | null };
}) {
  return (
    <Link
      href={{ pathname: "/products/[slug]", params: { slug: product.slug } }}
      tabIndex={-1}
      aria-hidden="true"
      className="ring-ink/6 grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-white p-1 ring-1"
    >
      {product.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={product.imageUrl}
          alt=""
          width={64}
          height={64}
          loading="lazy"
          className="size-full object-contain"
        />
      )}
    </Link>
  );
}

/**
 * The reviews page of the account (doc 22): what waits for a review
 * (every product of a delivered order without one), and the reviews
 * written so far with their status (waiting for approval, published,
 * rejected with the note), each to edit or delete. `?product=` opens
 * the sheet for that product, as the order page links it.
 */
export function ReviewsView() {
  const t = useTranslations("reviews");
  const tAccount = useTranslations("account");
  const locale = useLocale() as Locale;
  const client = useQueryClient();
  const wanted = useSearchParams().get("product");
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
  const [writing, setWriting] = useState<{
    item: ReviewableItem;
    existing: MyReview | null;
  } | null>(null);
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);

  // The order page sends `?product=`: the sheet opens for it once, until
  // it is closed.
  const [opened, setOpened] = useState<string | null>(null);
  const items = reviewable.data;
  const wantedItem =
    !writing && wanted && opened !== wanted
      ? (items?.find((entry) => entry.product.id === wanted) ?? null)
      : null;
  const active =
    writing ??
    (wantedItem ? { item: wantedItem, existing: wantedItem.review } : null);
  function closeSheet() {
    setWriting(null);
    if (wanted) setOpened(wanted);
  }

  function refresh() {
    void client.invalidateQueries({ queryKey: REVIEWABLE_QUERY_KEY });
    void client.invalidateQueries({ queryKey: MY_REVIEWS_QUERY_KEY });
  }

  async function remove(review: MyReview) {
    setError(null);
    try {
      await api.deleteReview(review.productId);
      setDeleting(null);
      refresh();
    } catch (caught) {
      setError(caught);
    }
  }

  const loadError = reviewable.error ?? mine.error;
  const waiting = items?.filter((item) => item.review === null) ?? [];
  const written = mine.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <header className="space-y-2">
        <h1 className="font-display text-ink text-3xl sm:text-4xl">
          {t("pageTitle")}
        </h1>
        <p className="text-ink-muted max-w-2xl">{t("pageIntro")}</p>
      </header>
      {saved && <Alert tone="good">{t("saved")}</Alert>}
      {error !== null && <ErrorAlert error={error} />}

      {loadError && !items && !mine.data ? (
        <ErrorAlert
          error={loadError}
          title={tAccount("loadError")}
          onRetry={() => {
            void reviewable.refetch();
            void mine.refetch();
          }}
        />
      ) : !items || !mine.data ? (
        <div className="space-y-3" aria-hidden="true">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      ) : (
        <>
          <section
            aria-labelledby="reviews-waiting"
            className="flex flex-col gap-3"
          >
            <h2 id="reviews-waiting" className="font-display text-ink text-xl">
              {t("waiting")}
            </h2>
            {waiting.length === 0 ? (
              <p className="glass text-ink-muted rounded-2xl px-5 py-6">
                {t("nothingToReview")}
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {waiting.map((item) => (
                  <li
                    key={`${item.product.id}-${item.orderNumber}`}
                    className={panel}
                  >
                    <Picture product={item.product} />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold">
                        {formatProductName(item.product.name)}
                      </p>
                      <p className="text-ink-muted text-sm">
                        {t("orderLine", {
                          orderNumber: item.orderNumber,
                          date: formatDate(item.deliveredAt, locale),
                        })}
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="self-center"
                      onClick={() => setWriting({ item, existing: null })}
                    >
                      {t("write")}
                    </Button>
                  </li>
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
                  <li key={review.id} className={panel}>
                    <Picture product={review.product} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-bold">
                          {formatProductName(review.product.name)}
                        </p>
                        <Chip tone={STATUS_TONE[review.status]}>
                          {t(`status.${review.status}`)}
                        </Chip>
                      </div>
                      <RatingStars
                        average={review.rating}
                        label={t("stars", { count: review.rating })}
                        className="mt-1"
                      />
                      {review.title && (
                        <p className="mt-1 font-semibold">{review.title}</p>
                      )}
                      <p className="mt-1 text-[0.9375rem] whitespace-pre-line">
                        {review.text}
                      </p>
                      {review.status === "rejected" && review.rejectionNote && (
                        <p className="mt-2 text-sm font-semibold text-red-800">
                          {t("rejectionNote", { note: review.rejectionNote })}
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            setWriting({
                              item: {
                                product: review.product,
                                orderNumber: review.orderNumber ?? "",
                                deliveredAt: review.createdAt,
                                review,
                              },
                              existing: review,
                            })
                          }
                        >
                          {t("edit")}
                        </Button>
                        {deleting === review.id ? (
                          <>
                            <span className="text-sm font-semibold">
                              {t("deleteConfirm")}
                            </span>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => void remove(review)}
                            >
                              {t("deleteYes")}
                            </Button>
                            <Button
                              variant="quiet"
                              size="sm"
                              onClick={() => setDeleting(null)}
                            >
                              {t("keep")}
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="quiet"
                            size="sm"
                            className="text-red-600 hover:bg-red-50"
                            onClick={() => setDeleting(review.id)}
                          >
                            {t("delete")}
                          </Button>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {active && (
        <ReviewSheet
          productId={active.item.product.id}
          productName={formatProductName(active.item.product.name)}
          orderNumber={active.item.orderNumber || null}
          existing={active.existing}
          onClose={closeSheet}
          onSaved={() => {
            setSaved(true);
            refresh();
          }}
        />
      )}
    </div>
  );
}
