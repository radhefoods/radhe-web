# Motion

Motion in the shop is short and says something: a control that changed, a panel that arrived, a product on its way into the cart. Almost all of it is `transform` and `opacity`. One easing serves everything that moves, and one rule in the base layer stills it all for visitors who asked for less motion. The tokens and keyframes are in `src/app/globals.css`; the two scripted pieces are the flight into the cart and the carousel of the home page.

## The easing

| Token | Value | Written as |
| --- | --- | --- |
| `--ease-glass` | `cubic-bezier(0.2, 0.8, 0.2, 1)`: quick to start, soft to settle | `ease-glass`, or `ease-[var(--ease-glass)]` in the base components |

## Animations

The `--animate-*` tokens of `@theme` become `animate-*` classes. All run once with `both` as fill mode, in the glass easing unless the table says otherwise.

| Class | Duration | What moves | Used by |
| --- | --- | --- | --- |
| `animate-stepper-in` | 220 ms | `opacity` 0 to 1, `scaleX(0.6)` to 1 | The stepper that takes the place of the add button, only when it follows a tap (`src/components/catalogue/add-to-cart.tsx`); it grows from the right on a card, from the left elsewhere |
| `animate-count-pop` | 220 ms | `scale(1)`, `1.3` at 40%, back to 1 | The number of `QuantityStepper` (mounted afresh by `key` on every change); the heart of `WishlistButton` when it fills |
| `animate-tooltip-in` | 150 ms | `opacity`, `translateY(-4px) scale(0.96)` to rest | `Tooltip` |
| `animate-dropdown-in` | 180 ms | `opacity`, `translateY(-6px) scale(0.98)` to rest | The panel of the category bar, the panel of a filter pill, `ProblemToast`, `SuccessToast` |
| `animate-sheet-up` | 320 ms | `opacity`, `translateY(2rem)` to rest | `Sheet` on phones |
| `animate-sheet-in` | 320 ms | `opacity`, `translateX(2rem)` to rest | `Sheet` from `sm` |
| `animate-overlay-in` | 220 ms, `ease-out` | `opacity` 0 to 1 | The dim behind a `Sheet` and behind an open category panel |
| `animate-dot-fill` | 6 s, `linear` (the carousel sets the duration inline to its own pace) | `scaleX(0)` to 1 | The dot of the shown slide of `HeroCarousel` |
| `animate-tick` | 360 ms | `opacity`, `translateY(-6px)` to rest | An amount that changed: the total of a cart line, the total of the bill (`BillTotals`), the count beside the cart's title |
| `animate-rise` | 420 ms | `opacity`, `translateY(10px)` to rest | The panels of cart and checkout as they arrive, one after the other by `[animation-delay:60ms]`, `120ms`, `180ms` |

Four more are utilities with keyframes of their own, outside `@theme`:

| Utility | Timing | What moves | Used by |
| --- | --- | --- | --- |
| `nav-progress` | 8 s, `cubic-bezier(0.1, 0.8, 0.2, 1)`, after a delay of 150 ms | `scaleX(0)` to `0.92` from the left: it grows quickly and ever more slowly and never claims to be finished | The 3 px leaf line at the top of the window while the next page loads (`src/components/shell/navigation-progress.tsx`); removed when the address changed, or after 10 s |
| `reveal-stagger` | 260 ms, glass easing, delayed by `calc(var(--i, 0) * 28ms)` | `opacity`, `translateY(6px)` to rest | The entries of the search dropdown, one beat after another |
| `shimmer` | 1.8 s, `ease-in-out`, endless | A band of light (`background-position` 200% to -200%) over a `cloud` block | `Skeleton` |
| `animate-spin` | Tailwind's own | A turning ring | `Spinner` |

## Transitions that are utilities

| Utility | What it sets | Used by |
| --- | --- | --- |
| `disclosure-fold` | Where the browser supports `interpolate-size: allow-keywords`: `::details-content` runs from `block-size: 0` and `opacity: 0` to its own size in 260 ms (glass easing; opacity 200 ms `ease`). Elsewhere the content appears at once | `Disclosure`, the list of boxes in `BoxShipping` |
| `basket-orb` | The label inside the basket of a card: `max-width: 0`, `opacity: 0` at rest; open, `max-width: 6rem` with margins of 7 px and 3 px. `max-width` and `margin` take 300 ms in the glass easing, `opacity` 200 ms | The round basket of `ProductCard` |

### The expanding basket

The basket of a card is a 40 px circle at rest. Under the pointer or the keyboard's focus it opens to the left and says "Add".

| Condition | Result |
| --- | --- |
| `data-roomy="true"` and `:focus-visible` | Opens |
| `data-roomy="true"` and `:hover`, inside `@media (hover: hover)` | Opens |
| A touch screen | Stays a circle: there is no pointer to rest on it |
| `data-roomy="false"` | Stays a circle |

`data-roomy` is measured by `measureRoom` in `src/components/catalogue/add-to-cart.tsx` when the pointer or the focus arrives: the circle and the label's margins (50 px) plus the label's width must fit the slot the card keeps free beside the price, so the label is neither cut nor laid over the price (the German label is longer than the English one). Opening moves nothing else on the card.

## The flight into the cart

`flyToCart` in `src/features/cart/fly-to-cart.ts` runs on the tap that adds a pack size. It is plain DOM and the Web Animations API, nothing in React state: the count of the cart has already changed by then.

| Part | Markup | Where |
| --- | --- | --- |
| Scope | `data-fly-scope`, the nearest one above the button | The `article` of a card; the grid of the product page |
| Source | `data-fly-source`, the tile whose first child is the picture | The picture link of `ProductCard`; the large tile of `ProductGallery` |
| Target | `data-cart-target`; the first one that is shown | `CartLink` in the header; the icon pill of the cart tab on phones |

```text
tap  →  a ghost of the tile (an outer box at the tile's place, inside it the tile's
        frame with a copy of the picture; fixed, z-index 50, --shadow-float, aria-hidden)
     →  720 ms: the frame moves across and shrinks to about 28 px
                (cubic-bezier(0.45, 0.05, 0.55, 0.95));
                the outer box moves up or down with another easing, so the path bends:
                cubic-bezier(0.2, 1.3, 0.4, 1) towards a cart above,
                cubic-bezier(0.5, -0.6, 0.6, 1) towards the cart tab below;
                opacity stays 1 until 75%, then fades to 0
     →  the ghost is removed; the target bobs: scale 1 → 1.12 → 1 in 360 ms (glass easing)
```

| Case | What happens |
| --- | --- |
| The tile is not on screen (the phone bar of the product page) | The flight starts at the button itself, as a round leaf dot |
| No target is shown | No flight |
| `prefers-reduced-motion: reduce` | No flight; the function returns at once |

The three attributes are the whole contract between the markup and the flight: a redesign of a card, of the gallery or of the header keeps them.

## The carousel

`src/components/home/hero-carousel.tsx` moves its slides on one track by a transform.

| Value | Constant | Meaning |
| --- | --- | --- |
| 700 ms, `cubic-bezier(0.22, 1, 0.36, 1)` | `GLIDE_MS`, `GLIDE_EASING` | A change of slide glides |
| 6000 ms | `AUTOPLAY_MS` | It moves on by itself; the dot of the shown slide fills meanwhile |
| 6 px | `DRAG_PX` | A pointer that moved this far is dragging, not clicking |
| a fifth of the width, or 0.5 px per ms | `TURN_SHARE`, `FLICK_PX_PER_MS` | A drag this long or this quick turns the slide |

Autoplay waits while the pointer rests on the carousel, while something in it has the focus, during a drag and while the tab is hidden. Once the visitor turned a slide themselves (a swipe or a dot) it stops for good. With reduced motion there is no autoplay and every change jumps.

## Other timed behaviour

| Where | Timing | What |
| --- | --- | --- |
| Search dropdown (`src/components/shell/search-form.tsx`) | Height, opacity and transform 260 ms in the glass easing; a change of content fades 150 ms (`FADE_MS`); folding up takes 220 ms (`EXIT_MS`); the dim fades 200 ms | The dropdown unfolds under the field and glides to the height of its content |
| Category bar (`src/components/shell/category-nav.tsx`) | Opens 90 ms after the pointer came to rest (`OPEN_AFTER_MS`), closes 220 ms after it left (`CLOSE_AFTER_MS`) | Crossing the bar opens nothing; a slanted way into the panel does not lose it |
| Phone menu (`src/components/shell/mobile-menu-panel.tsx`) | `grid-template-rows` from `0fr` to `1fr` in 200 ms, then the group scrolls into view | A group folds open |
| `SuccessToast` | Visible 4000 ms (`VISIBLE_MS`); 250 ms before the end (`LEAVE_MS`) it fades and rises 4 px in 200 ms | Goes by itself |
| Free-delivery bar (`FreeDeliveryProgress`) | `width` in 700 ms, glass easing | The bar follows the bill |
| Rows (`ProductRow`) | `scroll-smooth`, `scrollBy` with `behavior: "smooth"`, `snap-x snap-mandatory` | The arrows turn one page; the row snaps card by card |

## Hover and press

| Element | Under the pointer | Pressed |
| --- | --- | --- |
| `ProductCard`, `CategoryCard` | Rises 4 px (`hover:-translate-y-1`) with `shadow-lift`, 300 ms in the glass easing; the picture grows to 105% in 500 ms (`motion-safe:` only) | – |
| `Button` | Deeper glow or tint, 200 ms | `scale(0.98)` |
| Icon controls of the header, arrows of a row, page numbers | Frosted white, leaf word, 200 ms | `scale(0.95)` |
| Stepper buttons, hearts, the bin of a cart line | A tint, 150 to 200 ms | `scale(0.9)` |
| The basket of a card | Opens (above), deeper glow | `scale(0.96)` |
| An arrow beside a link ("Checkout", "All categories") | Slides right by 2 to 4 px | – |
| The chevron of a `details`, of a menu item, of a group | Turns 180° while open, 150 to 300 ms | – |

A row's scroll box keeps vertical padding (taken back by a negative margin) so that a card that lifts is never cut.

## Reduced motion

The base layer holds one rule for `prefers-reduced-motion: reduce`, on `*`, `::before` and `::after`:

| Property | Value |
| --- | --- |
| `animation-duration` | `0.01ms !important` |
| `animation-iteration-count` | `1 !important` |
| `transition-duration` | `0.01ms !important` |
| `scroll-behavior` | `auto !important` |

So every CSS animation and transition ends at once in its final state, the shimmer of a skeleton stops, and smooth scrolling jumps. What CSS cannot reach checks the preference itself:

| Piece | Behaviour with reduced motion |
| --- | --- |
| `flyToCart` | Does nothing |
| `HeroCarousel` | No autoplay; changes jump |
| `reveal-stagger` | The delay per entry is `0ms`, so nothing waits |
| The picture of a card | Does not grow (`motion-safe:group-hover:scale-[1.05]`) |
| The phone menu | Scrolls a group into view with `behavior: "auto"` |

`e2e/accessibility.spec.ts` opens a page with reduced motion and fails when any animation runs endlessly or longer than 50 ms.

## Rules for adding motion

1. Motion answers something the customer did or reports something that changed. Nothing moves to decorate.
2. Animate `transform` and `opacity`. A size is animated only where the code already does (the height of the search dropdown, the fold of a `details`, the width of a bar).
3. Use `ease-glass` and a duration from the tables: 150 to 220 ms for a control, 260 to 420 ms for a panel. Longer only for a journey across the page.
4. An animation that should repeat on a change is mounted afresh by `key` (`<span key={value} className="animate-count-pop">`), not restarted by script.
5. An animation of an entrance runs when it follows an action, not when a page opens with the state already there (`unfolds` in `AddToCart`).
6. CSS motion is stilled by the global rule; scripted motion checks `prefers-reduced-motion` itself, and anything that moves on its own offers a way to stop it.
7. A keyframe is added as an `--animate-*` token in `@theme` and to the table above. A different character of motion is a change of the look: ask the owner first ([README.md](README.md)).
