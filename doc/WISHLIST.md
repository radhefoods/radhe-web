# Wishlist

For the Customer Web agent. The wishlist of the Radhe Foods API as of 2026-10-19: what it stores, the endpoints, and how the shop uses it for visitors and for signed-in customers. Section 16 of `doc/CUSTOMER_WEB_API_DOCUMENTATION.md` is the short form.

**Strict rule for the frontend:** do not change the visual design of the shop. Add the heart to the existing product card and product page, and a wishlist page in the existing account and page layouts.

## 1. The model

- A wishlist holds **products**, one entry per product, at most 200. It is not per pack size: "Basmati Rice" is on the list once, whatever size the customer looked at.
- Each entry may remember the **pack size the customer had open** (`variantId`). It is a preference only: the list shows the product with that size while it is still sold, and with the size listings show otherwise (the smallest size in stock).
- **Visitors** keep the list in the browser (local storage), as an array of `{ productId, variantId? }`. The API renders it on request with `POST /v1/store/wishlist/preview` and stores nothing.
- **Signed-in customers** have the list on the server. It is private to the account and survives devices and sessions.
- Right after a sign-in or a sign-up, the shop sends the visitor's list to `POST /v1/store/wishlist/merge` once, then clears the local copy and uses the server list. Products already on the server list keep their remembered size; the others are added; nothing is doubled.
- Products that left the shop (set to draft, archived, deleted, or without any sold pack size) are left out of every answer and dropped from a stored list. Sold-out products stay on the list; their `ordering.canOrder` is `false`.

## 2. Endpoints

All answers have the same shape, the whole list at this moment, newest first:

```json
{
  "items": [
    {
      "productId": "66f1…",
      "variantId": "66f2…",
      "addedAt": "2026-10-19T09:30:00.000Z",
      "product": { "…the product as GET /v1/store/products lists it, with the remembered size selected…" }
    }
  ],
  "count": 1
}
```

`variantId` is `null` when no size is remembered or the remembered size is gone; `product.variantId` is then the size listings show. `addedAt` is `null` in a preview. `product` has the same fields as a product in `GET /v1/store/products` (section 7 of the API documentation): `id`, `variantId`, `slug`, `displayName`, `pricing`, `ordering`, `image`, `variants`, and so on. Pass `?locale=en|de` as on every store call.

### `POST /v1/store/wishlist/preview`

**Purpose:** Render a visitor's list. Nothing is stored. **Authentication:** none. Rate limit 60 per minute per IP.

**Request body:** `{ "items": [{ "productId": "66f1…", "variantId": "66f2…" }] }`, 1 to 200 items, product ids unique.

**Success:** `200`, the shape above with `addedAt: null`. Unknown products and products that left the shop are left out silently. **Errors:** `400 VALIDATION_FAILED`, `429 RATE_LIMITED`.

### `GET /v1/store/wishlist`

**Authentication:** customer session. **Success:** `200`, the list.

### `PUT /v1/store/wishlist/items/{productId}`

**Purpose:** Add a product, or change the remembered pack size of a product already on the list. **Authentication:** customer session.

**Request body:** `{ "variantId": "66f2…" }` or `{}`. The variant must be a sold pack size of that product.

**Success:** `200`, the list. **Errors:** `404 PRODUCT_NOT_FOUND` (unknown, or not in the shop), `404 PRODUCT_VARIANT_NOT_FOUND` (the size is not one of this product's, or is switched off), `400 WISHLIST_FULL` (`details: { maximum: 200 }`), `400 VALIDATION_FAILED`.

### `DELETE /v1/store/wishlist/items/{productId}`

**Success:** `200`, the list. Removing a product that is not on the list changes nothing.

### `DELETE /v1/store/wishlist`

**Purpose:** Empty the list. **Success:** `200`, `{ "items": [], "count": 0 }`.

### `POST /v1/store/wishlist/merge`

**Purpose:** Take over the visitor's list after sign-in or sign-up. **Authentication:** customer session.

**Request body:** as `preview`. **Success:** `200`, the merged list. Sending the same list again changes nothing; when the server list is full, the rest is dropped silently. **Errors:** `400 VALIDATION_FAILED` (duplicate product ids, more than 200 items).

## 3. How the shop uses it

**State.** Keep one wishlist store in the app: the array of `{ productId, variantId? }`. For a visitor it is read from and written to local storage. For a signed-in customer it is the `items` of the last API answer (`productId` and `variantId` of each entry). The heart on a product card is "on" when the product's `id` is in that array; no per-product API call is needed.

**Heart on a card or product page.** Toggle locally first, then call the API: `PUT …/items/{productId}` with the `variantId` of the size shown on the page (omit it on a card), or `DELETE …/items/{productId}`. For a visitor, change local storage only. Roll the toggle back if the call fails.

**Wishlist page.** Signed in: `GET /v1/store/wishlist`. Visitor: `POST …/preview` with the local array; if the array is empty, render the empty state without a call. Each entry's `product` is the same object product listings use, so the existing product card renders it. "Add to cart" on the page uses `product.variantId` with `PUT /v1/store/cart/items/{variantId}` (section 8). After a preview, replace the local array by the ids the answer returned, so entries that left the shop disappear locally too.

**After sign-in or sign-up.** If the local array is not empty, call `POST …/merge` once with it, then clear local storage and continue with the server list. Do this where the cart merge already happens.

**After logout.** Clear the in-memory list; local storage starts empty for the next visitor.

**Header count.** `count` from the last answer, or the length of the local array.

## 4. Checklist

- [ ] Heart on product cards and product pages, state from the local array, toggled through `PUT`/`DELETE …/items/{productId}` when signed in and local storage when not.
- [ ] Wishlist page using `GET /v1/store/wishlist` or `POST …/preview`, rendering `items[].product` with the existing product card, empty state without a call.
- [ ] `POST …/merge` once after sign-in and sign-up, next to the cart merge; local copy cleared afterwards.
- [ ] `404 PRODUCT_NOT_FOUND` and `400 WISHLIST_FULL` handled (toast, heart rolled back).
- [ ] `?locale=` on every call; no price or availability computed locally.
