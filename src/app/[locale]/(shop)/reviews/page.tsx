import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ReviewCard } from "@/components/reviews/review-card";
import { ReviewSummary } from "@/components/reviews/review-summary";
import { Pagination } from "@/components/ui/pagination";
import { getReviews } from "@/features/reviews/data";
import {
  REVIEWS_PAGE_SIZE,
  parseReviewsState,
  reviewsQuery,
} from "@/features/reviews/reviews";
import { localeOf } from "@/i18n/locale";
import { alternates, sameHref } from "@/lib/seo/alternates";

type Props = PageProps<"/[locale]/reviews">;

export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const locale = await localeOf(params);
  const t = await getTranslations("reviews");
  const state = parseReviewsState(await searchParams);
  const links = alternates(locale, sameHref({ pathname: "/reviews" }));
  const query = new URLSearchParams(reviewsQuery(state)).toString();
  return {
    title: t("publicTitle"),
    description: t("metaDescription"),
    // A filter is a view of the same list: only the list itself (and its
    // further pages) belongs in a search engine.
    robots: state.rating !== null ? { index: false, follow: true } : undefined,
    alternates:
      state.rating === null && state.page > 1
        ? { canonical: `${links.canonical}?${query}` }
        : links,
  };
}

/**
 * "What our customers say" (ORDER_REVIEWS 4): every published review of a
 * delivered order, newest first, with the summary at the top, narrowed to
 * one number of stars by the bars, ten to a page.
 */
export default async function ReviewsPage({ params, searchParams }: Props) {
  const locale = await localeOf(params);
  const state = parseReviewsState(await searchParams);
  const [t, tCatalogue, page] = await Promise.all([
    getTranslations("reviews"),
    getTranslations("catalogue"),
    getReviews(
      {
        page: state.page,
        limit: REVIEWS_PAGE_SIZE,
        ...(state.rating !== null && { rating: state.rating }),
      },
      locale,
    ),
  ]);

  return (
    <div className="container-page space-y-6 py-6 sm:py-8">
      <header className="space-y-1.5">
        <h1 className="font-display text-ink text-3xl sm:text-4xl">
          {t("publicTitle")}
        </h1>
        <p className="text-ink-muted max-w-2xl">{t("publicIntro")}</p>
      </header>

      {page.summary.count === 0 ? (
        <p className="glass text-ink-muted rounded-2xl px-5 py-6">
          {t("publicEmpty")}
        </p>
      ) : (
        <>
          <ReviewSummary
            summary={page.summary}
            locale={locale}
            rating={state.rating}
          />
          {page.items.length === 0 ? (
            <p className="glass text-ink-muted rounded-2xl px-5 py-6">
              {t("emptyFiltered")}
            </p>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2">
              {page.items.map((review) => (
                <li key={review.id} className="flex">
                  <ReviewCard
                    review={review}
                    locale={locale}
                    className="w-full"
                  />
                </li>
              ))}
            </ul>
          )}
          <Pagination
            page={page.page}
            totalPages={page.totalPages}
            hrefOf={(number) => ({
              pathname: "/reviews",
              query: reviewsQuery({ ...state, page: number }),
            })}
            labels={{
              pagination: tCatalogue("pagination"),
              previous: tCatalogue("previous"),
              next: tCatalogue("next"),
              pageOf: (number, total) =>
                tCatalogue("pageOf", { page: number, total }),
            }}
            className="pt-2"
          />
        </>
      )}
    </div>
  );
}
