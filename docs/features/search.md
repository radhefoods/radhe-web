# Search

The search field of the header and the page of results behind it. Every visitor uses it to find a product by a word of its name, its brand or its item number. The field suggests while the customer types; Enter leads to the product list narrowed to the words.

| | |
| --- | --- |
| **Status** | Implemented |
| **Since** | Phase 2 of the original plan, before 2026-10-11 (the log gives no day); the live dropdown since 2026-10-28 |
| **Pages** | The field: every shop page. The results: `/en/products?q=…` · `/de/produkte?q=…` |
| **Code** | `src/components/shell/search-form.tsx`, `src/app/[locale]/(shop)/products/page.tsx`, `src/features/catalogue/listing-state.ts` |
| **API** | [Catalogue](../api/endpoints.md#catalogue) |
| **State** | The address bar (`q`) for the results; the typed text and the open dropdown in component state; answers in the TanStack Query cache of the tab |
| **Texts** | `common` (the field and the dropdown), `catalogue` (the results page) |
| **Tests** | `e2e/catalogue.spec.ts` ("finding products"), `src/features/catalogue/listing-state.test.ts` |
| **Backend reference** | [store-api.md](../reference/backend/store-api.md) (section 7, `GET /v1/store/products`) |

## What the customer sees

### The field

A slim rounded field in the header with the placeholder "Search for rice, dal, spices …", a magnifier at its start and a round leaf button at its end. Beside the logo from `lg`; on smaller screens a row of its own under the logo. It is a plain form that sends `q` to the product list, so it works before any script has loaded.

### The dropdown

With the focus in the field (a click, Tab, typing or an arrow key) the page behind dims and a white panel unfolds under the field, exactly as wide as the field. What it holds:

| State | When | Content |
| --- | --- | --- |
| Loading | An answer is on its way | A spinner and "Searching …" |
| Empty field, or one character | Fewer than 2 characters typed | "Recommended for you": up to 4 featured products as small tiles (picture, name with size, price). "Popular right now": up to 6 of the first products of the catalogue that are not among the featured ones, as rows in two columns. A group without products is left out; with neither, no dropdown opens |
| Results | 2 to 80 characters, after a pause of 250 ms | Left, "Suggestions": up to 5 search terms, then up to 3 brands marked "Brand"; when there is neither, one row "Search for “{q}”". Right, "Products": up to 5 products (picture, name with size, price per unit, price, the regular price struck through when reduced). Under both "View all results for “{q}”" when the API has more than 5 |
| Nothing | The API finds no product | "No products match “{q}”" |
| Error | The request failed | "The search is not available right now. Please try again in a moment." |

Where each entry leads:

| Entry | Address |
| --- | --- |
| A product | Its product page |
| A search term, "Search for …", "View all results …" | `/en/products?q=<words>` |
| A brand | `/en/products?brand=<brand>`: the list filtered by the brand, without the typed words |

The dropdown closes on Escape, on a press on the dimmed page, when the focus leaves the form, and when an entry is followed.

### The results page

The product list ([Catalogue](catalogue.md)) with the heading "Results for “{query}”" in place of "All products" and without the intro line. Filters, sorting and pages work as on every list and keep the words. An empty result shows "Nothing found", "We found nothing for “{query}”. Check the spelling or try a shorter word." and the button "Show all products".

## Rules

| Case | What happens | Decided by |
| --- | --- | --- |
| What matches | Every typed word must begin a word of the product's name, subtitle, brand, tags, search keywords or the item number of one of its sizes; umlauts are folded | The API ([store-api.md](../reference/backend/store-api.md)) |
| The order of results | The admin's order unless a sorting is chosen | The API |
| The products of the dropdown | One entry per product (`view=product`) | The API; the shop asks for that view |
| The cards of the results page | One card per pack size, the sizes of a product together (`view=variants_by_product`) | The API; the shop asks for that view |
| Fewer than 2 characters | The field refuses to submit (`minlength`); typed into the address by hand, `q` is ignored and the plain list shows | The browser (`parseListingState`) |
| More than 80 characters | The field takes no more (`maxlength`); a longer `q` in the address is cut to 80 | The browser |
| The brands of the dropdown | The `brands` of the facets for the same words, in the API's order, placeholders such as "N/A" dropped (`brandOf`), the first 3 | The API counts, the browser picks |
| The search terms of the dropdown | Derived from the products found; see below | The browser (`termsOf`) |
| Which answer shows | Only the answer for the words in the field: answers are keyed by the words they were asked for | The browser |
| Search engines | A results page says `noindex, follow` | The browser ([SEO](../architecture/seo.md)) |

**How the search terms are made.** The browser takes the names and brands of the (at most 5) products of the dropdown, splits them into words, and keeps a word when it has at least 3 characters, begins with one of the typed words (case and accents ignored) and is not the typed text itself. The words are ordered by how many products carry them; the first 5 show. The beginning that matches is set in leaf.

**Worked example.** The customer types "ma". After 250 ms the browser asks `GET /v1/store/products?q=ma&limit=6&view=product` and `GET /v1/store/products/facets?q=ma`. Suppose the API answers two products, "Garam Masala" and "Kesar Mango". `termsOf` yields "Masala" and "Mango" (each begins with "ma", each from one product; "Garam" and "Kesar" do not begin with "ma"), shown as "**Ma**sala" and "**Ma**ngo". Had the API reported a `total` above 5, the first 5 products would show with "View all results for “ma”" under them. Enter with no entry chosen leads to `/en/products?q=ma`, whose heading is "Results for “ma”".

## Data and API

The dropdown talks to the API from the browser; the results page is rendered on the server.

| Call | When | Kept fresh for | On failure |
| --- | --- | --- | --- |
| `GET /v1/store/products?featured=true&limit=4&view=product` | The dropdown opens | 300 s | The group is left out |
| `GET /v1/store/products?limit=10&view=product` | The dropdown opens | 300 s | The group is left out |
| `GET /v1/store/products?q=…&limit=6&view=product` | 250 ms after the last keystroke, 2 to 80 characters | 60 s | The error line |
| `GET /v1/store/products/facets?q=…` | With the request above | 60 s | No brands |
| `GET /v1/store/products?q=…&view=variants_by_product&limit=24` and the facets | The results page, on the server | 300 s, tag `catalogue` | The error page |

No request is repeated on failure (`retry: false`); a request whose words are outdated is cancelled. The typed text is debounced by `useDebounced`: one request per pause, not per key.

## Behaviour

**Keyboard.**

| Key | Effect |
| --- | --- |
| Arrow down, arrow up | Opens the dropdown when closed; else moves through the entries in the order they are drawn (terms, brands, products, "View all results"), wrapping round; arrow up from the field goes to the last entry |
| Enter | With an entry chosen: opens it. Otherwise: submits the field and leads to the results |
| Escape | Closes the dropdown |

**Screen reader.** The field is a combobox named "Search" that controls a listbox named "Suggestions"; every entry is an option, and the chosen one is announced through `aria-activedescendant`. The headings over the groups are for the eye; the groups carry the same words as their label. "No products match …" and the error are spoken through a status region, since they are not options.

**Motion.** The dropdown glides to the height of its content, a change of content fades over 150 ms, and the entries appear one beat after another (`reveal-stagger` in `src/app/globals.css`); closing takes 220 ms. The reduced-motion preference stills all of it.

**Phones.** The dropdown holds one column; the tiles of "Recommended for you" stand two in a row. The tab "Search" of the tab bar leads to the product list, where the field is at the top of the page.

**Pictures.** A product without a picture shows the Radhe mark without a caption.

## Not built

- Tolerance for typing mistakes, synonyms or matches inside a word: the API matches the beginnings of words.
- Categories, blog posts or help pages among the suggestions. The blog has a search of its own ([Blog](blog.md)).
- A list of recent searches.
- The words of a search in the header's field on the results page: the field starts empty on every page, and the heading names the words.
- A brand page: a brand suggestion leads to the product list filtered by that brand ([Catalogue](catalogue.md)).
- Stock or "sold out" in the dropdown: an entry shows name and prices only.

## Code map

| File | What it is |
| --- | --- |
| `src/components/shell/search-form.tsx` | `SearchForm`: the field, the queries, the content of the dropdown, keyboard and motion; `termsOf`, `highlight`, `entriesOf` |
| `src/components/shell/header.tsx` | Places the field (`id="header-search"`) |
| `src/app/[locale]/(shop)/products/page.tsx` | The results page: heading, title and `robots` for a search |
| `src/features/catalogue/listing-state.ts` | `parseListingState` reads and checks `q`; `listingView` chooses the view |
| `src/components/catalogue/product-listing.tsx` | The list and its empty state |
| `src/components/catalogue/product-image.tsx` | The pictures of the entries |
| `src/lib/format/product-name.ts` | The names of the entries; `brandOf` |
| `src/lib/seo/json-ld.tsx` | `websiteJsonLd`: the search address a search engine may offer |
