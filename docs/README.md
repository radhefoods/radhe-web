# Radhe Foods retail website: documentation

The customer shop of Radhe Foods, `www.radhefoods.de`: an online shop for Indian groceries in Germany, sold from stock and paid at checkout, in English and German. Next.js, React, TypeScript, Tailwind CSS. The shop has no database: everything it shows and every order it places goes through the Radhe Foods API (`radhe-api`).

This folder is the one place where the shop is documented. The code is the source of truth; these documents are checked against it ([how](development/documentation-standard.md)).

## Start here

| You are | Read first | Then |
| --- | --- | --- |
| **New to the project** | [architecture/overview.md](architecture/overview.md) | [features/README.md](features/README.md), [development/getting-started.md](development/getting-started.md) |
| **Changing a page or a feature** | Its document in [features/](features/README.md) | [development/conventions.md](development/conventions.md), [business-logic/README.md](business-logic/README.md), [development/testing.md](development/testing.md) |
| **Changing how something looks** | [design-system/README.md](design-system/README.md) | [design-system/components.md](design-system/components.md), [design-system/accessibility.md](design-system/accessibility.md). The look is the owner's: ask first |
| **Connecting to the API** | [api/README.md](api/README.md) | [api/endpoints.md](api/endpoints.md), [reference/backend/](reference/backend/README.md) |
| **Releasing or running the shop** | [deployment/README.md](deployment/README.md) | [architecture/configuration.md](architecture/configuration.md) |
| **A coding agent** | This page, then [features/README.md](features/README.md) for what exists and in which state | [development/conventions.md](development/conventions.md) for the rules of the work; the "Code map" at the end of each feature document; [architecture/routing.md](architecture/routing.md) for every page with its file |

## What is where

| Folder | Holds |
| --- | --- |
| [features/](features/README.md) | One document per feature a customer sees or uses: what it shows, its rules, its calls, its states, its code map. **The state of every feature** |
| [business-logic/](business-logic/README.md) | The index of every rule the browser applies, and the rules that run through several features: prices and availability, the cart and the bill, forms and validation |
| [api/](api/README.md) | How the shop talks to the API: the client, the session, caching, every endpoint it calls, errors |
| [architecture/](architecture/overview.md) | How the shop is built: structure, routes, rendering and caching, state, security, configuration, languages, search engines, performance |
| [design-system/](design-system/README.md) | Colours, type, Liquid Glass, components, motion, icons and images, responsive layout, accessibility |
| [development/](development/getting-started.md) | Getting started, the mock API, testing, conventions, the documentation standard and the template of a feature document |
| [deployment/](deployment/README.md) | The two hosts (Hostinger, Vercel), the build check, changing the host |
| [decisions/](decisions/README.md) | The decision log: what the owner decided and why |
| [reference/backend/](reference/backend/README.md) | Copies of the backend's documents the shop was built against, and what "doc N" in a code comment means |
| [archive/](archive/README.md) | What no longer describes the shop, and the record of how this folder was reorganised |
| [tools/](tools/check-docs.mjs) | The checker of the documentation |

## Features

The state of each one (implemented, partially implemented, planned, deprecated) is in [features/README.md](features/README.md).

**Browsing**

| | |
| --- | --- |
| [Home page](features/home.md) | The banners, the delivery promise, popular products and categories, a row per category, what customers say |
| [Header, navigation and footer](features/header-navigation-footer.md) | The frame of every page: the header, the category bar with its panels, the menu and tab bar on phones, the footer, the cookie notice |
| [Search](features/search.md) | The search field with its live dropdown, and the results |
| [Catalogue](features/catalogue.md) | Product lists, categories, brands, filters, sorting, pages |
| [Product card](features/product-card.md) | The card of every list, with its basket that opens and says "Add" |
| [Product page](features/product-page.md) | Gallery, pack sizes, price, stock, add to cart, related products |

**Buying**

| | |
| --- | --- |
| [Wishlist](features/wishlist.md) | The heart, the wishlist of a visitor and the lists of a customer |
| [Cart](features/cart.md) | The cart page, the summary, the cart in the header |
| [Checkout](features/checkout.md) | Ordering as a customer or as a guest, the address, the consent, "Buy now" |
| [Shipping](features/shipping.md) | The flat delivery fee with its free-delivery hint, and delivery by the box |
| [Discount codes](features/discount-codes.md) | Codes at the checkout |
| [Payments](features/payments.md) | The way to Stripe Checkout and back |

**The customer's account**

| | |
| --- | --- |
| [Authentication](features/authentication.md) | Sign-up with an emailed code, sign-in, password reset, sign-out |
| [Account](features/account.md) | The overview, the profile, saved addresses, closing the account |
| [Orders](features/orders.md) | Order history, the order page with its progress, invoices, the guest's order page |
| [Returns and problem reports](features/returns-and-reports.md) | Sending goods back; reporting what went wrong with a delivery |
| [Rewards](features/rewards.md) | Loyalty coins: earning, the balance, redeeming at the checkout |
| [Referrals](features/referrals.md) | The referral code and link |
| [Reviews](features/reviews.md) | One review per delivered order, and what customers say |

**Content and help**

| | |
| --- | --- |
| [Blog](features/blog.md) | Articles, categories and tags |
| [FAQ](features/faq.md) | Questions and answers |
| [Legal pages](features/legal-pages.md) | Imprint, terms, privacy, withdrawal, shipping, refunds, cookies |
| [Help and support](features/help-and-support.md) | "How it works", "Delivery and payment", and the ways to reach Radhe Foods |
| [Email unsubscribe](features/email-unsubscribe.md) | The page behind the unsubscribe link of an email |
| [Error pages](features/error-pages.md) | Not found, a page that failed, the API away |

## Business logic

| | |
| --- | --- |
| [Index of the rules](business-logic/README.md) | Every rule the browser applies, with the document that explains it, and what the API decides instead |
| [Prices and availability](business-logic/prices-and-availability.md) | How prices, discounts, prices per unit, names and pack sizes are shown; what can be ordered and in which quantity |
| [The cart and the bill](business-logic/cart-and-bill.md) | The guest's cart, the customer's cart, the rows of the bill, line issues |
| [Forms and validation](business-logic/forms-and-validation.md) | Every form with its rules and messages |

## API

| | |
| --- | --- |
| [The client](api/README.md) | Base addresses, the session, the locale, caching on the server and in the browser, the main types |
| [Endpoints](api/endpoints.md) | Every endpoint the shop calls: method, path, what is sent and answered, who calls it |
| [Error handling](api/error-handling.md) | The error model, the texts of the codes, what the pages do when the API is away |
| [Backend reference](reference/backend/README.md) | The backend's own documents, as copied |

## Architecture

| | |
| --- | --- |
| [Overview](architecture/overview.md) | The stack, the folders, how a request becomes a page |
| [Routing](architecture/routing.md) | Every page with its file and its two addresses, the route groups, the proxy |
| [Rendering and caching](architecture/rendering-and-caching.md) | What the server renders and how fresh it is, what the browser renders |
| [State management](architecture/state-management.md) | Contexts, TanStack Query, browser storage, the address bar |
| [Authentication and security](architecture/authentication-and-security.md) | The session, security headers and the Content Security Policy, what is public |
| [Configuration](architecture/configuration.md) | Environment variables, switches, `next.config.ts` |
| [Internationalization](architecture/internationalization.md) | English and German: texts, localised addresses, the language switch, formats |
| [SEO](architecture/seo.md) | Metadata, canonical addresses, hreflang, the sitemap, robots, structured data |
| [Performance](architecture/performance.md) | Images, fonts, caching, prefetching, the build |

## Design system

| | |
| --- | --- |
| [Foundations](design-system/README.md) | The owner's rule on the look, colours, typography, spacing, radii, shadows, breakpoints |
| [Liquid Glass](design-system/liquid-glass.md) | The glass surfaces, and what stays solid |
| [Components](design-system/components.md) | The base components and the shared building blocks |
| [Motion](design-system/motion.md) | Every animation and transition, and reduced motion |
| [Icons and images](design-system/icons-and-images.md) | The icon set, the logo, product pictures |
| [Responsive layout](design-system/responsive-layout.md) | Breakpoints, grids, what changes on phones |
| [Accessibility](design-system/accessibility.md) | Focus, keyboard, labels, contrast, what the tests cover |

## Development and release

| | |
| --- | --- |
| [Getting started](development/getting-started.md) | Requirements, setup, running the shop, every script |
| [The mock API](development/mock-api.md) | The stand-in for the backend: accounts, payment, sample data, test controls |
| [Testing](development/testing.md) | Every check, the browser tests, what no check sees |
| [Conventions](development/conventions.md) | The owner's rules, the way from a request to a release, the habits of the code |
| [Documentation standard](development/documentation-standard.md) | How these documents are written and kept true; the [template](development/feature-template.md) of a feature document |
| [Deployment](deployment/README.md) | The branches, the build check, changing the host; [Hostinger](deployment/hostinger.md); [Vercel](deployment/vercel.md) |
| [Decisions](decisions/README.md) | The index of the [decision log](decisions/decision-log.md) |

## Keeping this true

```bash
node docs/tools/check-docs.mjs
```

checks that links resolve, that every file a document names exists, and that every page, every endpoint the client calls, every environment variable and every area of the code is documented. A change to the shop changes its document in the same commit ([standard](development/documentation-standard.md#6-keeping-it-true)).
