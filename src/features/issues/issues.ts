import type { ChipTone } from "@/components/ui/chip";
import type {
  IssueItem,
  IssueProblem,
  IssueResolutionType,
  IssueStatus,
} from "@/lib/api/types";

// What the pages of the problem reports share (doc 23): the keys of their
// cached answers, the colour of each status, the problems and the wishes
// in the order the form shows them, and two small sums.

export const issuesQueryKey = (locale: string) => ["issues", locale] as const;
export const issueQueryKey = (issueNumber: string, locale: string) =>
  ["issue", issueNumber.toUpperCase(), locale] as const;
export const orderIssuesQueryKey = (orderNumber: string, locale: string) =>
  ["order-issues", orderNumber.toUpperCase(), locale] as const;

export const ISSUE_STATUS_TONE: Record<IssueStatus, ChipTone> = {
  open: "wheat",
  in_review: "leaf",
  resolved: "green",
  rejected: "red",
  cancelled: "mute",
};

/** The six problems, as the reference lays them out. */
export const ISSUE_PROBLEMS: readonly IssueProblem[] = [
  "damaged",
  "missing",
  "wrong_item",
  "not_fresh",
  "late",
  "other",
];

/** The three wishes; the reference's points have no API (CUSTOMER_ACCOUNTS 9). */
export const ISSUE_WISHES: readonly IssueResolutionType[] = [
  "refund",
  "replacement",
  "none",
];

export const ISSUE_PHOTOS_MAX = 5;
export const ISSUE_PHOTO_TYPES: readonly string[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
];
export const ISSUE_TEXT_MIN = 10;
export const ISSUE_TEXT_MAX = 2000;

const DAY = 86_400_000;

/** Whole days until a moment, never below zero: "You have N days left". */
export function daysLeft(until: string, now = Date.now()): number {
  return Math.max(0, Math.ceil((Date.parse(until) - now) / DAY));
}

/** What the named units are worth, in cents. */
export function issueValue(
  items: readonly Pick<IssueItem, "quantity" | "unitPrice">[],
): number {
  return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
}
