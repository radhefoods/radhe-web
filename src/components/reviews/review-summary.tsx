import { Star } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { ReviewSummary as Summary } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatAverage } from "@/features/reviews/reviews";
import { RatingStars } from "./rating-stars";

const STARS = [5, 4, 3, 2, 1] as const;

/**
 * The head of the public list (ORDER_REVIEWS 4): the average large with
 * the stars and "4.6 of 5 from 128 orders", and the distribution as five
 * bars, each a link that narrows the list to that number of stars; the
 * chosen one is marked, and "Show all reviews" leads back. Links, so the
 * filter works without scripts and can be shared.
 */
export async function ReviewSummary({
  summary,
  locale,
  rating,
  className,
}: {
  summary: Summary;
  locale: Locale;
  /** The filter in force, if any. */
  rating: number | null;
  className?: string;
}) {
  const t = await getTranslations("reviews");
  const average = summary.average ?? 0;
  const most = Math.max(1, ...STARS.map((star) => summary.distribution[star]));
  return (
    <div
      className={cn(
        "glass-strong grid gap-6 rounded-3xl p-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-10 sm:p-6",
        className,
      )}
    >
      <div className="flex flex-col items-start gap-2">
        <p className="font-display text-ink text-[3.5rem] leading-none">
          {formatAverage(average, locale)}
        </p>
        <RatingStars
          average={average}
          label={t("ratingLabel", {
            average: formatAverage(average, locale),
            count: summary.count,
          })}
          size="lg"
        />
        <p className="text-ink-muted text-sm font-semibold">
          {t("summary", {
            average: formatAverage(average, locale),
            count: summary.count,
          })}
        </p>
      </div>
      <nav aria-label={t("byStars")} className="flex flex-col gap-1.5">
        {STARS.map((star) => {
          const count = summary.distribution[star];
          const active = rating === star;
          return (
            <Link
              key={star}
              href={{ pathname: "/reviews", query: { rating: String(star) } }}
              aria-current={active ? "true" : undefined}
              aria-label={t("filterStars", { count: star, total: count })}
              className={cn(
                "ease-glass grid grid-cols-[3.25rem_minmax(0,1fr)_2.5rem] items-center gap-3 rounded-full px-2 py-1 text-sm transition-colors duration-200 hover:bg-white/70",
                active ? "text-leaf-700 bg-white/80 font-bold" : "text-ink",
              )}
            >
              <span className="flex items-center gap-1 tabular-nums">
                {star}
                <Star
                  aria-hidden="true"
                  className="text-wheat-800 size-3.5 fill-current"
                  strokeWidth={0}
                />
              </span>
              <span
                aria-hidden="true"
                className="bg-ink/8 h-2 overflow-hidden rounded-full"
              >
                <span
                  className="bg-wheat-400 block h-full rounded-full"
                  style={{ width: `${(count / most) * 100}%` }}
                />
              </span>
              <span className="text-ink-muted text-right tabular-nums">
                {count}
              </span>
            </Link>
          );
        })}
        {rating !== null && (
          <Link
            href={{ pathname: "/reviews" }}
            className="text-leaf-700 mt-1 self-start rounded-xs px-2 text-sm font-semibold underline underline-offset-4"
          >
            {t("showAll")}
          </Link>
        )}
      </nav>
    </div>
  );
}
