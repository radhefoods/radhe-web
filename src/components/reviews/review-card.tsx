import { BadgeCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import type { Review } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatMonthYear } from "@/lib/format/dates";
import { RatingStars } from "./rating-stars";

/**
 * One published review of a delivered order (ORDER_REVIEWS 4): the stars,
 * the words, the author with the month, the "Verified order" mark, and
 * the answer of Radhe Foods under it when there is one. A frosted card
 * like the other cards of the shop. `clamp` keeps a long text to a few
 * lines where the card is a teaser (the home page).
 */
export async function ReviewCard({
  review,
  locale,
  clamp = false,
  className,
}: {
  review: Review;
  locale: Locale;
  clamp?: boolean;
  className?: string;
}) {
  const t = await getTranslations("reviews");
  return (
    <article
      aria-label={t("reviewBy", { name: review.authorName })}
      className={cn(
        "glass-strong flex flex-col gap-3 rounded-2xl p-5",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <RatingStars
          average={review.rating}
          label={t("stars", { count: review.rating })}
          size="md"
        />
        <span className="text-leaf-700 flex items-center gap-1 text-[0.6875rem] font-bold tracking-[0.1em] uppercase">
          <BadgeCheck aria-hidden="true" className="size-4" />
          {t("verified")}
        </span>
      </div>
      <p
        className={cn(
          "text-[0.9375rem] leading-relaxed whitespace-pre-line",
          clamp && "line-clamp-5",
        )}
      >
        {review.text}
      </p>
      <p className="text-ink-muted mt-auto text-sm">
        <span className="text-ink font-semibold">{review.authorName}</span>
        {" · "}
        {formatMonthYear(review.publishedAt, locale)}
      </p>
      {review.reply && (
        <div className="bg-leaf-50/70 ring-leaf-600/10 rounded-xl px-4 py-3 ring-1">
          <p className="text-leaf-700 text-sm font-bold">{t("reply")}</p>
          <p
            className={cn(
              "mt-1 text-[0.9375rem] whitespace-pre-line",
              clamp && "line-clamp-3",
            )}
          >
            {review.reply.text}
          </p>
        </div>
      )}
    </article>
  );
}
