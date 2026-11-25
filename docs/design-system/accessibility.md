# Accessibility

The shop holds itself to WCAG 2.2, levels A and AA: every kind of page is checked by axe against those rules and its best-practice rules, on a wide screen and on a phone, and a few keyboard and motion tests cover what a scanner cannot see. The patterns below are what the code does today; each names one file where it can be read. An automatic check finds roughly the mechanical half of all barriers (names, roles, contrast, structure), so the last section says plainly what is not tested.

## Focus

One visible focus style everywhere, for keyboard users, set in the base layer of `src/app/globals.css`:

```css
:focus-visible {
  outline: 3px solid var(--color-leaf-600);
  outline-offset: 2px;
}
```

A component never removes it. Where the standard outline would be cut or lost, it is moved, not dropped:

| Case | What is done | File |
| --- | --- | --- |
| A text field | The border turns leaf and the outline stays, at `outline-offset-1` | `src/components/ui/field.tsx` |
| The eye button inside a password field | The outline is drawn inside the button (`outline-offset-[-3px]`) | `src/components/ui/password-field.tsx` |
| A linked banner in a clipped, rounded box | Inside the picture (`outline-offset-[-4px]`) | `src/components/home/hero-carousel.tsx` |
| The search field | A quieter outline (`leaf-600` at 40%, offset 0) with a white fill and a deeper shadow | `src/components/shell/search-form.tsx` |
| An input that is invisible over its drawing (a star, a switch) | The label draws the outline: `has-focus-visible:outline-*` | `src/components/account/star-picker.tsx` |
| A panel that takes focus only to keep itself open | `outline-none` with `tabIndex={-1}`; it is not a tab stop | `src/components/shell/category-nav.tsx` |

Text links get a small radius (`rounded-xs`, `rounded-sm`) so the outline follows them softly.

## Skip link and landmarks

| Pattern | How | File |
| --- | --- | --- |
| Skip link | The first element of `body`: `sr-only` until focused, then fixed at the top left; it leads to `#main` | `src/app/[locale]/layout.tsx` |
| `main` | Every frame renders one `<main id="main">` | `src/app/[locale]/(shop)/layout.tsx` |
| Header and footer | `header` and `footer` elements | `src/components/shell/header.tsx` |
| The promise strip above the header | A `section` with a name: every part of the page belongs to a landmark | `src/components/shell/header.tsx` |
| Navigations | Each `nav` has its own name: categories, tab bar, language, breadcrumb, pages, each column of the footer, the account | `src/components/shell/footer.tsx` |
| Search | `role="search"` with a name, since a page can hold a second search (the blog's) | `src/components/shell/search-form.tsx` |
| Complementary regions | `aside` with a name: the summary of the cart, the cookie notice, the cart bar of phones | `src/components/cart/cart-view.tsx` |
| Sections | `aria-labelledby` pointing at their heading, or `aria-label` | `src/components/home/product-row.tsx` |

## Headings

| Rule | How | File |
| --- | --- | --- |
| One `h1` per page | Visible on nearly every page; `sr-only` where a picture or the layout is the headline (the home page with banners, the checkout) | `src/app/[locale]/(shop)/page.tsx` |
| Cards follow the page | `ProductCard` takes `headingLevel`: `h3` by default (under the `h2` of a row), `h2` in the product lists, whose cards follow the page's `h1` | `src/components/catalogue/product-card.tsx` |
| A folding section is a heading | `Disclosure` takes `headingLevel` (`h2` or `h3`) | `src/components/ui/disclosure.tsx` |
| Texts written by the admin | `LegalText` can step every heading down one level (`demoteHeadings`), so a `#` in a text never becomes a second `h1` | `src/components/legal/legal-text.tsx` |
| A panel whose title is not shown | An `sr-only` heading | `src/components/cart/box-shipping.tsx` |

## Names and labels

| Pattern | How | File |
| --- | --- | --- |
| Fields | A real `label` bound by `htmlFor`, also in the floating look; hint and error bound by `aria-describedby`; `aria-invalid` on a refused field | `src/components/ui/field.tsx` |
| Icon-only controls | `aria-label` on the control, the icon `aria-hidden` | `src/components/shell/cart-link.tsx` |
| Controls repeated per product | The label names the product: "Add to cart: Chakki Atta (5kg)", "Quantity of …", "Save to wishlist: …" | `src/components/catalogue/add-to-cart.tsx` |
| Counts on icons | The badge is `aria-hidden`; the link's label carries the count | `src/components/shell/wishlist-link.tsx` |
| A link whose visible text is short | `aria-label` naming the list: "See all Rice" | `src/components/home/product-row.tsx` |
| A second link to the same page | The picture of a card is `aria-hidden` and out of the tab order (`tabIndex={-1}`); the name is the one link. What the picture's badge says is repeated as `sr-only` text | `src/components/catalogue/product-card.tsx` |
| Meaning carried by colour or a strike | `sr-only` words: "Current price:", "Regular price:", "Line total:" | `src/components/catalogue/price.tsx` |
| Drawings | `role="img"` with a label that carries the whole meaning: "4.6 out of 5, 12 reviews" | `src/components/reviews/rating-stars.tsx` |
| A tip under an icon | Radix `Tooltip`: read as the control's description, never its only name | `src/components/ui/tooltip.tsx` |
| The current item | `aria-current="page"` on links of navigations, breadcrumbs and pages; `aria-current="true"` on the chosen language and the shown slide | `src/components/ui/pagination.tsx` |
| Decoration | `aria-hidden="true"`: icons, skeletons, the ghost of the flight, grab handles, dims | `src/components/ui/skeleton.tsx` |

## Messages that are announced

| Pattern | How | File |
| --- | --- | --- |
| A message on the page | `Alert`: `role="alert"` for `bad` and `warn`, `role="status"` for `info` and `good` | `src/components/ui/alert.tsx` |
| A refused field | The error is a `role="alert"`: a form that refuses on "submit" leaves the focus on the button | `src/components/ui/field.tsx` |
| An action whose control disappears | A `role="status"` that is always in the tree and whose text changes: "Added" for 1.5 s after the tap, since the button the reader was on is gone | `src/components/catalogue/add-to-cart.tsx` |
| A toggle | The same for "Saved" and "Removed", beside `aria-pressed` | `src/components/catalogue/wishlist-button.tsx` |
| A number that changes | `aria-live="polite"` on the number of the stepper | `src/components/ui/quantity-stepper.tsx` |
| A region that is being recalculated | `aria-busy` on the totals, with an `sr-only` `role="status"` saying "updating" | `src/components/cart/cart-view.tsx` |
| A result count | `role="status"` on "N products" of a list | `src/components/catalogue/filters/listing-controls.tsx` |
| Words a listbox cannot hold | "No products match" as a `role="status"` outside the list of options | `src/components/shell/search-form.tsx` |
| Toasts | A failure is a `role="alert"`, a saved change a `role="status"` | `src/components/shell/problem-toast.tsx` |
| A busy button | `aria-busy` and `disabled` while `loading` | `src/components/ui/button.tsx` |
| Content on its way | The first placeholder card of a row is a `role="status"` with `sr-only` text; the other skeletons are hidden | `src/components/home/category-row.tsx` |

## Keyboard patterns

| Component | Keys and behaviour | File |
| --- | --- | --- |
| Category bar | Enter or Space on an item opens its panel (`aria-expanded`, `aria-controls`); Left, Right, Home and End move along the bar; Down goes into the panel; Tab walks its links; Escape closes and returns the focus to the item; leaving the item closes. Closed panels are `hidden` but in the HTML | `src/components/shell/category-nav.tsx` |
| Search | A `combobox` with a `listbox`: Down and Up walk the entries (`aria-activedescendant`, the focus stays in the field), Enter opens the chosen one or sends the form, Escape folds the list, leaving the form closes it. Without scripts it is a plain form | `src/components/shell/search-form.tsx` |
| `Sheet` | A modal dialog (Radix): the focus moves in and stays in, Escape closes, and the focus returns to the control that opened it, also when that is not its `trigger` | `src/components/ui/sheet.tsx` |
| Menu button | `aria-haspopup="dialog"`, `aria-expanded`; the groups inside are buttons with `aria-expanded` and `aria-controls`, and a folded group is `inert` | `src/components/shell/mobile-menu-panel.tsx` |
| Filter pill | A native `details`: the `summary` is the button; Escape closes and returns the focus to it; one panel is open at a time; boxes and radios are native inputs | `src/components/catalogue/filters/facet-popover.tsx` |
| `Disclosure` | A native `details`: Enter or Space; works without scripts | `src/components/ui/disclosure.tsx` |
| `QuantityStepper` | A named `group` of two buttons around the number; a button at its limit is `disabled`; at the minimum, minus is renamed "Remove" | `src/components/ui/quantity-stepper.tsx` |
| Star rating | Five native radios drawn as stars in a `fieldset` with a `legend`: the arrow keys move between them | `src/components/account/star-picker.tsx` |
| Toggles | `aria-pressed` on the heart, the eye of a password field and the thumbnails of the gallery | `src/components/catalogue/product-gallery.tsx` |
| Carousel | `aria-roledescription="carousel"` with slides as named groups; only the shown slide can be tabbed into (`inert` on the others); the dots are buttons; autoplay waits while the focus is inside and stops once the visitor turned a slide | `src/components/home/hero-carousel.tsx` |
| Pack sizes | Links with `aria-current="page"`, so a size opens in a new tab like any link | `src/components/catalogue/product-purchase.tsx` |
| A box that scrolls | `tabIndex={0}` and a name, so it can be scrolled without a mouse: the lines of the checkout, the list of boxes, wide tables of a legal text | `src/components/checkout/checkout-view.tsx` |
| What stops an order | The first refused field takes the focus, or the missing part scrolls into view; the consent box is bound to its error | `src/components/checkout/checkout-view.tsx` |

## Target sizes

| Control | Size |
| --- | --- |
| `Button` | 44, 48 or 52 px high (`sm`, `md`, `lg`) |
| Fields | 48 px high; 56 px in the floating look |
| Icon links of the header, the menu button, page numbers, arrows of a row, filter pills, a star of the picker | 44 px |
| A tab of the tab bar | 56 px high, a quarter of the width |
| The basket of a card, the close button of a sheet | 40 px |
| The heart of a card, the heart and the bin of a cart line, the close button of a toast | 36 px |
| Buttons of the stepper | 36 px (`md`), 32 px (`sm`, the cart line), 28 px (`xs`, and `card` on a product card) |
| An item of the language switch | 32 px high, at least 36 px wide |
| A dot of the carousel | 24 px |

The controls a customer uses most are 44 px or more; the smallest in this table is 24 px. A box or a radio is smaller by itself and stands inside its `label`, which is the target (a row of at least 40 px in the filters).

## Colour and contrast

| Rule | Source |
| --- | --- |
| `ink-subtle` is dark enough for small text on white, canvas and mist (4.5:1) | The token's comment in `src/app/globals.css` |
| `red-600` reads at 4.7:1 on its tint and carries white text at 5.4:1 | The same |
| Wheat is for fills and big numerals; `wheat-800` is the only wheat for text | The same |
| A browser without `backdrop-filter` gets a nearly opaque panel, so text on glass stays readable | The `@supports not` block of every glass utility |
| Products, names and prices stand on solid white, not on glass | [liquid-glass.md](liquid-glass.md) |
| A reduced price is red and is also named ("Current price", "Regular price"); a status chip carries words, not only a colour | `src/components/catalogue/price.tsx` |

Contrast is part of the axe rules, so a colour that fails on a tested page fails the test.

## Motion and language

Everything that moves is stilled for `prefers-reduced-motion: reduce`, and what moves by itself can be stopped; the rule and its exceptions are in [motion.md](motion.md).

| Pattern | How | File |
| --- | --- | --- |
| The language of the page | `<html lang={locale}>` | `src/app/[locale]/layout.tsx` |
| The language switch | Each link carries `lang`, `hrefLang` and a spoken name (the texts `language.en` and `language.de`) | `src/components/shell/locale-switcher.tsx` |
| A text in another language than its page | The block names it with `lang`: a legal text that exists in German only, a review, an article | `src/components/legal/legal-document-page.tsx` |
| The last-resort error page | Both languages on one page, each paragraph with its `lang` | `src/app/global-error.tsx` |

Texts and addresses per language are in [architecture/internationalization.md](../architecture/internationalization.md).

## Without scripts

The search is a plain form that leads to the list; the filters are a form of native inputs with an "Apply" button in `noscript`; the pages of a list are links; folding sections are native `details`; every link of the category bar is in the HTML the server sends.

## What the tests cover

`e2e/accessibility.spec.ts` runs in both Playwright projects (`desktop`: 1280 by 800; `phone`: Pixel 7). `expectNoBarriers` runs axe with the tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa` and `best-practice` and fails on any violation.

| Group | What is scanned |
| --- | --- |
| Public pages | 33 addresses: the home page in both languages; product lists (plain, searched, sorted, filtered, empty); a category; a product in both languages; the empty cart and wishlist; sign-in, sign-up, forgot and reset password; "How it works"; all categories; FAQ; the blog, an article, a blog category and a tag; delivery and payment; legal pages (among them a German text on an English page); a page that does not exist; the styleguide |
| First visit | The home page with the cookie notice shown |
| Buying, signed in | A list with a stepper open on a card; the wishlist with a saved product; the cart with a product; the checkout |
| Account, signed in | Overview, orders, four order pages in different states, the return request, invoices, addresses, profile |
| Open panels | The brand filter open on a wide screen; the filter sheet open on a phone |

| Other test | What it proves |
| --- | --- |
| The skip link | The first Tab stop is "Skip to content", it is in view, and Enter leads to `#main` |
| Add to cart by keyboard | Enter on the button of a product page adds it; the stepper in the button's place can be reached and used |
| Visible focus | Each of the first twelve Tab stops of the home page has an outline |
| Reduced motion | On the orders page no animation runs endlessly or longer than 50 ms |

The three keyboard tests run on the wide screen only.

## What the tests do not cover

| Gap | Detail |
| --- | --- |
| Screen readers | No test listens; whether an announcement is heard, and heard once, is checked by hand |
| What axe cannot decide | The test asserts `violations` only; findings axe returns as needing review are not looked at |
| Most open states | The panel of the category bar, the search dropdown, the phone menu, tooltips, toasts and the sheets of the account are not scanned while open |
| The guest checkout | The checkout is scanned signed in; the choice between sign-in and guest and the guest's forms are not |
| Error and loading states | Refused forms, failed requests and skeletons are not scanned |
| Some pages | The account's pages for reviews, reports, referrals and coins, the public reviews page, the order page of a guest and the unsubscribe page are not in the lists |
| Keyboard paths | Only the three above; the arrow keys of the category bar and of the search, the focus trap of a sheet and the return of the focus are not tested here |
| Zoom, reflow and text spacing | Not tested |
| Target sizes | Not measured by a test |

A change to a component of this document is checked by hand with the keyboard and, where it speaks, with a screen reader; a page that is added joins the list in the test ([development/testing.md](../development/testing.md)).
