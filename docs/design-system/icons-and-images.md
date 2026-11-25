# Icons and images

The shop draws its icons from one library, shows one logo in three web sizes, and takes every picture of a product, a category, a banner or a post from the API in ready-made sizes. No picture goes through the image optimiser of Next.js: every `img` is a plain element with a `srcset`. A picture that is missing or cannot be loaded is replaced by the Radhe mark, ghosted like a watermark, never by an empty tile.

## Icons

Icons come from `lucide-react`, imported by name in the file that uses them (`import { Heart } from "lucide-react"`). They are drawn in the current text colour, so a colour class on the icon or on its parent tints them.

| Size | Class | Used for |
| --- | --- | --- |
| 14 px | `size-3.5` | Inside the slim steppers, the cross of an applied-filter chip, the scroll hint of the checkout |
| 16 px | `size-4` | Beside a line of text: promises of the header, chevrons, arrows of links, the glyph of a status pill |
| 18 px | `size-[18px]` or `size-[1.125rem]` | The heart, the bin of a cart line, the glass of the search field, the lock of "Buy now" |
| 20 px | `size-5` | Inside buttons and round controls: close, the arrows of `Pagination` and of a row, the eye of a password field, the basket of a card |
| 24 px | `size-6` | The icon links of the header, the menu button, the tabs of the tab bar |
| 28 px and more | `size-7`, `size-8`, `size-10` | The stars of the `StarPicker`, the bag of the empty cart, the sign of an empty list |

| Stroke width | Where |
| --- | --- |
| The library's default | Most icons |
| `2.25` | Hearts, the chevron of `Disclosure`, the lock, the arrow of the checkout button, the small glyphs of the search dropdown |
| `2.5` | Small glyphs in a round control: the button of the search field, the arrow of a category card |
| `2.1` | The basket of a card |
| `1.9` | The package of `BoxShipping` |
| `3` | The small ticks of the order page (`src/components/account/order-detail.tsx`) |
| `0` | Filled stars (`fill-current`); the empty stars of the `StarPicker` use `1.5` |

A saved heart and a filled star are the same icon with `fill-current`.

### Icons and screen readers

| Case | Pattern | Example |
| --- | --- | --- |
| An icon beside a text | `aria-hidden="true"` on the icon | `src/components/shell/header.tsx` |
| An icon-only control | `aria-hidden="true"` on the icon, `aria-label` on the link or button | `src/components/shell/cart-link.tsx` |
| A drawing that carries meaning | `role="img"` with `aria-label` on the wrapper, its parts hidden | `src/components/reviews/rating-stars.tsx` |
| A count on an icon | The badge is `aria-hidden`; the control's label carries the number | `CartBadge` in `src/components/shell/cart-link.tsx` |

No icon in the shop is exposed to assistive technology on its own.

## The logo

`Logo` (`src/components/shell/logo.tsx`) is the Radhe wordmark with the peacock feather. The wordmark is the leaf green of the shop; the feather is the delivered drawing, untouched.

| File | Width | Use |
| --- | --- | --- |
| `public/brand/radhe-logo-160.webp` | 160 px | `srcset` |
| `public/brand/radhe-logo-240.webp` | 240 px | `src` and `srcset` |
| `public/brand/radhe-logo-480.webp` | 480 px | `srcset`; the logo of the structured data (`src/lib/seo/json-ld.tsx`) |

The component is a plain `img` (`sizes="100px"`, `width={240}`, `height={144}`, `alt="Radhe Foods"`); the files are small and already sized, so the optimiser would add nothing. Its height is set by the caller, the width follows (`h-10 w-auto` by default):

| Place | Height classes |
| --- | --- |
| Header of the shop | `h-11 md:h-12 lg:h-15` |
| Footer | `h-12 sm:h-14` |
| Checkout frame | `h-9 md:h-10` |
| Plain frame (email links) | `h-10 md:h-11` |

The files are drawn for light backgrounds: the logo stands on white, glass or mist, never on the dark band. In the header and the frames it is wrapped in a link to the home page that carries its own spoken name (`nav.logoHome`).

The sources are in `logo/`, outside what the shop serves:

| File | What it is |
| --- | --- |
| `logo/radhe-foods-original.png` | The mark as delivered, with the blue wordmark |
| `logo/radhe-logo-green.png` | The full-size source of the web files, wordmark in leaf green |
| `logo/radhe-logo-transparent.png`, `logo/radhe-logo-transparent.webp` | The delivered mark on a transparent ground |
| `logo/radhe-logo-white.png`, `logo/radhe-logo-white.webp`, `logo/radhe-logo.svg` | Further versions kept with the sources; no page uses them |

## The brand icon

The icon of the shop is a peacock feather, computed by `scripts/make-icons.mjs` (run by hand after a change of the drawing; the results are committed).

| File | Size | For |
| --- | --- | --- |
| `src/app/favicon.ico` | 16, 32 and 48 px | Browser tabs |
| `src/app/icon.svg` | The drawing itself | Any size |
| `src/app/icon.png` | 192 px | Search engines |
| `src/app/apple-icon.png` | 180 px, on the shop's ground | iOS home screen |
| `public/brand/icon-192.png`, `public/brand/icon-512.png` | On the shop's ground | The web manifest (`src/app/manifest.ts`) |
| `public/brand/icon-maskable-512.png` | Smaller in its square | Android's masks |

The ground is the canvas (`#f1f6f1`), which is also the manifest's `background_color` and `theme_color`. The picture for links shared on social media is `public/brand/radhe-social-1200x630.jpg` (`src/lib/seo/open-graph.ts`); pages with a picture of their own replace it, see [architecture/seo.md](../architecture/seo.md).

## Payment marks

`PaymentMarks` (`src/components/catalogue/payment-marks.tsx`) shows Visa, Mastercard, American Express and PayPal as small inline SVGs in the brands' own colours, so no file of a card scheme is hosted. Each mark is a `role="img"` with the brand's name; the list takes a spoken name (`label`). Each sits in a white chip of 48 by 32 px (`h-8 w-12`, `rounded-lg`, a hairline ring). These brand colours are the only colours in the shop outside the tokens. Used under the buying part of the product page and under the button of the checkout; which methods the shop accepts is in [features/payments.md](../features/payments.md).

## Product pictures

`ProductImage` (`src/components/catalogue/product-image.tsx`) renders a picture of the API. The API delivers three WebP sizes (320, 800 and 1600 px wide) with their dimensions; `srcSetOf` (`src/lib/catalogue/pictures.ts`) builds the `srcset`, the medium size is the `src`, and the addresses are used exactly as given.

| Prop | Meaning |
| --- | --- |
| `image` | The API's picture, or `null` |
| `alt` | Overrides the picture's own description; `""` where the name stands beside it |
| `sizes` | How wide the picture is shown, as for `<img sizes>`; required |
| `priority` | `true`: `loading="eager"` and `fetchPriority="high"` (the main picture of a page). `"eager"`: at once, but not ahead of another picture that heads the page. Default: lazy |
| `fallbackLabel` | The caption under the mark when there is no picture; `""` for none (small tiles) |

The picture is `object-contain` on a white tile with padding, never cropped, and decoded asynchronously. A pack size that cannot be ordered shows it at 40% opacity in greyscale.

| Place | `sizes` | Tile |
| --- | --- | --- |
| A card in a grid | `(min-width: 1344px) 268px, (min-width: 1024px) 22vw, (min-width: 768px) 30vw, 46vw` | Square, `rounded-lg`, `p-3`; the first four of a grid load at once |
| A card in a row | `(min-width: 1344px) 228px, (min-width: 1280px) 18vw, (min-width: 1024px) 22vw, (min-width: 640px) 30vw, 44vw` | The same |
| The gallery of the product page | `(min-width: 1344px) 566px, (min-width: 1024px) 42vw, (min-width: 768px) 46vw, 92vw` | Square `surface`, `rounded-2xl`; thumbnails 80 px (96 px from `sm`) |
| A cart line | `80px` | 64 px on phones, 76 px from `sm`, `rounded-md` |
| A checkout line | `56px` | 56 px, `rounded-lg` |
| A search entry | `44px` | 44 px, `rounded-lg` |

The largest width named is that of the page's container (84 rem, 1344 px): beyond it a card stays as wide as it is.

### When there is no picture

| Case | What shows |
| --- | --- |
| The pack size has no picture (`image` is `null`) | The Radhe mark at 30% opacity (52% of the tile, at most 160 px) on a soft white glow, with `fallbackLabel` under it in small capitals |
| The file cannot be loaded (the API deleted it after the page was rendered) | The same, instead of the browser's broken-picture sign; checked on `error` and once when the picture is on the page |
| Another size of the product has a picture | Still the mark: a size is never shown with the picture of another size |

The rules behind this are in [features/product-page.md](../features/product-page.md).

## Other pictures

| Picture | Component | How it is shown |
| --- | --- | --- |
| A category | `CategoryCard` (`src/components/catalogue/category-card.tsx`) | 4:3 tile; the category's own picture fills it cropped (`object-cover`) on mist; without one, the picture of its first product stands in on white, uncropped; without either, the mark at 25% opacity |
| A banner | `HeroCarousel` (`src/components/home/hero-carousel.tsx`) | In a box of its own ratio, never cropped, `sizes="100vw"`; the first loads at once with high priority |
| A post | `PostImage` (`src/components/blog/post-image.tsx`) | Fills its box cropped; without a picture the mark at 30% on mist |

All take the API's three ready-made sizes in a `srcset`, as the product pictures do, and reserve their place by `width` and `height` or an aspect ratio, so the page does not jump when they arrive.

## Placeholders while loading

Content that is on its way is a `Skeleton` in the shape of what will come: a `cloud` block with a band of light passing over it ([motion.md](motion.md)). Pictures themselves have no blurred preview: the white or mist tile holds the place.

## Formats

| Kind | Format |
| --- | --- |
| Product, category, banner and post pictures | WebP, from the API |
| The logo | WebP (`public/brand`), PNG and SVG sources (`logo/`) |
| Icons of the interface | Inline SVG from `lucide-react`; the payment marks as inline SVG |
| The brand icon | ICO, SVG and PNG |
| The social picture | JPEG, 1200 by 630 px |
