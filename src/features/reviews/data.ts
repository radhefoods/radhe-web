import type { Locale } from "@/i18n/routing";
import { REVALIDATE, TAGS, serverApi } from "@/lib/api/server";
import type { ReviewPage, ReviewQuery } from "@/lib/api/types";

// Cached for a few minutes on the shop: the API allows 60 reads a minute
// per address and the home page is rendered on every visit. Read fresh
// while developing, so what the mock's controls change shows at once.
const reviews = {
  revalidate: process.env.NODE_ENV === "development" ? 0 : REVALIDATE.reviews,
  tags: [TAGS.reviews],
};

/**
 * A page of the published reviews with the summary of all of them
 * (ORDER_REVIEWS 2). Throws when the API does
 * not answer: the page of its own shows the error page, the home page
 * catches it and leaves the section out.
 */
export function getReviews(
  query: ReviewQuery,
  locale: Locale,
): Promise<ReviewPage> {
  return serverApi.listReviews(query, { locale, next: reviews });
}
