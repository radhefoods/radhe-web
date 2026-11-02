import { ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { RatingStars } from "@/components/reviews/rating-stars";
import { ReviewCard } from "@/components/reviews/review-card";
import { formatAverage } from "@/features/reviews/reviews";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { ReviewPage } from "@/lib/api/types";

/** How many reviews the home page shows; the page of its own has them all. */
export const HOME_REVIEWS = 3;

/**
 * "What our customers say" on the home page (ORDER_REVIEWS 4): the
 * heading row of the product rows (title, the summary as its tagline, the
 * glass pill to the full list), then the newest published reviews as
 * cards. Rendered only while the shop has a published review.
 */
export async function CustomerReviews({
  page,
  locale,
}: {
  page: ReviewPage;
  locale: Locale;
}) {
  const t = await getTranslations("reviews");
  if (page.summary.count === 0) return null;
  const average = page.summary.average ?? 0;
  return (
    <section aria-labelledby="home-reviews">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2
            id="home-reviews"
            className="font-display text-ink text-[1.625rem] sm:text-3xl"
          >
            {t("publicTitle")}
          </h2>
          <p className="text-ink-muted mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.9375rem]">
            <RatingStars
              average={average}
              label={t("ratingLabel", {
                average: formatAverage(average, locale),
                count: page.summary.count,
              })}
              size="md"
            />
            <span aria-hidden="true">
              {t("summary", {
                average: formatAverage(average, locale),
                count: page.summary.count,
              })}
            </span>
          </p>
        </div>
        <Link
          href={{ pathname: "/reviews" }}
          className="glass-soft text-ink hover:shadow-lift flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 text-[0.9375rem] font-semibold whitespace-nowrap transition-[background-color,color,box-shadow] duration-200 hover:bg-white/90"
        >
          {t("all")}
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </div>
      <ul className="mt-5 grid gap-4 md:grid-cols-3">
        {page.items.slice(0, HOME_REVIEWS).map((review) => (
          <li key={review.id} className="flex">
            <ReviewCard
              review={review}
              locale={locale}
              clamp
              className="w-full"
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
