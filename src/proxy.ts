import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Sends every request without a language prefix to the customer's language
// (the language they chose before, then the browser's, then English) and
// maps localized addresses (`/de/warenkorb`) to the pages in `app/[locale]`.
export default createMiddleware(routing);

export const config = {
  matcher: [
    // Everything except Next.js internals, API routes and files with an
    // extension (images, robots.txt, sitemap.xml, ...).
    "/((?!api|_next|_vercel|.*\\..*).*)",
    // Links from emails carry tokens that can contain a dot
    // (`/unsubscribe/<id>.<signature>`), which the rule above would skip.
    "/unsubscribe/:token*",
    "/pay/:token*",
    "/(en|de)/unsubscribe/:token*",
    "/(en|de)/pay/:token*",
  ],
};
