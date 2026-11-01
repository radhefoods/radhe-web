"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { MessageSquareText } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button, buttonStyles } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/error-alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/features/session/session";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { api } from "@/lib/api/browser";
import type { Id, Review, ReviewPage } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format/dates";
import { RatingStars } from "./rating-stars";

const PAGE_SIZE = 5;
const STARS = [5, 4, 3, 2, 1] as const;

/** A number with one decimal in the page's language: "4.6" / "4,6". */
function decimal(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function ReviewCard({ review }: { review: Review }) {
  const t = useTranslations("reviews");
  const locale = useLocale() as Locale;
  return (
    <li className="glass-strong flex flex-col gap-2 rounded-2xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <RatingStars
          average={review.rating}
          label={t("stars", { count: review.rating })}
          size="md"
        />
        <p className="text-ink-muted text-sm">
          <span className="text-ink font-semibold">{review.authorName}</span>
          {" · "}
          {t("verified")}
          {" · "}
          {formatDate(review.publishedAt, locale)}
          {review.editedAt && <> · {t("edited")}</>}
        </p>
      </div>
      {review.title && <p className="font-bold">{review.title}</p>}
      <p className="whitespace-pre-line">{review.text}</p>
      {review.reply && (
        <div className="bg-leaf-50/80 ring-leaf-600/12 mt-1 rounded-xl px-4 py-3 text-[0.9375rem] ring-1">
          <p className="text-leaf-700 text-sm font-bold">
            {t("reply")} · {formatDate(review.reply.at, locale)}
          </p>
          <p className="mt-1 whitespace-pre-line">{review.reply.text}</p>
        </div>
      )}
    </li>
  );
}

/**
 * The reviews of a product (doc 22): the average large with its stars and
 * count, the distribution as bars that filter by stars, the published
 * reviews newest first with the reply of Radhe Foods under one, and
 * "Show more" page by page. The first page comes with the page from the
 * server; a signed-in customer finds the way to write one.
 */
export function ProductReviews({
  productId,
  initial,
}: {
  productId: Id;
  /** The first page without a filter, read on the server; `null` when the API has none. */
  initial: ReviewPage | null;
}) {
  const t = useTranslations("reviews");
  const locale = useLocale() as Locale;
  const session = useSession();
  const [stars, setStars] = useState<number | null>(null);
  const query = useInfiniteQuery({
    queryKey: ["reviews", productId, locale, stars],
    queryFn: ({ pageParam }) =>
      api.listProductReviews(productId, {
        page: pageParam,
        limit: PAGE_SIZE,
        ...(stars !== null && { rating: stars }),
      }),
    initialPageParam: 1,
    getNextPageParam: (page) =>
      page.page < page.totalPages ? page.page + 1 : undefined,
    ...(initial &&
      stars === null && {
        initialData: { pages: [initial], pageParams: [1] },
      }),
    staleTime: 60_000,
  });
  const pages = query.data?.pages ?? [];
  // The summary never changes with the filter: the first page knows it.
  const summary = initial?.summary ?? pages[0]?.summary ?? null;
  const reviews = pages.flatMap((page) => page.items);
  const label =
    summary && summary.count > 0
      ? t("ratingLabel", {
          average: decimal(summary.average, locale),
          count: summary.count,
        })
      : t("count", { count: 0 });

  return (
    <section
      id="product-reviews"
      aria-labelledby="product-reviews-title"
      className="scroll-mt-28"
    >
      <h2
        id="product-reviews-title"
        className="font-display text-ink text-[1.875rem] sm:text-[2.25rem] lg:text-[2.5rem]"
      >
        {t("title")}
      </h2>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <div className="glass-strong flex flex-col gap-4 rounded-2xl p-5">
          {summary && summary.count > 0 ? (
            <>
              <div className="flex items-end gap-3">
                <p className="font-display text-ink text-[3rem] leading-none">
                  {decimal(summary.average, locale)}
                </p>
                <p className="text-ink-muted pb-1 text-sm">{t("outOf")}</p>
              </div>
              <RatingStars average={summary.average} label={label} size="lg" />
              <p className="text-ink-muted text-sm">
                {t("count", { count: summary.count })}
              </p>
              <ul className="flex flex-col gap-1.5">
                {STARS.map((value) => {
                  const count = summary.distribution[`${value}`];
                  const share =
                    summary.count > 0 ? (count / summary.count) * 100 : 0;
                  const active = stars === value;
                  return (
                    <li key={value}>
                      <button
                        type="button"
                        aria-pressed={active}
                        aria-label={
                          active
                            ? t("allStars")
                            : t("filterStars", { count: value })
                        }
                        disabled={count === 0 && !active}
                        onClick={() => setStars(active ? null : value)}
                        className={cn(
                          "grid w-full grid-cols-[2.5rem_1fr_2rem] items-center gap-2 rounded-lg px-1 py-1 text-sm transition-colors duration-150 disabled:opacity-50",
                          active ? "bg-leaf-50" : "hover:bg-white/70",
                        )}
                      >
                        <span className="text-left font-semibold tabular-nums">
                          {value} ★
                        </span>
                        <span className="bg-ink/8 h-2 overflow-hidden rounded-full">
                          <span
                            className="bg-wheat-400 block h-full rounded-full"
                            style={{ width: `${share}%` }}
                          />
                        </span>
                        <span className="text-ink-muted text-right tabular-nums">
                          {count}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 text-center">
              <span className="bg-leaf-50 text-leaf-700 grid size-12 place-items-center rounded-full">
                <MessageSquareText aria-hidden="true" className="size-5" />
              </span>
              <p className="text-ink-muted text-sm">{t("empty")}</p>
            </div>
          )}
          {session.status === "customer" ? (
            <Link
              href="/account/reviews"
              className={buttonStyles({ variant: "secondary", size: "sm" })}
            >
              {t("write")}
            </Link>
          ) : (
            <p className="text-ink-subtle text-xs">{t("writeHint")}</p>
          )}
        </div>

        <div className="flex flex-col gap-3">
          {query.error && reviews.length === 0 ? (
            <ErrorAlert
              error={query.error}
              onRetry={() => void query.refetch()}
            />
          ) : query.isPending ? (
            <div className="space-y-3" aria-hidden="true">
              <Skeleton className="h-28 rounded-2xl" />
              <Skeleton className="h-28 rounded-2xl" />
            </div>
          ) : reviews.length === 0 ? (
            summary &&
            summary.count > 0 && (
              <p className="glass text-ink-muted rounded-2xl px-5 py-8 text-center">
                {t("emptyFiltered")}
              </p>
            )
          ) : (
            <>
              <ul className="flex flex-col gap-3">
                {reviews.map((review) => (
                  <ReviewCard key={review.id} review={review} />
                ))}
              </ul>
              {query.hasNextPage && (
                <Button
                  variant="secondary"
                  className="self-center"
                  loading={query.isFetchingNextPage}
                  onClick={() => void query.fetchNextPage()}
                >
                  {t("showMore")}
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
