import type { Metadata } from "next";
import type { LegalType } from "@/lib/api/types";

// The legal pages of the shop. Six are written and published by the admin
// in the panel and come from the API (doc 6, `doc/LEGAL_PAGES.md`): the
// imprint, the shipping information, the refund policy, the terms, the
// privacy policy and the right of withdrawal. The cookie page describes
// the shop itself and stays a file of the shop.

/**
 * The page of each legal text. The addresses are the API's default ones
 * (`/legal/terms`, `/rechtliches/agb`, see `src/i18n/routing.ts`). The
 * admin can change an address in the panel; the shop asks the API by type,
 * so its pages keep working, under the addresses fixed here.
 */
export const LEGAL_HREF = {
  imprint: "/legal/imprint",
  shipping: "/legal/shipping",
  refund: "/legal/refund-policy",
  terms: "/legal/terms",
  privacy: "/legal/privacy",
  withdrawal: "/legal/withdrawal",
} as const satisfies Record<LegalType, string>;

/**
 * The pages that show a file of the shop (`content/legal`) while the admin
 * has published no text. The imprint and the right of withdrawal were
 * files until 2026-11-11 and must not go empty on the day the API takes
 * them over. Once both are published in the panel, the two files and this
 * list can go.
 */
export const FILE_UNTIL_PUBLISHED = {
  imprint: "imprint",
  withdrawal: "withdrawal",
} as const satisfies Partial<Record<LegalType, string>>;

/** A legal page of the footer: one of the API's six, or the cookie page. */
export type FooterLegalPage = LegalType | "cookies";

/** The legal column of the footer, in its order. */
const FOOTER_ORDER: readonly FooterLegalPage[] = [
  "terms",
  "withdrawal",
  "shipping",
  "refund",
  "privacy",
  "cookies",
  "imprint",
];

/** What the footer links of the API's pages when the API did not answer. */
const WITHOUT_AN_ANSWER: readonly LegalType[] = ["terms", "privacy"];

/**
 * The legal pages the footer links, in its order. A page of the API is
 * linked when it is published: an unpublished one answers 404 and gets no
 * link. The imprint and the right of withdrawal are always linked: without
 * a published text they show the shop's file. So is the cookie page.
 *
 * @param published the types `GET /v1/store/legal` answered, or `null`
 *                  when the API did not answer: the footer then shows the
 *                  pages the shop has had all along
 */
export function footerLegalPages(
  published: readonly LegalType[] | null,
): FooterLegalPage[] {
  const linked = new Set<FooterLegalPage>([
    "cookies",
    ...(Object.keys(FILE_UNTIL_PUBLISHED) as LegalType[]),
    ...(published ?? WITHOUT_AN_ANSWER),
  ]);
  return FOOTER_ORDER.filter((page) => linked.has(page));
}

/**
 * The title of a legal page for the browser tab and the search result. A
 * title the admin wrote with the shop's name in it ("AGB | Radhe Foods")
 * stands as it is; any other gets the name appended like every page of
 * the shop, and never twice.
 */
export function legalTitle(
  title: string,
  shopName: string,
): NonNullable<Metadata["title"]> {
  return title.toLowerCase().includes(shopName.toLowerCase())
    ? { absolute: title }
    : title;
}
