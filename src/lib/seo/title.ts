import type { Metadata } from "next";
import type { PackSize } from "@/lib/api/types";
import { formatPackSize, productTitle } from "@/lib/format/product-name";

// The title of a page for the browser tab and the search result. The layout
// appends the shop's name to every title ("Rice | Radhe Foods"). The titles
// the admin panel keeps for search engines may carry the name already
// ("Rice | Radhe Foods"), and a product has one such title for all of its
// pack sizes, each of which is a page of its own.

/** The name of the shop as a title carries it; it is not translated. */
export const SITE_NAME = "Radhe Foods";

const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const squeezed = (text: string) => text.toLowerCase().replace(/\s+/g, "");

/** "Rice | Radhe Foods" → "Rice"; a title without the name at its end stays. */
export function withoutShopName(title: string, shopName = SITE_NAME): string {
  const atTheEnd = new RegExp(`\\s*[|:·–—-]\\s*${escaped(shopName)}\\s*$`, "i");
  return title.replace(atTheEnd, "").trim() || title.trim();
}

/**
 * A title for `Metadata.title` that names the shop once. A title with the
 * shop's name in it stands as it was written; any other is left to the
 * pattern of the layout, which appends the name.
 */
export function titleOnce(
  title: string,
  shopName = SITE_NAME,
): NonNullable<Metadata["title"]> {
  return title.toLowerCase().includes(shopName.toLowerCase())
    ? { absolute: title }
    : title;
}

/** Whether a text names the pack size: "Basmati Rice 1 kg" names "1kg". */
function namesSize(text: string, size: string): boolean {
  const all = squeezed(text);
  const at = all.indexOf(squeezed(size));
  // "100g" is not named by "1100g" or "1,100g"; it is by "chillies, 100 g".
  return at >= 0 && !/[0-9][.,]?$/.test(all.slice(0, at));
}

/** What the title of a product's page is made from (`ProductDetail`). */
export interface TitledProduct {
  name: string;
  /** The API's name with the size the answer stands for: "Basmati Rice (1 kg)". */
  displayName?: string | null;
  seo: { title?: string | null };
}

/**
 * The title of the page of one pack size, without the shop's name. The
 * admin's title for search engines belongs to the product; the page stands
 * for one size, so the size is added when the title does not name it. Two
 * sizes with the same title are one page to a search engine.
 *
 * Without a title of the admin the API sends its own name of the size
 * (`displayName`); that, and a title that is only the product's name,
 * become the title the shop shows on the page ("Guava / Jamfal (500g)").
 *
 * @param packSize the size the page shows: the product's own, or the one
 *                 the customer has switched to
 */
export function productPageTitle(
  product: TitledProduct,
  packSize: PackSize,
  shopName = SITE_NAME,
): string {
  const own = productTitle(product.name, packSize);
  const written = product.seo.title?.trim();
  if (!written) return own;
  const bare = withoutShopName(written, shopName);
  const plain = [product.name, product.displayName].some(
    (given) => given && squeezed(given) === squeezed(bare),
  );
  if (plain) return own;
  const size = formatPackSize(packSize);
  return !size || namesSize(bare, size) ? bare : `${bare} (${size})`;
}
