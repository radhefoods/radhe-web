# Liquid glass

The chrome of the shop floats on the page as frosted glass: translucent white, blurred, lit by a hairline of white along the top edge and parted from the page by a faint shadow. Products stay on solid white, so pictures, names and prices never lose clarity to the glass. Everything here is defined in `src/app/globals.css`; the reasons are in the [decision log](../decisions/decision-log.md), section "Liquid glass (2026-10-31)". The colours behind the utilities are in [README.md](README.md).

## The page behind the glass

| Layer | What it is |
| --- | --- |
| `html` | `background: var(--color-canvas)` (`#f1f6f1`). The canvas sits on the root so that the gradients of the body paint above it and under everything else |
| `body::before` | `position: fixed`, `inset: 0`, `z-index: -1`, `pointer-events: none`: four radial gradients, fixed to the window so that the frosted panels have something to blur. Gradients only, no filters: cheap to paint |

| Gradient | Size and place | Colour |
| --- | --- | --- |
| Leaf, top left | `62rem 44rem at 8% -12%` | `rgb(201 232 213 / 0.7)` to transparent at 62% |
| Cream, top right | `54rem 40rem at 104% 6%` | `rgb(247 240 224 / 0.85)` to transparent at 60% |
| Peach, right | `40rem 30rem at 86% 70%` | `rgb(251 226 212 / 0.4)` to transparent at 60% |
| Leaf, foot | `56rem 36rem at 30% 112%` | `rgb(228 243 234 / 0.9)` to transparent at 62% |

## The glass utilities

Each is a background, a blur of what is behind (`backdrop-filter` and `-webkit-backdrop-filter`), a shadow and `corner-shape: squircle` (squircle corners where the browser draws them, plain round elsewhere). A browser without `backdrop-filter` gets a nearly opaque background through `@supports not`, so the text stays readable.

| Utility | Background | Blur | Shadow | Without `backdrop-filter` |
| --- | --- | --- | --- | --- |
| `glass` | `rgb(255 255 255 / 0.58)` | `blur(20px) saturate(1.5)` | `--shadow-glass` | `rgb(255 255 255 / 0.94)` |
| `glass-strong` | `rgb(255 255 255 / 0.78)` | `blur(24px) saturate(1.5)` | `--shadow-glass` | `rgb(255 255 255 / 0.97)` |
| `glass-soft` | `rgb(255 255 255 / 0.42)` | `blur(16px) saturate(1.4)` | `inset 0 1px 0 rgb(255 255 255 / 0.7)`, `0 0 0 1px rgb(23 33 27 / 0.06)`, `0 4px 14px -8px rgb(23 33 27 / 0.12)` | `rgb(255 255 255 / 0.92)` |
| `glass-dark` | `rgb(23 33 27 / 0.72)` | `blur(16px) saturate(1.4)` | `inset 0 1px 0 rgb(255 255 255 / 0.18)`, `0 8px 24px -12px rgb(23 33 27 / 0.5)` | `rgb(23 33 27 / 0.92)` |
| `glass-leaf` | `rgb(228 243 234 / 0.75)` | `blur(16px) saturate(1.4)` | `inset 0 1px 0 rgb(255 255 255 / 0.8)`, `0 0 0 1px rgb(21 122 75 / 0.12)`, `0 8px 24px -14px rgb(21 122 75 / 0.25)` | `rgb(228 243 234 / 0.96)` |

`--shadow-glass` is the white hairline along the top edge, a faint inner edge, a faint outline and a soft fall; its layers are in [README.md](README.md). The shadow is part of the utility and not a border, so `rounded-*` and `border-*` stay free. A hover class such as `hover:bg-white/85` wins over the utility's background.

### Where each is used

| Utility | Meant for | Used by |
| --- | --- | --- |
| `glass` | The default panel | The footer panel (`src/components/shell/footer.tsx`), the pill header of the checkout (`src/app/[locale]/(checkout)/layout.tsx`), the cart list and the empty cart (`src/components/cart/cart-view.tsx`), the panels of the checkout (`Panel` in `src/components/checkout/checkout-view.tsx`), `BoxShipping`, the card look of `Disclosure`, the empty product list, the `secondary` and `danger` buttons, the heart on the product picture, the account navigation from `lg` |
| `glass-strong` | Panels full of text and numbers, and everything that floats | The summaries of cart and checkout, the tab bar, `Sheet`, both toasts, the cookie notice, the phone bars of cart, checkout and product page, the panel of a filter pill, the auth card, the panels of the account, the legal pages, review cards, `PurchaseInfo` |
| `glass-soft` | Small controls that sit on the page | The outline `QuantityStepper`, the numbers of `Pagination`, the arrows and the pill link of `ProductRow`, filter pills, the menu button, the heart on a card, the pill of a size that cannot be ordered, the track of the pack-size bar, chips, the account navigation on phones |
| `glass-dark` | White text on dark | `Tooltip`, the dots of `HeroCarousel` |
| `glass-leaf` | A leaf tint: a reached goal, a chosen tile | The styleguide only; no page of the shop uses it |

### Glass written without the utilities

A few surfaces are frosted by hand, because their values differ from the five strengths:

| Surface | Classes | File |
| --- | --- | --- |
| The header of the shop | `bg-white/95 backdrop-blur-xl backdrop-saturate-150 supports-[backdrop-filter]:bg-white/65` with `shadow-header`; the promise strip above it `bg-white/40` | `src/components/shell/header.tsx` |
| The header of the plain frame | The same classes | `src/app/[locale]/(plain)/layout.tsx` |
| The search field | `bg-white/60`, white under the pointer and with the focus, its own three-layer shadow | `src/components/shell/search-form.tsx` |
| The search dropdown | `bg-white/95 backdrop-blur-2xl backdrop-saturate-150` with `shadow-float` | `src/components/shell/search-form.tsx` |
| The `ghost` button on the dark band | `bg-white/10 backdrop-blur-md`, a white border at 40% | `src/components/ui/button.tsx` |
| The dimmed page behind a sheet | `bg-ink/35 backdrop-blur-sm` | `src/components/ui/sheet.tsx` |
| The dimmed page behind the search | `bg-ink/30 backdrop-blur-[2px]` | `src/components/shell/search-form.tsx` |
| The dimmed page behind a category panel | `bg-ink/20`, no blur | `src/components/shell/category-nav.tsx` |

Inside a glass panel, quiet tiles are translucent white without a blur of their own: `bg-white/55` to `bg-white/70` with a one-pixel outline as a shadow (the account row of the checkout, the address tiles, the free-delivery tile).

## What stays solid white

| Surface | How | Why |
| --- | --- | --- |
| Product cards, category cards, post cards | `surface`: `background: var(--color-white)`, `--shadow-card`, squircle corners | No blur, so the picture, the name and the price stay crisp; the same edge and fall as the glass, so the two sit well together |
| The large picture of the product page and its thumbnails | `surface` on the tile, `bg-white` on the thumbnails | Packshots are shot on white |
| The picture tile inside a card | `bg-white` | The same |
| Pictures inside glass panels (cart line, checkout line, search entry) | A small `bg-white` tile with a hairline | A picture never lies directly on glass |
| The panel of the category bar (mega menu) | `bg-white` with `shadow-float` | A wide panel of small text over the dimmed page |
| Fields | `bg-white/90`, white with the focus | Typed text needs a still ground |
| The thumb of a segmented control (language switch, active tab, account navigation) | `bg-white` with a small shadow | The chosen item stands on the frosted track |

Glass is for the chrome only. Too much of it is slow on phones and hard to read, which is why a list of cards is never a list of blurred panels.

## Fills that are not glass

| Utility | What it sets | Used for |
| --- | --- | --- |
| `leaf-gradient` | `background-image: linear-gradient(180deg, var(--color-leaf-500) 0%, var(--color-leaf-600) 100%)` | The one action: the `primary` button, the basket of a card, the solid stepper, the current page of `Pagination`, the `green` chip, the button of the search field, the cart bar of phones, count badges of the filters |
| `leaf-gradient-deep` | The same from `leaf-600` to `leaf-700` | The `pay` button: paying is good news, the deeper leaf |
| `hero-band` | `position: relative`, `overflow: hidden`, `linear-gradient(118deg, leaf-900 0%, moss 52%, olive 100%)`; `::before` weaves two `repeating-linear-gradient`s of white at 4.5% (1 px every 6 px, both directions); `::after` is a 40 rem circle at `top: -16rem`, `right: -14rem` glowing `rgb(235 217 180 / 0.3)`; children sit above (`position: relative`) | The dark band of the home page while no banner is live (`src/app/[locale]/(shop)/page.tsx`), and the styleguide |

On `hero-band` the text is white, the eyebrow and the highlighted phrase are `wheat-400`, and the two buttons are `wheat` and `ghost`. The logo files are drawn for light grounds and are not placed on it.

## Layering

| Fact | Consequence |
| --- | --- |
| An element with `backdrop-filter` holds its `position: fixed` children | `SuccessToast` renders on `document.body` through a portal, so a frosted ancestor cannot pin it; the dims of the search and of the category bar do the same |
| Glass needs something behind it | Panels sit on the page with its gradients, not on other opaque panels; glass on glass is kept to small controls (`glass-soft` chips inside a `glass` card) |
| The shadows already draw the edge | A glass panel carries no border; hairlines inside it are `border-ink/8` or `divide-white/70` |

## Rules for a surface

1. A surface that shows products in a list is `surface`. A surface of the chrome is one of the five glass utilities; choose by content, not by taste: `glass-strong` for text and numbers and for whatever floats over the page, `glass` for a panel at rest, `glass-soft` for a small control.
2. Do not write `backdrop-blur-*` by hand for a panel; the utilities carry the fallback for browsers without `backdrop-filter`.
3. A floating surface (fixed or absolute over content) adds `shadow-float`; a card that rises under the pointer uses `hover:shadow-lift`.
4. Corners come from the radius scale: `rounded-2xl` for a panel, `rounded-3xl` for a sheet or a page-wide panel, `rounded-full` for a pill.
5. Pictures stand on a white tile, also inside glass.
6. Text on glass is `ink`, `ink-muted` or `ink-subtle`; white text only on `glass-dark`, `leaf-gradient` or `hero-band`.
7. A strength, a tint or a blur that the table above does not hold is a change of the look: ask the owner first ([README.md](README.md)).
