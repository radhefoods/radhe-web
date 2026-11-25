# Components

The base components live in `src/components/ui`: fourteen files that know nothing about products, carts or orders, and that every feature builds on. Each takes a `className` that is merged last (`cn`, `src/lib/cn.ts`). The second part of this document lists the building blocks outside that folder that several features share. Colours, radii and shadows are in [README.md](README.md), the glass utilities in [liquid-glass.md](liquid-glass.md), the animations in [motion.md](motion.md).

## Button

`src/components/ui/button.tsx`: `Button`, and `buttonStyles()` for a link that should look like one (`<Link className={buttonStyles({ size: "lg", block: true })}>`).

| Prop | Values | Default |
| --- | --- | --- |
| `variant` | `primary`, `secondary`, `quiet`, `wheat`, `ghost`, `pay`, `danger` | `primary` |
| `size` | `sm` (`min-h-11`, 44 px), `md` (`min-h-12`, 48 px), `lg` (`min-h-13`, 52 px) | `md` |
| `block` | Full width of its container | `false` |
| `loading` | Shows a `Spinner`, disables the button, sets `aria-busy` | `false` |
| `type` | As the HTML attribute | `button` |

| Variant | Look | Used for |
| --- | --- | --- |
| `primary` | `leaf-gradient`, white word, `shadow-leaf`, deeper glow and 4% brighter under the pointer | The one action of a view |
| `secondary` | `glass`, the word in `leaf-700` | The second action; "Try again" of `ErrorAlert` |
| `quiet` | Text alone in `leaf-700`, a `leaf-50` tint under the pointer | Actions that must not compete |
| `wheat` | `bg-wheat-400`, ink word | The one action on the dark band |
| `ghost` | Translucent white with a white border and a blur | The second action on the dark band |
| `pay` | `leaf-gradient-deep`, white word | Paying an order |
| `danger` | `glass`, the word in `red-600` | Cancelling, deleting |

Every button is a pill (`rounded-full`), `font-semibold`, 15 px text (`lg`: 16 px), with a 200 ms transition in the glass easing and `active:scale-[0.98]`. Disabled (`disabled` or `aria-disabled`): `bg-cloud`, `text-ink-subtle`, no gradient, no shadow, `cursor-not-allowed`. Used throughout the shop.

## Alert

`src/components/ui/alert.tsx`: a message that needs attention, with an optional `title` and `icon`.

| `tone` | Look | Role |
| --- | --- | --- |
| `info` (default) | `bg-white/70`, ink | `status` (announced politely) |
| `good` | `bg-leaf-50/85`, `leaf-700` | `status` |
| `warn` | `bg-wheat-100/90`, `wheat-800` | `alert` (announced at once) |
| `bad` | `bg-red-50/90`, `red-800` | `alert` |

`rounded-lg`, 15 px text, a one-pixel ring of its own colour and a white hairline along the top, so it sits on glass and on the canvas alike. The title is bold.

## ErrorAlert

`src/components/ui/error-alert.tsx`: an error of the API in the customer's language, as a `bad` `Alert`.

| Prop | Meaning |
| --- | --- |
| `error` | Anything that was thrown; the text comes from `useErrorText` |
| `title` | Optional bold line |
| `onRetry` | Shows "Try again" (`secondary`, `sm`) |
| `children` | Shown under the text |

When the fault is not the customer's (`isUnexpectedError`) and the error carries a request id, the id is shown so that support can find it. How errors become texts is in [api/error-handling.md](../api/error-handling.md).

## Chip

`src/components/ui/chip.tsx`: a status in a few words (an order, a payment, a return). `rounded-full`, 13 px, `font-semibold`, `whitespace-nowrap`, with a 6 px dot in front unless `dot={false}`.

| `tone` | Look | Means |
| --- | --- | --- |
| `leaf` | `bg-leaf-50`, `leaf-700` | Confirmed, in progress |
| `forest` | `bg-leaf-900`, white, wheat dot | On its way |
| `wheat` | `bg-wheat-100`, `wheat-800` | Needs attention (waiting for payment) |
| `green` | `leaf-gradient`, white | A good outcome (delivered, paid); solid so it stands apart from `leaf` |
| `red` | `bg-red-50`, `red-800` | A payment that failed |
| `mute` (default) | `bg-ink/6`, `ink-muted` | Over |

Which status takes which tone is decided in the features (`ChipTone` is imported by the modules of orders, issues and reviews), see [features/orders.md](../features/orders.md).

## Eyebrow

`src/components/ui/eyebrow.tsx`: a short line above a headline: 12 px bold capitals, `tracking-[0.14em]`, behind a short rule drawn with `::before`. `tone`: `wheat` (default, on the dark band) or `leaf` (on light grounds). Used on the home page's band, the account overview and the report page.

## TextField

`src/components/ui/field.tsx`: `TextField`, and `controlStyles`, the look of a text input that selects and textareas share.

| Prop | Meaning |
| --- | --- |
| `id` | Required; also the base of the ids of hint and error |
| `label` | Always a real `label` of the input |
| `hint` | Muted line under the field |
| `error` | Shown instead of the hint; marks the field invalid |
| `inputRef` | The input itself, to focus it |
| `look` | `plain` (default): the label above the field. `float`: the label rests inside the field and rises to its top edge with the focus or a value (the checkout) |

The control is `min-h-12` (`float`: `min-h-14`), `rounded-md`, 16 px text, a 1.5 px border in `line-strong` on `bg-white/90`. Hover darkens the border; the focus turns it leaf and keeps the standard outline; `aria-invalid` turns it red on `red-50`; disabled is `bg-cloud/70`. With an error the input carries `aria-invalid` and `aria-describedby`, and the message is a `role="alert"` in `red-800`. The floating look works on `:placeholder-shown`, which is why it sets a blank placeholder itself.

## PasswordField

`src/components/ui/password-field.tsx`: a `TextField` for passwords with an eye button inside the field that shows the characters. The button is a toggle (`aria-pressed`) with the texts `common.showPassword` and `common.hidePassword`; `autoComplete` comes from the form (`current-password` or `new-password`). Props as `TextField`, without `look` and `type`. Used by the sign-in, sign-up and reset forms and by the deletion of an account.

## QuantityStepper

`src/components/ui/quantity-stepper.tsx`: minus, the number, plus, as one pill.

| Prop | Values | Default |
| --- | --- | --- |
| `value`, `onChange` | The quantity and its setter | – |
| `min`, `max` | Plus is disabled at `max`; `max: null` is no limit | `1`, `null` |
| `removeAtMin` | At the minimum, minus becomes a bin that calls `onChange(0)`. Off where a separate remove button exists: minus then stops | `true` |
| `size` | `xs` (28 px buttons), `sm` (32 px), `md` (36 px), `card` (28 px buttons and a narrow number, for the price row of a product card) | `md` |
| `look` | `solid`: the leaf pill that takes the place of "Add to cart". `outline`: a `glass-soft` pill for a line of the cart | `solid` |
| `labels` | `quantity` (the name of the group), `increase`, `decrease`, `remove` | – |

It fills the width its parent gives (`w-full`); the caller sets the width. The group is a `role="group"` named by `labels.quantity`; the number is an `aria-live="polite"` region and pops on every change. Used by `AddToCart`, the cart line, the return request and the report of a problem.

## Sheet

`src/components/ui/sheet.tsx`: a panel that slides over the page, built on the Radix `Dialog`: from the bottom on phones (`max-h-[88dvh]`, `rounded-t-3xl`, a grab handle), from the right from `sm` (`w-[26rem]`, 8 px from the edges, `rounded-3xl`). `glass-strong` with `shadow-float` over a dimmed, softly blurred page.

| Prop | Meaning |
| --- | --- |
| `open`, `onOpenChange` | Controlled state |
| `trigger` | The control that opens it; Radix returns the focus to it |
| `returnFocusTo` | Without a `trigger`: the control that gets the focus back; else whatever had the focus when the sheet opened |
| `title`, `closeLabel` | The dialog's title and the spoken name of the close button (40 px) |
| `footer` | Stays in view under the scrolling body: the buttons of a form |

Focus stays inside and Escape closes it. Body and footer add `env(safe-area-inset-bottom)`. Used by the phone menu, the filters on phones, the order page and the wishlist lists.

## Tooltip

`src/components/ui/tooltip.tsx`: a small `glass-dark` pill under a control (Radix `Tooltip`, `side="bottom"`, 8 px away, opens after 350 ms), on hover and on keyboard focus, never on touch. The control keeps its own spoken label; the tip is its description. `children` must take a ref. Used by the icon links of the header.

## Disclosure

`src/components/ui/disclosure.tsx`: a section that folds open, as a native `details`: it works without scripts, the summary is a button to assistive technology, and the content is in the HTML whether open or not.

| Prop | Values | Default |
| --- | --- | --- |
| `id`, `title` | Required | – |
| `defaultOpen` | Open when the page loads | `false` |
| `look` | `card` (a `glass` card, `rounded-xl`) or `row` (a flat row between hairlines that stacks with its neighbours) | `card` |
| `headingLevel` | `h2` or `h3`: the title is a heading of the page | `h2` |

The chevron sits in a 32 px circle and turns when open; the content glides where the browser can animate `details` (`disclosure-fold`). Used by the product page and the FAQ.

## Pagination

`src/components/ui/pagination.tsx`: the pages of a list as round 44 px numbers with an arrow at either end: the first, the last and those around the current one, the gaps as dots. Every number is a link, so the pages work without scripts and can be shared. Renders nothing for one page.

| Prop | Meaning |
| --- | --- |
| `page`, `totalPages` | Where the list is |
| `hrefOf` | The address of a page |
| `labels` | `pagination` (the name of the `nav`), `previous`, `next`, `pageOf(page, total)` |

The current page is the leaf pill with `aria-current="page"`; the others are `glass-soft`. An arrow with nowhere to go is a dimmed, hidden `span`. Used by the product lists, the blog and the reviews page.

## Skeleton and Spinner

| Component | File | What it is |
| --- | --- | --- |
| `Skeleton` | `src/components/ui/skeleton.tsx` | A `shimmer` block (`rounded-sm`) standing in for content; the caller sets its size by `className`. Hidden from screen readers |
| `Spinner` | `src/components/ui/spinner.tsx` | A turning ring in the current colour, 20 px unless `className` says otherwise. Decorative: the text beside it says what is happening |

A view that loads draws its own skeleton in the shape of what will come (`CartSkeleton`, `CheckoutSkeleton`), wrapped in `aria-hidden`.

## Shared building blocks outside `ui`

| Building block | File | What it is | Used by |
| --- | --- | --- | --- |
| `Logo` | `src/components/shell/logo.tsx` | The wordmark, see [icons-and-images.md](icons-and-images.md) | Header, footer, the checkout and plain frames |
| `iconControl` | `src/components/shell/icon-control.ts` | The classes of a round 44 px icon link | Wishlist, account and cart links of the header |
| `ProblemToast`, `SuccessToast` | `src/components/shell/problem-toast.tsx`, `src/components/shell/success-toast.tsx` | A frosted message at the top of the window: a failure (stays until closed, `role="alert"`), or a saved change (gone after 4 s, `role="status"`) | Cart and wishlist problems; the profile |
| `PageError` | `src/components/shell/page-error.tsx` | The page that could not be loaded, with "Try again" | The `error.tsx` of the three frames |
| `ProductCard` | `src/components/catalogue/product-card.tsx` | A product in a list, see [features/product-card.md](../features/product-card.md) | Lists, rows, the wishlist, the cart's suggestions |
| `ProductGrid` | `src/components/catalogue/product-grid.tsx` | Cards in a grid; `wide` adds a fifth column | Product lists, the wishlist, the styleguide |
| `ProductRow`, `ProductRowItem` | `src/components/home/product-row.tsx` | A heading, a link and a row of cards that scrolls sideways with arrows | Home page, product page, cart page, `CategoryTiles` |
| `CategoryCard`, `CategoryTiles` | `src/components/catalogue/category-card.tsx`, `src/components/catalogue/category-tiles.tsx` | A category as one card; the row of them | Home page, product page, the page of all categories |
| `Price` | `src/components/catalogue/price.tsx` | The price, the struck regular price and the price per unit; `size`: `md`, `lg`, `xl` | Cards, the product page |
| `ProductImage` | `src/components/catalogue/product-image.tsx` | A product picture with its fallback | Cards, gallery, cart, checkout, search |
| `AddToCart` | `src/components/catalogue/add-to-cart.tsx` | Button, then stepper; `look`: `button` or `card` | Cards, the product page and its phone bar |
| `WishlistButton` | `src/components/catalogue/wishlist-button.tsx` | The heart; `look`: `tile`, `box`, `plain` | Cards, the product picture, cart lines |
| `IntentLink` | `src/components/catalogue/intent-link.tsx` | A link prefetched on hover, touch or focus, not when it scrolls into view | Product and category cards |
| `Breadcrumbs` | `src/components/catalogue/breadcrumbs.tsx` | Home, the categories, the page itself | Category pages, the product page |
| `PaymentMarks` | `src/components/catalogue/payment-marks.tsx` | The four accepted marks | The product page, the checkout |
| `pill`, `pillIdle`, `pillActive`, `FacetPopover` | `src/components/catalogue/filters/facet-popover.tsx` | The filter pill and its panel | The filter row and its phone buttons |
| `BillTotals`, `FreeDeliveryProgress` | `src/components/cart/bill-summary.tsx` | The rows of a bill; the bar towards free delivery | Cart, checkout, the order page |
| `BoxShipping` | `src/components/cart/box-shipping.tsx` | The boxes of an order | Cart, checkout |
| `AddressForm` | `src/components/checkout/address-form.tsx` | The fields of an address; `look` as `TextField` | Checkout, the address book |
| `RatingStars` | `src/components/reviews/rating-stars.tsx` | Five stars filled to the decimal, `role="img"` with a spoken label | Review cards and summary, the home page, the account |
| `OrderStatusChips`, `OrderCard`, `AddressBlock`, `DocumentRow` | `src/components/account/order-bits.tsx` | The repeated parts of the account's lists | Orders, invoices, addresses, the overview |
| `LegalText` | `src/components/legal/legal-text.tsx` | A Markdown text in the type of the shop, HTML not rendered | Legal pages, FAQ answers, blog articles |
| `AuthPage`, `authLink` | `src/components/auth/auth-page.tsx` | The title and the one frosted card of the sign-in pages | Sign-in, sign-up, forgot and reset |

Before a feature writes a control of its own, look here: a second pill, heart, stepper or price would be a second look.
