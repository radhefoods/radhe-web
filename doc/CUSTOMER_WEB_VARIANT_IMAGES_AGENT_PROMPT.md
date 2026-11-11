# Prompt for the customer website agent: pictures per pack size

Copy everything below the line into the agent that works on the customer website (`radhe-web`).

---

You are working on the Radhe Foods customer website (`radhe-web`, Next.js). The API changed: a product picture now belongs to **one pack size**. The 5 kg bag and the 10 kg bag of a rice each have their own pictures. Make the website show the pictures of the pack size the customer looks at.

**Read first:** `doc/VARIANT_IMAGES.md` in the `radhe-api` repository (the sibling folder `../radhe-api`), sections "Shop API: what changed for the website" and "Shop website: what to check or build", and section 7 of `doc/CUSTOMER_WEB_API_DOCUMENTATION.md` there. They hold the complete contract. If you cannot read that repository, ask for the files.

**Do not change the theme, colours, fonts, typography, layout or any unrelated functionality.** The placeholder for a product without a picture already exists (`ProductImage` shows the Radhe mark): keep it as it is.

## What changed in the API

No path and no existing field was renamed. What the picture fields mean is now tied to the pack size:

| Field                     | Where                                                         | Meaning now                                                                               |
| ------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `image`                   | every product entry (lists, search, cart, wishlist, checkout) | The main picture of the pack size the entry shows (`variantId`). `null` when it has none. |
| `images`                  | product detail                                                | The gallery of the selected pack size, main picture first. `[]` when it has none.         |
| `variants[].image` (new)  | every product entry                                           | The main picture of each offered pack size, or `null`.                                    |
| `variants[].images` (new) | product detail only                                           | The gallery of each offered pack size, main picture first.                                |
| `alt`                     | every picture                                                 | Without a description of its own: the name with the pack size, "Basmati Rice (5 kg)".     |
| `imageUrl`                | order lines                                                   | The picture of the pack size that was ordered, as it was when the order was placed.       |

The rule for the whole site: **a pack size without a picture shows the placeholder. Never show the picture of another pack size in its place.**

Picture objects are unchanged: `{ id, alt, isPrimary, url, sizes: { small, medium, large } }`, each size with `url`, `width`, `height`; WebP, 320 / 800 / 1600 px on the longest side; the addresses never change their content and are cached for a year.

## Where to change the website

| File                                               | Change                                                                                                                                                                                                                                             |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/api/types.ts`                             | `ProductVariant`: add `image: ApiImage \| null` and `images?: ApiImage[]` (present on the product detail). Correct the comment above the product type: the image belongs to the shown size, not to the product.                                    |
| `src/components/catalogue/product-gallery.tsx`     | The gallery must follow the selected pack size. Today it gets `product.images` once from the server page and keeps them when the customer changes the size.                                                                                        |
| `src/components/catalogue/product-purchase.tsx`    | The selection (`useSelection`, `select`) already holds the chosen `variant`. Give the gallery its pictures from there: `variant.images`, falling back to `product.images` only when the chosen size is the one the page was loaded for.            |
| `src/app/[locale]/(shop)/products/[slug]/page.tsx` | Pass what the gallery needs so that it can read the selection (it is rendered inside `<PackSizes>` already). The metadata (`product.images[0]` for `og:image`) is right as it is: each pack size has its own address and its own answer.           |
| `src/lib/seo/json-ld.tsx`                          | `product.images` is the gallery of the selected size: nothing to change, but leave `image` out of the structured data when the list is empty.                                                                                                      |
| `mocks/views.ts`, `mocks/data`                     | The mock API: pictures per pack size, `image` on each entry of `variants`, `images` on the detail's `variants`, `null` and `[]` for a size without pictures. Give at least one product two sizes with different pictures and one size without any. |
| The tests of the gallery and the product page      | A test that changing the pack size changes the pictures, and that a size without pictures shows the placeholder.                                                                                                                                   |

Nothing to change, only to verify: `product-card.tsx`, `search-form.tsx`, `cart-view.tsx`, `checkout-view.tsx`, the wishlist and the home rows render `image` of their entry through `ProductImage`, which is already right. The order pages (`order-bits.tsx`, `order-detail.tsx`, `return-request.tsx`, `report-problem-view.tsx`, `reviews-view.tsx`) render `imageUrl` of the line.

## What the product page does

1. **Changing the pack size changes the pictures.** When the customer picks another size, the large picture and the thumbnails become those of that size, and the gallery goes back to its first picture. No request is needed: every offered size is in `variants` with its `images`.
2. **A size without pictures** shows the placeholder in the large tile and no thumbnails.
3. **The back and forward buttons** already change the selected size from the address; the gallery follows the same selection.
4. **The "fly to cart" animation and the wishlist heart** in the corner of the picture keep working: the tile stays the `data-fly-source`.
5. **Fast switching.** After the page is idle, preload the main picture of the other sizes: `variants[].image.sizes.medium.url`, with the same `srcset` and `sizes` the gallery uses. Only the main pictures, not the galleries.
6. **The first picture of the selected size** is the page's main picture: it loads at once with `fetchPriority="high"`, as today. After a change of size, the new first picture loads eagerly too.
7. **Keys.** Key the large picture by the picture's `id` and the gallery state by the pack size's `id`, so that the index of one size is not carried over to the next.

Optional, only if I ask for it: small pictures in the size chooser from `variants[].image.sizes.small`.

## How to work

Write your plan first and wait for my go before coding. Then implement, run the site's lint, type check and tests, check the product page in both languages with a product that has two sizes with different pictures and one without, and report what you built and what you left out.
