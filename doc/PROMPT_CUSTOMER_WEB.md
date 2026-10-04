# Instructions: Radhe Foods Customer Web application

You are the lead frontend engineer and product designer for the **customer-facing web shop of Radhe Foods**. You build it from scratch in this folder. The backend API already exists and is finished; you build the website that uses it.

The owner (Vrushabh, a solo developer and the shop owner) gives direction. Where he has not decided something, you decide, with the best judgement of an experienced e-commerce engineer and designer. Aim for a result that is production-ready, polished, fast and attractive, not for a demo.

---

## 1. What Radhe Foods is

Radhe Foods sells Indian groceries in Germany through a **pre-order system**:

- The catalogue is permanent, but ordering happens in **cycles called cargos**. One cargo is open for orders at a time; it closes on a deadline, the goods are brought in, and the orders are delivered in a delivery window.
- Customers **confirm an order without paying**. There is **no payment at checkout, ever**. After delivery, the shop activates payment: the customer receives an invoice with a payment link (Stripe, card and PayPal) or pays cash. Reminders go out until it is paid.
- Currency EUR, prices include VAT, languages **English and German** with equal quality, market Germany.
- Customers sign in with an email login code (OTP) or Google. No passwords.
- Returns can be requested within a window after delivery.

The attached concept documents explain the business in depth. Read them first, completely.

---

## 2. The attached files and which one wins

| File | Role |
|---|---|
| `Radhe_Foods_Preorder_Core_Concept.md`, `Radhe_Foods_Preorder.md` | The business idea and the full pre-order flow. Explains **why** |
| `ARCHITECTURE.md` | How the whole platform is built and hosted |
| `CUSTOMER_WEB_API_DOCUMENTATION.md` | **Every endpoint, field, status and error the shop can use. This is the authority.** |
| Logo files | The brand mark. Derive the colour palette from it |

Rule: **where the concept documents and the API documentation differ, the API documentation is right** (it was generated from the real implementation; the concept documents are the original plan). Example: the concept names twelve cargo statuses, the API has nine; the concept shows illustrative order numbers, the API defines the real format. Build against the API. Do not invent endpoints, fields or statuses; if something you need is missing from the API, say so and work around it on the frontend, do not pretend it exists.

---

## 3. Non-negotiable facts about the backend

Read section 0 of the API documentation before writing any code. In short:

- Base URL `https://<api host>/v1`, JSON, errors as `{ error: { code, message, details? }, requestId }`. Translate the `code` on the frontend; messages from the API are not localized.
- **Authentication is cookie based.** Tokens are never in response bodies. Every call uses `credentials: 'include'`. On `401 AUTH_TOKEN_INVALID` call `POST /v1/store/auth/refresh` once and retry; if that fails, the session is over. The refresh cookie only travels to `/v1/store/auth/*`. Server components forward the incoming `Cookie` header.
- Non-GET requests from the browser must come from an origin the API allows (dev: `http://localhost:3001`). Production: shop on `radhefoods.de` (or the final domain), API on `api.<domain>`, cookies shared on the parent domain.
- `?locale=en|de` on every store call (or `Accept-Language`).
- Money is integer cents; format it as `19,99 €` in German and `€19.99` in English. Dates are ISO/UTC; calendar days (`YYYY-MM-DD`) are in `Europe/Berlin`. Never do float arithmetic on prices; the API gives every total.
- Images come as absolute WebP URLs in three sizes (320/800/1600 px). Never build image URLs yourself.
- Rate limit 120 requests/minute per IP; lower on auth. Back off on 429.
- The order is placed with an `Idempotency-Key` and the `expectedTotal` the customer saw; handle `ORDER_TOTAL_CHANGED`, `ORDER_ITEMS_NOT_ORDERABLE`, `LEGAL_VERSION_CHANGED`, `PAYMENT_OVERDUE` exactly as documented.
- Some features are built but not yet active (Stripe, Google sign-in, WhatsApp). The API documentation, section 14, says what the UI does in each case. Design for both states.

---

## 4. Technical decisions

Use the current stable versions of everything. My defaults, which you may change with a stated reason:

- **Next.js (App Router), TypeScript strict, React Server Components** for catalogue pages (SEO, speed) and client components where interaction needs them.
- Tailwind CSS with a small, consistent design-token layer; a headless/accessible component base (for example Radix or shadcn/ui) rather than a heavy UI kit.
- `next-intl` (or equivalent) for en/de with **localized routes** (`/en/...`, `/de/...`), language switch that keeps the current page, `hreflang` on every page.
- Server state through a typed API client (one module that knows the base URL, credentials, locale, refresh-and-retry, error mapping) and TanStack Query or RSC fetching with sensible caching.
- Forms with validation that mirrors the API's rules (zod); show API validation errors (`details[].field`) next to the right field.
- Guest cart in local storage; `POST /v1/store/cart/preview` for prices; merge into the server cart at sign-in, as the API documentation describes.
- Environment: `NEXT_PUBLIC_API_URL` and whatever else you need, documented in `.env.example`. No secrets in the frontend; this shop has none.
- Tests for the parts that lose money when wrong: price formatting, cart logic, checkout flow (component tests + a few end-to-end tests with Playwright against a mocked API). Lint and type checks clean.
- Hosting: the shop will be deployed on Vercel or on Hostinger (Node.js). Keep the build standard so both work; no platform-specific services.

---

## 5. What the shop must contain

Pages (both languages):

1. **Home**: brand, what pre-ordering means in three steps, the current cargo state with countdown (deadline, delivery window), featured categories/products, trust elements, newsletter/WhatsApp opt-in teaser.
2. **Catalogue**: categories, product listing with filters/sort/search from the API, pack sizes and prices, "orderable" state per product; product detail page by slug with gallery, description, pack-size chooser, add to cart; related products.
3. **Cart**: lines, quantities, the bill from the API (subtotal, delivery fee tiers, free-from hint, VAT breakdown, total), ordering block messages.
4. **Checkout** (signed in): address chooser/editor, delivery method where the API offers it, legal consent with links to the exact versions, order summary, the confirmation button. German law ("Button-Lösung"): the final button must be labelled unambiguously, e.g. "Zahlungspflichtig vorbestellen" / "Place binding pre-order", and the page must state that payment is due after delivery, with the price including VAT and the delivery fee visible. Then an order confirmation page.
5. **Account**: sign-in (email code with resend cooldown, Google when available), profile, communication preferences (email news, WhatsApp opt-in), addresses, orders list and detail with status timeline, cancel while allowed, payment block ("Pay now" when `canPayOnline`, cash hint, deadline, overdue state), invoices and credit notes with PDF download, returns (request within the window, list, cancel).
6. **Public pages without sign-in**: `/pay/<token>` (payment link from emails), `/unsubscribe/<token>`, the Stripe return page (`?payment=success|cancelled`), legal pages.
7. **Legal pages**: Terms (`terms`), Pre-order terms (`preorder_terms`), Privacy (`privacy`) rendered from the API. **Impressum and Widerrufsbelehrung are not in the API**: build them as static, editable content files with clearly marked placeholders that the owner fills in. Also a cookie notice that is honest: the shop sets only strictly necessary cookies unless you add analytics.
8. **Error and empty states** everywhere: no open cargo, empty category, sold-out pack size, blocked account, network failure (show the `requestId`), 404.

---

## 6. Design direction

- For the overall design and theme, use your highest level of creativity and professional judgment. You have full freedom to create the design theme, visual system, layout, typography, spacing, colors, components, animations, interactions, and overall user experience.

- Do not limit yourself to basic or conventional designs. Aim to create a world-class, modern, premium, highly professional, visually attractive, and polished website. Make design decisions based on current best practices and what will provide the strongest user experience, usability, accessibility, and brand presentation.

- Where I have not provided specific design instructions, use your own expert judgment and choose what you believe will produce the best possible result.

- Modern, warm, premium grocery feel; appetizing photography-first layouts; generous whitespace; typographic hierarchy. Build the palette and typography from the logo and present it as a small design system (tokens, components, states) before building pages.
- Mobile first. Most customers will order on a phone. Thumb-reachable add-to-cart, sticky cart summary, fast tap targets. Then tablet and desktop.
- The pre-order concept must be **impossible to misunderstand**: the cargo state, the deadline, the delivery window and "pay after delivery" appear where decisions are made (product, cart, checkout), in plain words, not as fine print.
- Accessibility: semantic HTML, keyboard navigation, visible focus, contrast AA, alt texts, `prefers-reduced-motion`.
- Performance budget: Lighthouse 90+ on mobile for Performance, Accessibility, Best Practices, SEO. `next/image` with the API's size variants, font subsetting, no layout shift, streaming where it helps.

---

## 7. SEO

- For SEO, you have full freedom to implement everything necessary to achieve the strongest possible technical and on-page SEO.

- Do not limit the optimization only to the SEO requirements explicitly mentioned in this document. Apply additional SEO improvements wherever they are appropriate, including technical SEO, metadata, structured data, internal linking, crawlability, indexability, semantic HTML, multilingual SEO, image SEO, performance, Core Web Vitals, canonicalization, sitemap strategy, robots configuration, and any other relevant areas.

- Use your professional judgment and current SEO best practices to optimize the website as thoroughly as possible.



Treat SEO as a feature, not an afterthought:

- Server-rendered catalogue with clean URLs by slug per language, canonical and `hreflang` (`en`, `de`, `x-default`), `sitemap.xml` generated from the API, `robots.txt`.
- Metadata per page from product/category `seo` fields where the API provides them, with sensible fallbacks; Open Graph and Twitter cards with product images; a default social image with the logo.
- Structured data (JSON-LD): `Organization`, `WebSite`, `BreadcrumbList`, `Product` with `Offer` (price in EUR, availability from the ordering state), `ItemList` on category pages.
- Static or ISR rendering for catalogue pages with revalidation; account and cart pages `noindex`.
- Core Web Vitals in the green; no render-blocking third-party scripts.

---

Use your strongest engineering judgment when designing and implementing the application architecture.

You have full freedom to choose the best code organization, folder structure, component architecture, reusable abstractions, state-management patterns, caching strategy, data-fetching approach, utilities, validation structure, performance techniques, and other implementation details.

The final codebase should be clean, modular, maintainable, reusable, secure, highly optimized, production-ready, and designed to scale as the platform grows.

Where appropriate, you are also fully authorized to research the latest official documentation, framework recommendations, browser standards, accessibility guidance, SEO practices, security guidance, and current industry best practices before making implementation decisions. Prefer official and authoritative documentation whenever possible.

The goal is not simply to make the application work. Build it to the highest practical standard in terms of design quality, user experience, SEO, performance, maintainability, scalability, security, accessibility, and overall engineering quality.

------------

if you have any doubt, uncertainty, missing information, conflicting requirement, or ambiguity regarding any part of the project, do not make assumptions.

Feel free to ask me for clarification before making an important decision. This applies to anything related to the project, including the technology stack, architecture etc...