# Prompt for the website agent: legal pages from the API

Copy everything below the line into the agent that works on the shop (`radhe-web`).

---

You are working on the Radhe Foods shop (`radhe-web`, Next.js). The API now holds six legal pages that the owner writes and publishes in the admin panel: imprint, shipping information, refund policy, terms, privacy policy, right of withdrawal. The shop shows two of them from the API today (terms, privacy) and three from files (imprint, withdrawal, cookies). Show all six from the API.

**Read first:** in the `radhe-api` repository (the sibling folder `../radhe-api`), `doc/LEGAL_PAGES.md`, the parts "Public API" and "Checkout", and section 6 of `doc/CUSTOMER_WEB_API_DOCUMENTATION.md`. Where this prompt and those documents differ, the documents are right.

**Do not change the theme, colours, fonts, typography or any unrelated functionality.** The legal pages keep the layout `LegalDocumentPage` has.

## What changed in the API

- `GET /v1/store/legal` answers every published legal page, up to six types: `imprint`, `shipping`, `refund`, `terms`, `privacy`, `withdrawal`. New fields per item: `slug` (in the language of the answer), `slugs { en, de }`, `requiresConsent` (true for `terms` and `privacy` only).
- `GET /v1/store/legal/{key}` takes the type or the address of the page in either language. New fields: `slug`, `slugs`, `requiresConsent`, `contentLanguage` (`en` or `de`: the language the text is really in), `seo { title, description }`. `404 LEGAL_DOCUMENT_NOT_FOUND` when the page is not published or does not exist.
- A text may exist in one language only. The API then answers that text for both languages, and `contentLanguage` says which it is.
- **Checkout did not change.** Only `terms` and `privacy` are accepted; the API refuses any other key in `consent.versions`.

## What to build

1. **Types and client** (`src/lib/api/types.ts`, `src/lib/api/store-api.ts`): `LegalType` with six values; the new fields on `LegalSummary` and `LegalDocument`.
2. **Checkout** (`src/lib/checkout/order-attempt.ts`): keep sending only the consent types. Take them from `requiresConsent` of the list instead of the fixed pair, so that the shop follows the API. The other four pages never appear in the consent and never block the order.
3. **Imprint and withdrawal** (`/legal/imprint`, `/legal/withdrawal`): show the API's text with `LegalDocumentPage`. While the API has no published version (`404`), keep showing the file the page shows today, so that no page goes empty on the day this is deployed. Tell me when you do it this way, so that I know to publish the two texts in the panel.
4. **Two new pages**: shipping information at `/legal/shipping` (German `/rechtliches/versand`) and the refund policy at `/legal/refund-policy` (German `/rechtliches/rueckerstattung`), in `src/i18n/routing.ts` like the others. A page without a published version answers 404.
5. **Footer and sitemap** (`src/components/shell/footer.tsx`, `src/lib/seo/sitemap.ts`): link the legal pages that are published, from `GET /v1/store/legal`; do not link a page that would answer 404. The cookie page stays as it is: it is not one of the six.
6. **Search engines**: `generateMetadata` from `seo.title` and `seo.description`; alternates for both languages as today. Put `lang={contentLanguage}` on the text when it differs from the language of the page.
7. **Addresses**: the fixed routes above match the API's default addresses. The owner can change an address in the panel. Do not rebuild the routing for that now; ask me first if a changed address has to work on the site.
8. **The text** is Markdown or plain text exactly as typed: render it with `LegalText`, and never render HTML it contains.
9. **Tests**: the pages for a published and an unpublished text, the fallback of imprint and withdrawal, the footer with some pages missing, and the consent of the checkout with six published pages.

`/delivery-and-payment` is a page of its own and stays. Whether it should link to, or be replaced by, the new shipping information is the owner's decision: ask before changing it.

## How to work

Write a short plan and wait for my go. Then build it, run the shop's lint, type check and tests, and report what you built and what you left out.
