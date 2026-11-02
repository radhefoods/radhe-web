import type { ChipTone } from "@/components/ui/chip";
import type { ReviewStatus } from "@/lib/api/types";

// Order reviews (doc ORDER_REVIEWS): a customer reviews a delivered order
// once; the published ones are what the shop shows as "What our customers
// say". Shared by the order page, the account's reviews page and the
// public list.

export const MY_REVIEWS_QUERY_KEY = ["account", "reviews"] as const;
export const REVIEWABLE_QUERY_KEY = ["account", "reviewable"] as const;
export const orderReviewQueryKey = (orderNumber: string, locale: string) =>
  ["orderReview", orderNumber, locale] as const;

export const REVIEW_STATUS_TONE: Record<ReviewStatus, ChipTone> = {
  pending: "wheat",
  published: "green",
  rejected: "red",
};

/** The words of a review: 10 to 2000 characters (ORDER_REVIEWS 1). */
export const REVIEW_TEXT_MIN = 10;
export const REVIEW_TEXT_MAX = 2000;

/** A page of the public list; the API allows up to 50. */
export const REVIEWS_PAGE_SIZE = 10;

/** One decimal in the language's notation: "4.6" or "4,6". */
export function formatAverage(average: number, locale: string): string {
  return average.toLocaleString(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

export interface ReviewsListState {
  page: number;
  /** Only reviews with this many stars, or all. */
  rating: number | null;
}

/** `?page=` and `?rating=` of the public list, anything odd ignored. */
export function parseReviewsState(
  params: Record<string, string | string[] | undefined>,
): ReviewsListState {
  const one = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;
  const page = Number.parseInt(one(params.page) ?? "", 10);
  const rating = Number.parseInt(one(params.rating) ?? "", 10);
  return {
    page: Number.isInteger(page) && page >= 1 ? page : 1,
    rating:
      Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : null,
  };
}

/** The query of a page of the list, for the address bar. */
export function reviewsQuery(state: ReviewsListState): Record<string, string> {
  return {
    ...(state.rating !== null && { rating: String(state.rating) }),
    ...(state.page > 1 && { page: String(state.page) }),
  };
}
