# Product page

The page of one product, opened on one of its pack sizes: pictures, name, price, the choice of size, the button that adds it to the cart, what delivery and payment are like, the product's texts, and more products to go on with. It is one page for every pack size of the product: each size has an address of its own, and choosing another size changes the page in place.

| | |
| --- | --- |
| **Status** | Implemented |
| **Since** | Phase 2 of the original plan, before 2026-10-11 (the log gives no day); one page for all pack sizes since 2026-10-16, this layout since 2026-10-31, pictures per pack size since 2026-11-11 |
| **Pages** | `/en/products/[slug]` · `/de/produkte/[slug]` |
| **Code** | `src/app/[locale]/(shop)/products/[slug]/page.tsx`, `src/components/catalogue/product-purchase.tsx`, `src/components/catalogue/product-gallery.tsx`, `src/components/catalogue/purchase-info.tsx`, `src/lib/catalogue/pictures.ts` |
| **API** | [Catalogue](../api/endpoints.md#catalogue), [Settings](../api/endpoints.md#settings-and-legal-texts) |
| **State** | The address bar (the pack size); the chosen size and picture in component state; the fresh stock in the TanStack Query cache (`product-ordering`) |
| **Texts** | `product`, `home`, `common`, `nav`, `catalogue` |
| **Tests** | `e2e/catalogue.spec.ts` ("languages and addresses", "the cart of a visitor", "the shop at a glance"), `src/lib/catalogue/pictures.test.ts`, `src/lib/seo/title.test.ts`, `src/lib/seo/json-ld.test.ts`, `src/features/catalogue/availability.test.ts` |
| **Backend reference** | [store-api.md](../reference/backend/store-api.md) (section 7), [variant-images.md](../reference/backend/variant-images.md), [product-display-order.md](../reference/backend/product-display-order.md) |

## What the customer sees

From `md` two columns: the pictures at the left, kept in view while the right column scrolls. On phones one column in the same order.

| # | Region | Content | Shown when |
| --- | --- | --- | --- |
| 1 | Breadcrumbs | "Home", the product's categories, the product's name | Always |
| 2 | Gallery | The large picture of the chosen size on a white tile, the wishlist heart in its corner, thumbnails under it | Thumbnails with 2 or more pictures; without a picture the Radhe mark with "coming soon" |
| 3 | Chips | The category (a link to its page), the brand, the discount of the chosen size ("−20%") | Each when there is one |
| 4 | Headline | The name with the chosen size: "Basmati Rice (5kg)" | Always |
| 5 | Subtitle | The product's `subtitle`, else its `shortDescription` | When there is one |
| 6 | Price | The price of the chosen size, the regular price struck through when reduced, then "€4.00 / kg · Tax included." (the note links to "Delivery and payment") | Always |
| 7 | Pack sizes | "Pack size" with the chosen size, and one segment per size showing the size and its price per unit | The product has 2 or more sizes |
| 8 | Add to cart | The button "Add to cart", full width; the stepper once the size is in the cart | The size can be ordered; else a pill "Sold out" or "Currently not available" |
| 9 | Stock and delivery | "In stock" behind a green dot, or "Only N left" in wheat; the delivery estimate of the settings behind a truck | The size can be ordered |
| 10 | Limits | "At most {count} per order", "Minimum order: {count}" | See the rules |
| 11 | Delivery and payment | One frosted container: free delivery or the fee, the secure payment with the marks of Visa, Mastercard, American Express and PayPal, and "All about delivery and payment" | Always |
| 12 | "About this product" | The description and "Good for" with the uses as chips; folded | There is a description or a use |
| 13 | "Product details" | Ingredients, Allergens, Nutrition, Storage, Origin, Brand / manufacturer, Item number; folded | Always; a row without a value is left out, the item number is always there |
| 14 | "More from {category}" | Up to 12 [cards](product-card.md) of other products, one per product, with "View all" to the category | The category holds another product |
| 15 | "Popular right now" | The popular products of the [home page](home.md), without this product | There is one |
| 16 | "Shop by category" | The categories with products as cards, with "All products" | There is one |

On phones a bar fixed above the tab bar repeats the name with the size, the price and the add control, so the button is always in reach.

### States

| State | What shows |
| --- | --- |
| The chosen size is sold out or switched off | The pill in the button's place (also in the phone bar); no stock line and no limits. The price, the pictures and the other sizes stay |
| Another size cannot be ordered | Its segment says "Sold out" or "Currently not available" in the place of its price per unit; it can still be chosen |
| A picture's file is gone | The Radhe mark in its place, never the browser's sign for a broken picture (`ProductImage`) |
| The product, or the size of the address, does not exist | The 404 page ([Error pages](error-pages.md)). A size Radhe Foods switched off is not listed and its address answers 404 |
| The API does not answer | The error page with "Try again" |
| The related products or the popular products cannot be read | That row is left out |
| The fresh stock cannot be read | The page keeps the stock it was rendered with |

## Rules

### Addresses

| Case | What happens | Decided by |
| --- | --- | --- |
| The address of a size | The slug of that size in the page's language: `/en/products/basmati-rice-5kg` · `/de/produkte/basmati-reis-5kg` | The API gives the slugs |
| The base slug of the product (`basmati-rice`) | A permanent redirect to the default size (`basmati-rice-1kg`) | The API picks the size, the shop redirects |
| The slug of the other language under this language's address | A permanent redirect to this language's slug | The shop |
| The language switch | Leads to the same size in the other language, also after the size was changed on the page (`LocaleAlternates`) | The browser |

### Choosing a pack size

Every size came with the page, so a change needs no request. A segment is a link to the size's own address (it opens in a new tab with a modifier key, and a crawler can follow it); a plain click switches in place (`select` in `PackSizes`).

| Changes with the size | Stays |
| --- | --- |
| Headline, discount chip, price with regular price and price per unit, pictures (starting at the size's main picture), the marked segment, add control and its quantity, stock line, limits, item number, the size the heart remembers, the phone bar | Breadcrumbs, chips of category and brand, subtitle, the two texts, delivery and payment, the rows below |
| The address (`history.pushState`) and the title of the tab | The description, canonical address and structured data the server sent for the size of the first address |

Back and forward move between the sizes that were looked at, still without a request.

**Worked example.** `/en/products/basmati-rice-1kg` shows "Basmati Rice (1kg)", "€5.99 / kg" and the item number `RF-00041` (the mock's data). A click on the segment "5kg" changes the headline to "Basmati Rice (5kg)", the price to €19.99 with "€4.00 / kg", the item number to `RF-00042`, the beginning of the tab's title to "Basmati Rice (5kg)" and the address to `/en/products/basmati-rice-5kg`; the page is not loaded again. Back restores the 1 kg size.

### Price, stock and limits

| Case | What shows | Decided by |
| --- | --- | --- |
| Price, regular price, discount, price per unit | Printed as answered for each size | The API ([Prices and availability](../business-logic/prices-and-availability.md)) |
| Can the size be ordered | `ordering.canOrder`, asked again when the page opens | The API |
| "Only N left" | `ordering.remaining` is 10 or fewer | The API counts; the threshold is the shop's |
| "At most {count} per order" | `maxQuantity` is below `remaining`: the product's own limit caps the quantity, not the stock (`cappedByLimit`) | The API sets, the browser compares |
| "Minimum order: {count}" | `minQuantity` is above 1 | The API sets |
| The first press of "Add to cart" | Puts the minimum quantity into the cart; the stepper goes up to `maxQuantity` | The API sets, the browser applies |

**Worked example.** `ordering: { canOrder: true, minQuantity: 1, maxQuantity: 12, remaining: 37 }` shows "In stock" and "At most 12 per order". With `remaining: 8, maxQuantity: 8` it shows "Only 8 left" and no limit line.

### Delivery and payment

Every number comes from the settings; nothing is promised that the API does not say (`PurchaseInfo`).

| Settings | First row | Its second line |
| --- | --- | --- |
| A free-delivery amount above 0 | "Free delivery across Germany" | "Free from {amount}" |
| The same, delivery priced by the box | "Free delivery across Germany" | "Free from {amount} per box (up to {weight})" |
| No free-delivery amount, a fee above 0 | "Delivery across Germany" | "Delivery {fee} per order", or "… per box (up to {weight})" |
| No free-delivery amount, a fee of 0 | "Free delivery across Germany" | None |
| The settings cannot be read | "Delivery across Germany" | None |

The second row is always "Secure payment at checkout", "Card or PayPal on the secure page of Stripe" and the four marks. With the mock the first row reads "Free delivery across Germany" and "Free from €50.00". The delivery rules themselves are in [Shipping](shipping.md), the payment in [Payments](payments.md).

### Related products

"More from {category}" asks for the products of the product's own category (the last breadcrumb); when that holds nothing else, for those of its top-level category. It asks for 13 products with `view=product`, takes this product out and shows up to 12.

## Data and API

```
server   GET /v1/store/products/{slug}                 404 → not found; other slug → redirect
         GET /v1/store/products?category=…&view=product&limit=13     related (up to two tries)
         GET /v1/store/products?featured=true&limit=8   popular (else ?limit=8)
         GET /v1/store/settings · GET /v1/store/categories
browser  GET /v1/store/products/{slug}                 when the page opens: fresh stock and pictures
```

| Call | Cached | On failure |
| --- | --- | --- |
| The product, on the server | 300 s, tag `catalogue` | `PRODUCT_NOT_FOUND` or `NOT_FOUND`: the 404 page; anything else: the error page |
| Related, popular | 300 s | The row is left out |
| Settings, categories | 300 s | The estimate and the numbers are left out; no category tiles |
| The product, from the browser | Fresh for 30 s in the tab | Ignored: the page's own data stays |

The page is not built ahead of time: it is rendered at the first visit and kept for 300 seconds (`revalidate = 300`).

**How stock stays current on a cached page.** A cached page can be five minutes old, and nothing is reserved before a payment. `PackSizes` therefore asks the API for the product when the page opens (one request for all sizes) and takes two things from the answer for every size: its `ordering` (button, stock line, limits, the picker's "Sold out") and its pictures (`currentGalleryOf`: the API deletes a picture's file when the admin replaces it). Until the answer is there the page shows what it was rendered with. The name, the texts and the prices stay those of the page; the cart and the checkout always price with the API ([Cart and bill](../business-logic/cart-and-bill.md)).

**For search engines.** The title names the pack size of the address (`productPageTitle`); the description is the admin's, else the short description, else the beginning of the description, else a sentence of the shop. Structured data: a `ProductGroup` with one `Product` per size (address, item number, price, in stock or out of stock, its own pictures) and a `BreadcrumbList`. More in [SEO](../architecture/seo.md).

## Behaviour

- **Gallery.** A thumbnail is a button "Picture 2 of 3" and shows its picture in the large tile; the chosen one is ringed in leaf. The first picture loads at once; the main pictures of the other sizes are fetched when the page is idle (not on a connection that asks to save data), so a change of size shows its picture at once. A size without a picture never shows the picture of another size.
- **Picker.** The chosen segment is the white thumb of the bar and carries `aria-current="page"`; a reduced size shows its price per unit in red.
- **Folding texts.** Both are native `details`, closed when the page opens, and in the HTML whether open or not.
- **Add to cart.** The picture flies into the cart as from a card ([Product card](product-card.md)); "Added" is spoken.

## Not built

- Reviews or stars of a product: customers review orders ([Reviews](reviews.md)).
- A "notify me when back in stock" control.
- A nutrition table: nutrition is the admin's plain text.
- Zoom or a full-screen view of the pictures; videos.
- A quantity field before adding: the button adds the minimum, the stepper changes it.
- The product's `highlights`, which the API sends and the page does not show.
- The GTIN on the page (it is in the structured data only), share buttons, "recently viewed".
- A page per brand: the brand chip is text.

## Code map

| File | What it is |
| --- | --- |
| `src/app/[locale]/(shop)/products/[slug]/page.tsx` | The page: reads the product, redirects, lays out the regions, metadata and structured data, related and popular rows |
| `src/components/catalogue/product-purchase.tsx` | `PackSizes` (the chosen size, fresh stock and pictures) and the parts that follow it: `PackSizeGallery`, `PackSizeHeadline`, `PackSizeDiscount`, `PackSizePrice`, `PackSizePicker`, `PackSizeSku`, `PackSizeWishlist`, `ProductPurchase` |
| `src/components/catalogue/product-gallery.tsx` | `ProductGallery` and `usePicturesAhead` |
| `src/components/catalogue/purchase-info.tsx` | `PurchaseInfo`: delivery and payment |
| `src/components/catalogue/payment-marks.tsx` | The four payment marks as drawings |
| `src/components/catalogue/add-to-cart.tsx`, `src/components/catalogue/price.tsx` | The button with its stepper and pill; the price block |
| `src/components/catalogue/breadcrumbs.tsx`, `src/components/catalogue/category-tiles.tsx`, `src/components/home/product-row.tsx`, `src/components/ui/disclosure.tsx` | Shared parts: breadcrumbs, "Shop by category", the rows, the folding texts |
| `src/lib/catalogue/pictures.ts` | `packSizesOf`, `galleryOf`, `currentGalleryOf`, `mainPicturesOfOtherSizes`, `srcSetOf` |
| `src/features/catalogue/availability.ts` | `orderingReason`, `fewLeft`, `cappedByLimit` |
| `src/lib/seo/title.ts` | `productPageTitle` |
| `src/lib/seo/json-ld.tsx` | `productJsonLd`, `breadcrumbJsonLd` |
