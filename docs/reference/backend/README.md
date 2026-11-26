# Backend reference: the contracts the shop was built against

Copies of documents of the backend (`radhe-api`), as they were when the shop's side of each feature was built. They say what the API does: its routes, fields, rules and error codes. The shop's own documents ([api/](../../api/README.md), [features/](../../features/README.md)) say what the shop does with them, and link here instead of repeating the backend's rules.

**These are copies, kept as they were written.** They are never edited to match the shop. The living documents are in the backend's repository, `radhe-api/docs/`; when a copy and the backend disagree, the backend is right and the copy is replaced by a new one. The checker of the documentation leaves this folder alone: the copies name files of the backend's old layout that do not exist here.

## 1. The documents

| Document | Holds | State of the copy | In the backend today (`radhe-api/docs/`) |
| --- | --- | --- | --- |
| [store-api.md](store-api.md) | The reference of every call of the store API, in numbered sections | 2026-11-26 | `api/store-api.md` |
| [stock-alerts.md](stock-alerts.md) | Back-in-stock emails ("Notify me"): the rules, the statuses, the calls, the errors, what the website and the admin panel do | 2026-11-26 | `features/stock-alerts.md` |
| [customer-auth.md](customer-auth.md) | Sign-up, sign-in and password recovery with email and password | 2026-10-18 | `features/customer-accounts.md` |
| [customer-accounts.md](customer-accounts.md) | The sign-up code, guest checkout, closing an account, address labels, the account overview, several wishlists, referrals, problem reports | 2026-11-16 | `features/customer-accounts.md`, `features/referrals.md`, `features/problem-reports.md` |
| [wishlist.md](wishlist.md) | The first wishlist: one list per customer, the preview for visitors, the merge | 2026-10-19 | `features/wishlist.md` |
| [product-display-order.md](product-display-order.md) | The admin's order of products and the three listing views | 2026-10-24 | `features/product-display-order.md` |
| [variant-images.md](variant-images.md) | Pictures per pack size | 2026-11-11 | `features/product-images.md` |
| [banners.md](banners.md) | The slides of the home page | 2026-10-19 | `features/banners.md` |
| [faq.md](faq.md) | Questions and answers | 2026-10-24 | `features/faq.md` |
| [blog.md](blog.md) | The blog | 2026-10-24 | `features/blog.md` |
| [legal-pages.md](legal-pages.md) | The six legal pages written in the admin panel | 2026-11-11 | `features/legal-pages.md` |
| [order-reviews.md](order-reviews.md) | One review per delivered order | 2026-11-02 | `features/order-reviews.md` |
| [rewards.md](rewards.md) | Loyalty coins | 2026-11-16 | `features/rewards.md` |
| [box-based-shipping.md](box-based-shipping.md) | Delivery by the box: the rule, the formulas, the settings | 2026-11-20 | `features/shipping/README.md` |
| [box-based-shipping-web-integration.md](box-based-shipping-web-integration.md) | The guide for the website: the bill of a cart, the sentences, the ten scenarios | 2026-11-20 | `features/shipping/retail-website.md` |

Not copied, and read in the backend's repository when needed: discount codes (`features/discount-codes.md`), returns (`features/returns.md`), payments and refunds (`features/payments-and-refunds.md`), invoices (`features/invoices.md`), the bill (`business-logic/bill-calculation.md`).

## 2. What the comments in the code call them

Comments in `src/`, `mocks/` and `e2e/` name these documents in two older ways. Both still lead here:

| A comment says | It means |
| --- | --- |
| `doc 7`, `(doc 20)`, `doc 9.2` | Section 7, 20 or 9.2 of [store-api.md](store-api.md). The backend's current reference numbers its sections the same way |
| `REWARDS 4`, `LEGAL_PAGES` and the like | A section of the document of that name below |
| A path that begins with `doc/` | The file of the table below |

| Old path | Now |
| --- | --- |
| `doc/CUSTOMER_WEB_API_DOCUMENTATION.md` | [store-api.md](store-api.md) |
| `doc/CUSTOMER_AUTH.md` | [customer-auth.md](customer-auth.md) |
| `doc/CUSTOMER_ACCOUNTS.md` | [customer-accounts.md](customer-accounts.md) |
| `doc/WISHLIST.md` | [wishlist.md](wishlist.md) |
| `doc/PRODUCT_DISPLAY_ORDER.md` | [product-display-order.md](product-display-order.md) |
| `doc/VARIANT_IMAGES.md` | [variant-images.md](variant-images.md) |
| `doc/BANNERS.md` | [banners.md](banners.md) |
| `doc/FAQ.md` | [faq.md](faq.md) |
| `doc/BLOG.md` | [blog.md](blog.md) |
| `doc/LEGAL_PAGES.md` | [legal-pages.md](legal-pages.md) |
| `doc/ORDER_REVIEWS.md` | [order-reviews.md](order-reviews.md) |
| `doc/REWARDS.md` | [rewards.md](rewards.md) |
| `doc/BOX_BASED_SHIPPING.md` | [box-based-shipping.md](box-based-shipping.md) |
| `doc/BOX_BASED_SHIPPING_WEB_INTEGRATION.md` | [box-based-shipping-web-integration.md](box-based-shipping-web-integration.md) |
| `doc/DISCOUNT_CODES.md` | Never copied into this repository: `radhe-api/docs/features/discount-codes.md` |
| `doc/DEPLOYMENT.md`, `doc/DEPLOYMENT_HOSTINGER.md`, `doc/DEPLOYMENT_VERCEL.md` | [deployment/](../../deployment/README.md) (the shop's own guides, not the backend's) |

## 3. The sections of the store reference

| Section | Topic | Section | Topic |
| --- | --- | --- | --- |
| 0 | Conventions | 13 | Status reference |
| 1 | Customer authentication | 14 | What depends on the server configuration |
| 2 | Customer account | 15 | Integration checklist |
| 3 | Delivery addresses | 16 | Wishlist |
| 4 | Unsubscribe link | 17 | Homepage banners |
| 5 | Health | 18 | FAQ |
| 6 | Shop settings and legal texts | 19 | Blog |
| 7 | Catalogue | 20 | Guest checkout |
| 8 | Cart | 21 | Referrals |
| 9 | Orders and checkout | 22 | Order reviews |
| 10 | Payments | 23 | Problem reports |
| 11 | Invoices and credit notes | 24 | Points and rewards (loyalty coins) |
| 12 | Returns | 25 | Box-based shipping |
| 26 | Back-in-stock emails ("Notify me") | 27 | Trustpilot (not built in the shop) |

## 4. Taking a new copy

When the backend hands over a document for a new feature, or the shop is rebuilt against a changed one: copy the document from `radhe-api/docs/` into this folder under a lower-case name, add or update its row in section 1 with the date, and commit it with the shop's change. Do not copy a document "to have it": a copy that nothing was built against only grows stale.
