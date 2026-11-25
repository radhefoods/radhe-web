# The mock API

`mocks/` is a stand-in for the backend (`radhe-api`) that runs on the development computer: `npm run dev:mock` starts it on port 3000. It answers in the shapes and with the error codes of the backend's documents ([reference/backend/](../reference/backend/README.md)), from fixtures kept in memory; a restart forgets everything. The unit tests, the browser tests, the smoke test and the build check all run against it.

The mock is not the authority: where it and the real API differ, the API is right and the mock is fixed. It reads its TypeScript at the start, so **restart it after changing a file of `mocks/`**.

## 1. What it holds

| File | Holds |
| --- | --- |
| `mocks/server.ts` | The server, every route of the store API, and the test controls |
| `mocks/state.ts` | The state in memory: customers, sessions, carts, orders, wishlists |
| `mocks/views.ts` | How the state becomes the answers of the API |
| `mocks/data/` | The fixtures: catalogue, banners, FAQ, blog, discount codes |
| `mocks/orders.ts`, `mocks/payments.ts` | Orders, the bill, and the page that stands in for Stripe Checkout |
| `mocks/shipping.ts` | A copy of the backend's rules of delivery by the box, switched off at the start |
| `mocks/discounts.ts`, `mocks/rewards.ts`, `mocks/issues.ts`, `mocks/content.ts`, `mocks/multipart.ts`, `mocks/errors.ts` | Discount codes, coins, problem reports, FAQ and blog, uploads, the error answers |
| `mocks/demo.ts` | The demo account with its orders |
| `mocks/testing.ts` | Helpers for tests that run the shop's API client against the mock |
| `mocks/*.test.ts` | Tests of the mock through the shop's own client: they hold the contract between the two |

## 2. Accounts

| What | How |
| --- | --- |
| Sign up | Any address with a password of eight or more characters. The API answers `202` and waits for the six-digit code of the email; the mock prints it in its terminal, and `GET /__mock/tokens?email=…` answers it as `signupCode` |
| Demo account | `demo@radhefoods.de` with the password in `mocks/demo.ts` (created at the first sign-in): a profile, an address and orders in every state |
| A blocked account | `blocked@example.com` answers "account blocked" with whatever password it is first given |
| Forgot password | The reset link is printed in the mock's terminal; `GET /__mock/tokens?email=…` answers its token as `passwordReset` |

## 3. Payment

"Buy now" and "Pay now" lead to a page of the mock that stands in for Stripe Checkout (`GET /__mock/stripe/{orderNumber}`): card pays at once, PayPal a few seconds after the return, cancel leads back to the order. Paying takes the stock, issues the invoice and empties the cart; a product that sold out meanwhile cancels the order. [Payments](../features/payments.md) describes what the shop does on the way back.

## 4. Sample data

| What | Values |
| --- | --- |
| Products | The fixtures of `mocks/data/catalogue.ts`: products in several pack sizes, one on sale, one sold out, one with eight units left, one with a minimum quantity, one at 19 % VAT, one without a picture. Pictures are generated placeholders labelled "mock picture" |
| Discount codes | `DIWALI10` (10 %), `WELCOME5` (5 € from 20 € of goods, once per customer), `NOSALE15` (not on reduced products), `FREESHIP` (free delivery), and one code for each refusal: `PAUSED`, `SOON`, `OLDTIMES`, `GONE`. Typed in any case |
| Banners | Fixtures of `mocks/data/banners.ts`: live, switched off and scheduled ones |
| FAQ and blog | Fixtures of `mocks/data/faq.ts` and `mocks/data/blog.ts` |

## 5. Environment of the mock

| Variable | Effect |
| --- | --- |
| `MOCK_PORT` | The port (`PORT` when unset, else 3000) |
| `MOCK_LATENCY_MS` | Every answer waits this long: `MOCK_LATENCY_MS=800 npm run dev:mock` shows the loading states |
| `MOCK_ACCESS_TTL_SECONDS` | How long a session's access lasts: `20` shows the refresh happen |
| `MOCK_STRIPE` | `off` starts the mock without online payment |
| `CORS_ORIGINS` | The origins the mock answers to; the shop on port 3001 when unset |
| `SHOP_URL` | Where the payment page sends the customer back to |

## 6. Test controls

Routes under `/__mock/` are not part of the real API. They do what an admin, Stripe or the passing of time would do, for tests and for looking at a state of the shop. All take JSON; the exact fields are beside each route in `mocks/server.ts`.

| Route | Does |
| --- | --- |
| `POST /__mock/reset` | Back to the fixtures: every test starts with it |
| `GET /__mock/tokens?email=…` | What the emails would carry: `signupCode`, `passwordReset`, `unsubscribe` (the token of the unsubscribe link), and the customer's `referralCode` |
| `POST /__mock/stock` | Sets the stock of a pack size (`variantId`, `quantity`) |
| `POST /__mock/price` | Changes the price of a pack size (`variantId`, `price`) |
| `POST /__mock/shipping` | Delivery by the box: `{ enabled: true }` switches it on; the same call sets `freeThresholdPerBox`, `maxBoxWeight`, `boxTareWeight`, `feeTiers`, `countries`, `overweight` and the weights of pack sizes (`weights: [{ variantId, shippingWeight, shipsSeparately }]`) |
| `POST /__mock/rewards` | Changes the rules of the coins or adjusts a balance |
| `POST /__mock/order` | Moves an order along: process, dispatch, deliver, refund |
| `POST /__mock/payment` | What Stripe would report about a payment page: settle, fail, expire |
| `POST /__mock/stripe` | Online payment configured or not |
| `POST /__mock/return` | The admin's decision about a return: approve, reject, complete |
| `POST /__mock/issue` | The admin's decision on a problem report: review, resolve, reject |
| `POST /__mock/review` | The admin's decision on an order review |
| `POST /__mock/customer` | Blocks or unblocks a customer |
| `POST /__mock/banners` | `{ enabled: false }` answers no banner at all |
| `POST /__mock/legal/publish` | Publishes a legal page that was a draft, or takes it back (`type`, `published`) |
| `POST /__mock/legal/republish` | Publishes a new version of a legal text |

## 7. Looking at the shop with real data

The built shop can read the deployed API without changing it: `API_INTERNAL_URL=https://api.radhefoods.de npm run start` makes the server pages ask the real API (public `GET` requests only), while the browser still talks to the mock. Pages keep their cached copy for their lifetime ([rendering and caching](../architecture/rendering-and-caching.md)), so a page shows the new source at its second request after that time.
