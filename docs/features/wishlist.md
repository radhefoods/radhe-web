# Wishlist

The wishlist keeps products for later. A heart on every product saves it; the wishlist page shows what is saved as the cards of the catalogue. Every visitor has a list: a visitor's is kept in the browser, a signed-in customer's by the API, and a customer may keep several lists under names of their own.

| | |
| --- | --- |
| **Status** | Implemented |
| **Since** | 2026-10-19. Several named lists: 2026-11-01 |
| **Pages** | `/en/wishlist` · `/de/merkliste` |
| **Code** | `src/app/[locale]/(shop)/wishlist/page.tsx`, `src/components/wishlist`, `src/features/wishlist`, `src/lib/wishlist`, `src/components/catalogue/wishlist-button.tsx` |
| **API** | [Wishlist](../api/endpoints.md#wishlist) |
| **State** | `localStorage` `rf.wishlist.v1` for visitors; the API for customers, cached under the query keys `["wishlist", locale]` (the default list), `["wishlists"]` (the lists) and `["wishlist", "named", id, locale]` (a named list); the context of `WishlistProvider` |
| **Texts** | `wishlist`; `product` (`wishlistSave`, `wishlistRemove`, `wishlistSaved`, `wishlistRemoved`, `wishlistFull`); `nav` (`wishlist`, `wishlistWithCount`) |
| **Tests** | `e2e/wishlists.spec.ts`, `e2e/catalogue.spec.ts` (a visitor saves a product), `e2e/polish.spec.ts` (the heart of the header), `src/lib/wishlist/guest-wishlist.test.ts`, `mocks/wishlists.test.ts` |
| **Backend reference** | [reference/backend/wishlist.md](../reference/backend/wishlist.md); for several lists [reference/backend/customer-accounts.md](../reference/backend/customer-accounts.md) and [reference/backend/store-api.md](../reference/backend/store-api.md), section 16 |

## What the customer sees

### The heart

`WishlistButton` is one control in three looks:

| Where | Look | What it saves |
| --- | --- | --- |
| The top corner of the picture of a product card (`src/components/catalogue/product-card.tsx`) | A small round button of soft glass (`tile`) | The product, without a pack size |
| The corner of the picture on the product page (`PackSizeWishlist` in `src/components/catalogue/product-purchase.tsx`) | A larger round button of glass (`box`) | The product with the pack size that is chosen on the page |
| The end of a line of the cart, beside the bin (`src/components/cart/cart-view.tsx`) | A quiet round button (`plain`) | The product with the pack size of the line; the line stays in the cart |

A tap toggles the heart at once: it fills red and pops when the product is saved, and empties when it is taken off. The button is a toggle for assistive technology (`aria-pressed`), named "Save to wishlist: {name}" or "Remove from wishlist: {name}"; after a tap a screen reader hears "Saved to your wishlist" or "Removed from your wishlist" once.

A product counts once on a list, whatever its sizes: the heart of every card and page of that product is filled. Saving it again from another size changes the remembered size and keeps its place.

When a save does not go through, the heart turns back and a toast says why for eight seconds (`src/components/catalogue/wishlist-problem.tsx`): "Your wishlist is full (200 products). Remove one to save another." or the text of the API's error.

### The heart of the header

For everyone, signed in or not: a heart that leads to the wishlist page, with the number of saved products in a wheat bubble ("99+" above 99) and a spoken label that carries the count ("Wishlist, 1 product", "Wishlist, empty"). For a customer the number is that of the default list. The account's navigation and its overview link to the same page ([account](account.md)).

### The wishlist page of a visitor

| State | What shows |
| --- | --- |
| Loading | The title "Your wishlist" and four grey cards |
| Empty | A heart icon, "Nothing saved yet", "Tap the heart on a product to keep it here for later.", the button "Browse the range" |
| The products could not be read | "We could not load your wishlist." with the error's text and a retry |
| Products | "{count} products"; "Remove all"; a frosted line "Sign in to keep your wishlist on every device." with "Sign in" (which returns here); the products as a grid of product cards, newest first |

"Remove all" asks once more in its place: "Remove all {count} products?" with "Yes, remove" and "Keep".

### The wishlist page of a customer

| Region | Content |
| --- | --- |
| Title | The name of the chosen list; "Your wishlist" while the lists are not known |
| The lists | A row of frosted pills, one per list: a star on the default one, the name, the count. At its end "New list", while fewer than 20 lists exist. The row scrolls sideways on phones |
| This list | "Rename"; "Make default" (not on the default list); "Delete list"; on the default list the note "The heart on a product saves to this list." |
| Count and "Remove all" | As for a visitor, while the list has products |
| The products | The cards of the catalogue, each as the pack size it was saved from, and under each card its actions |

Under a card:

| Action | Shown | What it does |
| --- | --- | --- |
| "Move to …" | While the customer has another list | A choice of the other lists; the product leaves this list for the chosen one |
| "Copy to …" | The same | The product is on both afterwards |
| "Remove from this list" | On a named list | Takes the product off that list |

On the default list the heart on the card takes the product off. On a named list the heart still stands for the default list alone, which is why the named list has its own "Remove".

The names are asked for in a sheet: "New list" with the field "Name of the list" (up to 40 characters), "Create" and "Cancel"; "Rename the list" with "Save". "Delete list" asks in a sheet: "Delete the list "{name}"?", how many products are taken off it, "The products stay in the shop.", "Yes, delete" and "Cancel".

| State | What shows |
| --- | --- |
| Loading | Four grey cards under the title |
| The chosen list is empty | The empty state of a visitor |
| The lists could not be read | "We could not load your wishlist." above; the default list still shows, without the row of lists |
| The products could not be read | "We could not load your wishlist." with a retry |
| An empty name | "Please give the list a name." at the field |
| A name another list has (`409 WISHLIST_NAME_TAKEN`) | "You already have a list with this name." at the field |
| Any other refusal of a change | The error's text in the sheet, or under the row of lists, or under the card |
| An API without named lists | The one list, without the row of lists and without actions under the cards |

### From the wishlist into the cart

Every card on the page is the product card of the catalogue, with its basket ([product card](product-card.md)). Adding from there puts the pack size into the cart and leaves the product on the list. There is no "move to cart".

## Rules

| Case | What happens | Decided by |
| --- | --- | --- |
| A visitor saves a product | Written to `localStorage` at the front of the list (newest first) | The browser (`src/lib/wishlist/guest-wishlist.ts`) |
| A visitor saves a product that is on the list | The remembered size changes; the place stays | The browser |
| A visitor's list holds 200 products (`WISHLIST_MAX`) | Another product is refused with `wishlist_full` | The browser, mirroring the API's limit |
| What is read from storage | Never trusted: `sanitizeWishlist` drops what is not an array, entries whose `productId` is not 24 hexadecimal characters, a second entry of the same product, a `variantId` that is not an id, and everything after the 200th entry | The browser |
| A customer saves or removes | The heart turns at once; the call follows; when it fails the list is read again and the heart turns back | The browser shows; the API stores |
| Which products a list shows, their prices, pictures and availability | The API's list entries, with the remembered size selected | The API |
| A product that left the shop | After a preview, the browser's list follows the answer: what the API no longer lists leaves the stored list too | The browser, from the API's answer |
| The limits of a customer: 200 products per list, 20 lists, names of up to 40 characters, unique per customer | Refused by the API; the shop hides "New list" at 20 lists and stops the name field at 40 characters | The API ([customer-accounts.md](../reference/backend/customer-accounts.md)) |
| Which list is the default after one is deleted | The API's choice | The API |
| What just left the default list | Disappears from the page at once, before the API answered | The browser |

The browser computes nothing but the count: the number of entries of the list.

### Signing in

| Moment | What happens |
| --- | --- |
| A visitor with a list signs in or signs up | Once per page load the browser's list is sent with `POST /v1/store/wishlist/merge`. The answered list becomes the cached default list, the key `rf.wishlist.v1` is removed, and every open heart is told. The page shows its placeholder until then |
| The hand-over fails | The browser's list stays and is sent again at the next page load; the customer goes on with the stored list, and the error shows as a toast |
| The customer signs out | The page is loaded afresh. The lists stay with the account; the visitor starts with whatever the browser holds, which is nothing after a hand-over that went through |

How the two lists are merged (a saved product keeps its size, nothing is doubled) is the API's ([wishlist.md](../reference/backend/wishlist.md)).

## Data and API

| Who | When | Call |
| --- | --- | --- |
| Visitor | A tap on a heart | None: `localStorage` |
| Visitor | The wishlist page, with at least one product | `POST /v1/store/wishlist/preview` with the stored entries; nothing is stored by the API. Asked again when the list changes; the old answer stays until the next one is there |
| Customer | Any page | `GET /v1/store/wishlist`, the default list, asked together with the session |
| Customer | A tap on a heart | `PUT /v1/store/wishlist/items/{productId}` with `{ variantId }` or `{}`; `DELETE /v1/store/wishlist/items/{productId}` |
| Customer | "Remove all" on the default list | `DELETE /v1/store/wishlist` |
| Customer | After sign-in | `POST /v1/store/wishlist/merge` |
| Customer | The wishlist page | `GET /v1/store/wishlists` (the lists); `GET /v1/store/wishlists/{id}` for a named list |
| Customer | New, rename, make default, delete | `POST /v1/store/wishlists`, `PATCH /v1/store/wishlists/{id}` with `{ name }` or `{ isDefault: true }`, `DELETE /v1/store/wishlists/{id}` |
| Customer | Move, copy, remove, "Remove all" on a named list | `POST /v1/store/wishlists/{id}/items/{productId}/transfer` with `{ to }` or `{ to, copy: true }`; `DELETE /v1/store/wishlists/{id}/items/{productId}`; `DELETE /v1/store/wishlists/{id}/items` |

Every answer of a list endpoint is the whole list and replaces the cached one. Answers are kept for 30 seconds. After a change of the lists, the lists and the account's counts are read again, and the default list too when it was touched (`useWishlistsRefresh` in `src/features/wishlist/wishlists.ts`). The page itself renders nothing of a list on the server: it is read in the browser, and the page is not for search engines.

## Behaviour

- **Layout.** The products stand in the grid of the catalogue: two cards across on phones, up to five on wide screens.
- **Other tabs.** A visitor's list follows a change made in another tab of the browser (`storage` event).
- **Keyboard and screen reader.** The row of lists is a navigation named "Your lists", the chosen pill is marked as current, the star reads "Default". The actions of a list are a group named "This list". "Move to …" and "Copy to …" are native selects, named "Move {name} to another list" and "Copy {name} to another list". The name field of a sheet has the focus when the sheet opens ([components](../design-system/components.md) for the sheet itself).
- **Motion.** The heart pops once when it fills ([motion](../design-system/motion.md)).

## Not built

| Not in the shop | Note |
| --- | --- |
| "Move to cart", "Add all to cart" | The basket of each card adds; the product stays on the list |
| Saving straight into a named list from a product | The heart saves to the default list; a product reaches a named list by "Move to …" or "Copy to …". The client has `saveWishlistItemTo` for the API's endpoint; no page calls it |
| Named lists for visitors | One list in the browser |
| Sharing a list, a public link | – |
| A note, a wanted quantity or a priority per product | – |
| A message when a saved product is back in stock or reduced | – |
| Sorting or filtering the list | Newest first, as the API answers |
| A wishlist tab in the phone tab bar | The heart is in the header |

## Code map

| File | What it is |
| --- | --- |
| `src/app/[locale]/(shop)/wishlist/page.tsx` | The page: the texts of the area and the view |
| `src/components/wishlist/wishlist-view.tsx` | `WishlistView`: the visitor's page, the customer's page, the empty state, "Remove all" |
| `src/components/wishlist/wishlist-lists.tsx` | `WishlistLists`: the row of lists, the actions of a list, the sheets for a name and for deleting |
| `src/components/wishlist/wishlist-item-actions.tsx` | `WishlistItemActions`: "Move to …", "Copy to …", "Remove from this list" |
| `src/components/catalogue/wishlist-button.tsx` | `WishlistButton`, the heart |
| `src/components/catalogue/wishlist-problem.tsx` | The toast for a save that failed |
| `src/components/shell/wishlist-link.tsx` | The heart of the header and its bubble |
| `src/features/wishlist/wishlist.tsx` | `WishlistProvider`, `useWishlist` (the default list for both kinds of visitor, the hand-over on sign-in), `useWishlistProducts` |
| `src/features/wishlist/wishlists.ts` | The named lists: `useWishlists`, `useNamedWishlist`, `useWishlistsRefresh`, `useStoreWishlist` |
| `src/lib/wishlist/guest-wishlist.ts` | The visitor's list in `localStorage`: limits, `sanitizeWishlist`, `saveProduct`, `removeProduct` |
| `src/lib/api/types.ts` | `Wishlist`, `WishlistItem`, `WishlistSummary`, `WishlistEntryInput` |
