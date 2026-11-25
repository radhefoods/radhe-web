# Design system

The look of the shop is one system: a very light green page with slow ambient gradients, frosted glass for the chrome (header, menus, summaries, dialogs, the tab bar), solid white for everything that shows a product, leaf green as the one action colour, wheat as the highlight, coral red for reduced prices and errors, and Inter for every text. The tokens live in `src/app/globals.css`, the base components in `src/components/ui`. The shop is light-only (`color-scheme: light`). This document holds the foundations (colour, type, radii, shadows, widths, how styles are written); the six documents below hold the rest.

## The owner's rule

The theme, the colours, the fonts (Inter only), the typography and the brand identity are preserved. A change of the look is asked for first: it is proposed to the owner and built after their choice, never as a side effect of a feature.

| In practice | |
| --- | --- |
| A feature needs a surface, a control or a status | It is built from the tokens, the utilities and the components of these documents |
| A feature seems to need a colour, a font, a radius or a shadow of its own | Stop and ask the owner; nothing is added to `@theme` without their decision |
| A contract of the backend offers something that would change the look | It is the owner's call, recorded in the [decision log](../decisions/decision-log.md) |

The reasons for the system as it stands are in the decision log, sections "Liquid glass (2026-10-31)" and "Design (redesign approved by the owner on 2026-10-14)".

## The documents

| Document | Holds |
| --- | --- |
| [liquid-glass.md](liquid-glass.md) | The page background, every glass utility, what is glass and what stays white, the rules for a surface |
| [components.md](components.md) | Every component of `src/components/ui` and the shared building blocks of the features |
| [motion.md](motion.md) | Every animation and transition, the flight into the cart, the reduced-motion rule |
| [icons-and-images.md](icons-and-images.md) | The icon set, the logo and the brand icon, payment marks, product pictures and their placeholders |
| [responsive-layout.md](responsive-layout.md) | Breakpoints in use, grids, the container query of the card, phones, sticky and fixed elements |
| [accessibility.md](accessibility.md) | Focus, landmarks, labels, live regions, keyboard patterns, target sizes, what the tests cover |

## Colour

The default Tailwind palette is switched off (`--color-*: initial` in `@theme`): only the tokens below exist, so `bg-leaf-600` works and `bg-green-600` produces nothing. Every token is a Tailwind colour (`bg-`, `text-`, `border-`, `ring-`, with an opacity such as `border-ink/8`).

### Neutrals

| Token | Value | Used for |
| --- | --- | --- |
| `white` | `#ffffff` | Product cards and picture tiles (`surface`), fields, the thumb of a segmented control |
| `canvas` | `#f1f6f1` | The page (the background of `html`); also the browser's theme colour (`src/app/[locale]/layout.tsx`), the manifest (`src/app/manifest.ts`) and the ground of the brand icons |
| `mist` | `#e8efe7` | Quiet tiles: the picture of a category, a post without a picture, the ground of a banner |
| `cloud` | `#dae4d9` | Disabled buttons and fields, the grey of a skeleton |
| `line` | `#dfe8de` | Cell borders of the tables in `LegalText` |
| `line-strong` | `#c6d4c5` | Field borders, the thumb of the thin scrollbar, table heads and quotes in `LegalText` |
| `ink` | `#17211b` | Text; as `ink/6` to `ink/10` the hairlines and quiet fills inside a panel |
| `ink-muted` | `#475149` | Secondary text |
| `ink-subtle` | `#5c665e` | Small print, placeholders, struck-through prices; 4.5:1 on white, canvas and mist |

### Glass

| Token | Value | Used for |
| --- | --- | --- |
| `glass` | `rgb(255 255 255 / 0.58)` | Background of the `glass` utility |
| `glass-strong` | `rgb(255 255 255 / 0.78)` | Background of `glass-strong` |
| `glass-soft` | `rgb(255 255 255 / 0.42)` | Background of `glass-soft` |
| `glass-dark` | `rgb(23 33 27 / 0.72)` | Background of `glass-dark` |
| `glass-edge` | `rgb(255 255 255 / 0.7)` | Defined; no rule and no class reads it |

These are read by the utilities of [liquid-glass.md](liquid-glass.md), not written as classes.

### Leaf, the brand and the action colour

| Token | Value | Used for |
| --- | --- | --- |
| `leaf-50` | `#e4f3ea` | Tints: a chosen row, the `good` alert, the `leaf` chip, icon tiles |
| `leaf-100` | `#c9e8d5` | Styleguide only |
| `leaf-200` | `#9fd6b6` | Styleguide only |
| `leaf-300` | `#6fbd93` | The start of the free-delivery bar (`FreeDeliveryProgress`) |
| `leaf-400` | `#419f6f` | Styleguide only |
| `leaf-500` | `#218a59` | The top of `leaf-gradient` |
| `leaf-600` | `#157a4b` | The action colour: the focus outline, the foot of `leaf-gradient`, checked boxes and radios (`accent-leaf-600`), the signed-in dot, the line of `NavigationProgress` |
| `leaf-700` | `#0f5c38` | Text on a tint, links, the hover of a link, the foot of `leaf-gradient-deep` |
| `leaf-800` | `#0d5234` | The hover of leaf links and of the `secondary` button's word |
| `leaf-900` | `#0b4a31` | The start of `hero-band`, the skip link, the `forest` chip |
| `moss` | `#1f5a30` | The middle of `hero-band`; nowhere else |
| `olive` | `#4a5e24` | The warm edge of `hero-band`; nowhere else |

### Wheat, the highlight

Fills and big numerals only; `wheat-800` is the only wheat for text.

| Token | Value | Used for |
| --- | --- | --- |
| `wheat-50` | `#fbf8f1` | Styleguide only |
| `wheat-100` | `#f7f0e0` | The `warn` alert, the `wheat` chip, the "only N left" badge, applied-filter chips, the text selection (`::selection`) |
| `wheat-200` | `#f2e6cc` | The hover of an applied-filter chip |
| `wheat-400` | `#ebd9b4` | Count badges (cart, wishlist, quantity on a checkout line), the `wheat` button, the eyebrow and the highlighted phrase on the dark band |
| `wheat-500` | `#e2cca0` | The hover of the `wheat` button |
| `wheat-800` | `#6e5630` | Text on white or on a wheat tint: warnings, "only N left", the stars of a rating |

### Red, reduced prices and errors

| Token | Value | Used for |
| --- | --- | --- |
| `red-50` | `#fdece7` | The `bad` alert, the `red` chip, the saving badge of a cart line, the hover of a remove button |
| `red-100` | `#fbd8ce` | The hover of the close button of `ProblemToast` |
| `red-200` | `#f3bbab` | Styleguide only |
| `red-600` | `#bf3c1d` | A reduced price, the discount badge of a card, the saved heart, the word of the `danger` button; 4.7:1 on its tint, carries white text at 5.4:1 |
| `red-800` | `#9a2f14` | Error text: field errors, the `bad` alert, the `red` chip |

The brand colours of the payment marks are the only colours outside the tokens, see [icons-and-images.md](icons-and-images.md).

## Typography

One family for everything: Inter, loaded by `next/font/google` in `src/app/fonts.ts` (`subsets: ["latin"]`, the optical-size axis `opsz`, `display: "swap"`, the variable `--font-inter`). The font files are downloaded at build time and served from the shop's own address. `src/app/[locale]/layout.tsx` puts the variable on `html`; `--font-sans` and `--font-display` both name it, followed by `"Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif`.

| Rule | Value | Where |
| --- | --- | --- |
| Body | `line-height: 1.5`, `font-optical-sizing: auto`, `font-feature-settings: "cv11" 1` (the single-storey "a"), antialiased | `body` in the base layer |
| `font-display` | weight 700, `letter-spacing: -0.028em`, `hyphens: auto`, `text-wrap: balance` | Headlines, prices, big numbers |
| `headline-no-hyphens` | `hyphens: manual` (a plain class outside the layers, so it wins over `font-display`) | The headline of the dark band on the home page |

Sizes and weights in real use:

| Element | Classes | Example |
| --- | --- | --- |
| Page title (`h1`) | `font-display text-3xl sm:text-4xl` | Nearly every page, e.g. `src/app/[locale]/(shop)/cart/page.tsx` |
| Product headline | `font-display text-[2.25rem] sm:text-[2.75rem] lg:text-[3.25rem]`, `leading-[1.02]` | `src/app/[locale]/(shop)/products/[slug]/page.tsx` |
| Row heading (`h2`) | `font-display text-[1.625rem] sm:text-3xl`; on the product page `text-[1.875rem] sm:text-[2.25rem] lg:text-[2.5rem]` | `ProductRow` |
| Panel title | `font-display text-xl` (20 px) | Cart summary, checkout panels, the title of a `Sheet` |
| Body | 16 px (`text-base`); 16 px in every field so that iOS does not zoom | `TextField` |
| Product name, controls | `text-[0.9375rem]` (15 px), `font-semibold` | `ProductCard`, `Button` |
| Secondary text | `text-sm` (14 px), `text-ink-muted` | Hints, notes |
| Small print | `text-xs` (12 px) or `text-[0.8125rem]`, `text-ink-subtle` or `text-ink-muted` | Price per unit, notes under a button |
| Label in capitals | `text-[0.6875rem]` or `text-xs`, `font-bold`, `tracking-[0.1em]`, `uppercase` (`Eyebrow`: `tracking-[0.14em]`) | The brand line of a card, group captions |
| Price | `font-display`, `tabular-nums`, `leading-none`: `text-xl` on a card, `text-[2rem]`, `text-[2.5rem] sm:text-[2.75rem]` on the product page; red when reduced | `Price` |
| Total of the bill | `font-display text-[1.75rem]` | `BillTotals` |
| Badge | `text-[0.6875rem]`, `font-bold`, `tabular-nums` | Count badges, the discount badge |

Weights in use: 500 (`font-medium`) for quiet text, 600 (`font-semibold`) for names and controls, 700 (`font-bold` and `font-display`) for headlines, labels and badges. Every amount and every count carries `tabular-nums`.

## Spacing, radii, shadows

`globals.css` defines no spacing token: the Tailwind scale applies (one step is 4 px, so `size-11` is the 44 px of an icon control), with arbitrary values where a design asked for them (`gap-[1.125rem]`).

| Radius | Value | Used for |
| --- | --- | --- |
| `rounded-xs` | 10 px | The focus box of a text link, small marks |
| `rounded-sm` | 12 px | Skeleton blocks, the message of a cart line |
| `rounded-md` | 16 px | Fields, the picture of a cart line, address tiles |
| `rounded-lg` | 22 px | Alerts, the picture tile inside a card |
| `rounded-xl` | 28 px | Product and category cards, the card `Disclosure`, the box card |
| `rounded-2xl` | 32 px | Panels: the cart list, the summaries, toasts, popovers, the gallery tile |
| `rounded-3xl` | 40 px | Sheets, the footer panel, the tab bar, the auth card, the search dropdown |
| `rounded-full` | pill | Buttons, chips, steppers, pills, icon controls |

| Shadow | Layers | Used for |
| --- | --- | --- |
| `shadow-card` | `0 0 0 1px rgb(23 33 27 / 0.05)`, `0 1px 2px rgb(23 33 27 / 0.03)`, `0 8px 24px -14px rgb(23 33 27 / 0.12)` | `surface`; the white thumb of the pack-size bar |
| `shadow-header` | `inset 0 1px 0 rgb(255 255 255 / 0.7)`, `0 1px 0 rgb(23 33 27 / 0.05)`, `0 16px 40px -28px rgb(23 33 27 / 0.3)` | The header of the shop and of the plain frame |
| `shadow-lift` | `0 0 0 1px rgb(23 33 27 / 0.06)`, `0 2px 6px rgb(23 33 27 / 0.04)`, `0 22px 44px -22px rgb(23 33 27 / 0.28)` | A card under the pointer, a hovered glass control |
| `shadow-float` | `inset 0 1px 0 rgb(255 255 255 / 0.8)`, `0 0 0 1px rgb(23 33 27 / 0.06)`, `0 2px 8px rgb(23 33 27 / 0.05)`, `0 24px 60px -24px rgb(23 33 27 / 0.32)` | What floats over the page: sheets, toasts, dropdowns, the tab bar, the phone bars |
| `shadow-glass` | `inset 0 1px 0 rgb(255 255 255 / 0.85)`, `inset 0 0 0 1px rgb(255 255 255 / 0.4)`, `0 0 0 1px rgb(23 33 27 / 0.05)`, `0 12px 32px -16px rgb(23 33 27 / 0.16)` | Inside `glass` and `glass-strong` |
| `shadow-leaf` | `inset 0 1px 0 rgb(255 255 255 / 0.25)`, `0 6px 16px -6px rgb(21 122 75 / 0.55)` | The leaf glow under the one action: primary button, basket, stepper |
| `shadow-leaf-lg` | `inset 0 1px 0 rgb(255 255 255 / 0.25)`, `0 10px 22px -6px rgb(21 122 75 / 0.6)` | The same, under the pointer |

## Widths and breakpoints

| Token or utility | Value |
| --- | --- |
| `container-page` | `width: 100%`, `max-width: 84rem`, centred; side gutter `1rem`, `1.5rem` from 40 rem, `2rem` from 64 rem |
| `--breakpoint-xs` | `26rem`; defined, no class uses `xs:` |
| `sm`, `md`, `lg`, `xl` | Tailwind's own: 40, 48, 64 and 80 rem |

Which breakpoint changes what is in [responsive-layout.md](responsive-layout.md).

## How styles are written

| Rule | Detail |
| --- | --- |
| Tailwind CSS v4 utilities in `className` | Loaded by `@import "tailwindcss"` in `src/app/globals.css` through `@tailwindcss/postcss`; there is no Tailwind config file, the theme is the `@theme` block |
| One style sheet | `src/app/globals.css` is the only CSS file: no CSS modules, no styled components |
| `cn` for conditions | `src/lib/cn.ts`: `clsx` joined by `tailwind-merge`, so a later class wins over an earlier one of the same kind; every component takes a `className` and passes it last |
| Custom `@utility` classes for what repeats | The glass surfaces, `font-display`, `container-page`, `leaf-gradient`, `hero-band`, the scrollbars and the animated helpers; they take variants like any utility (`lg:glass`, `group-hover:leaf-gradient`) |
| Class strings as constants | Where links or other elements share a look: `buttonStyles`, `controlStyles`, `iconControl`, `pill` / `pillIdle` / `pillActive`, `authLink` |
| Inline `style` | Only for values computed at run time: the transform of the carousel, the width of a bar, an animation delay, the beat `--i` of a search entry |
| Plain classes outside the layers | Two: `.headline-no-hyphens`, and the rule that hides `.cookie-notice` once it was read |
| Class order | Sorted by `prettier-plugin-tailwindcss` |

## The styleguide page

`/en/styleguide` (`src/app/[locale]/styleguide/page.tsx`) shows the system as it is in the code. It is written in English only, is not linked from the shop and tells search engines to stay away (`robots: { index: false, follow: false }`). The accessibility tests check it like any other page.

| Section | Shows |
| --- | --- |
| Colour | Every swatch of the four families (leaf with moss and olive, neutrals, wheat, red) |
| Type | Display sizes, the product title, body, small, label, a reduced price |
| Glass | `glass`, `glass-strong`, `glass-soft`, `glass-leaf`, `surface` and `glass-dark` |
| Buttons | The seven variants, the three sizes, disabled and loading; `wheat` and `ghost` on a `hero-band` |
| Status chips | The tones with the statuses of orders and payments |
| Messages | The four tones of `Alert` |
| Forms | `TextField` with hint, with error and disabled; the `QuantityStepper` (`src/app/[locale]/styleguide/stepper-demo.tsx`) |
| Loading | `Skeleton` |
| Product card and its states | Up to four real cards from the catalogue: on sale, sold out, without a picture, few left; left out when the API does not answer |

The styleguide does not show `Sheet`, `Tooltip`, `Disclosure`, `Pagination`, `PasswordField`, `Eyebrow` or the floating look of `TextField`.
