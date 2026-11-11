import type { ApiImage, ProductDetail, ProductVariant } from "@/lib/api/types";

// A picture belongs to one pack size of a product (doc VARIANT_IMAGES,
// since 2026-11-11): the 5 kg bag and the 10 kg bag of a rice each have
// their own gallery, and the product itself has none. The rule for the
// whole shop: a size without a picture shows the placeholder, never the
// picture of another size. Lists, the cart, the wishlist and the checkout
// render `image` of their entry, which the API answers for the size the
// entry shows; the product page changes sizes without a request and takes
// the pictures of the chosen size from here.

/**
 * The sizes a product page offers, smallest first; the product as the size
 * it is shown as, should `variants` not list it.
 */
export function packSizesOf(product: ProductDetail): ProductVariant[] {
  if (product.variants.length > 0) return product.variants;
  return [
    {
      id: product.variantId,
      sku: product.sku,
      slug: product.slug,
      packSize: product.packSize,
      displayName: product.displayName,
      pricing: product.pricing,
      ordering: product.ordering,
      isDefault: true,
      isSelected: true,
      image: product.image,
      images: product.images,
    },
  ];
}

/**
 * The gallery of one size of a product page, main picture first; empty
 * when the size has no picture. `product.images` is the gallery of the
 * size the page was loaded for and stands in for that size alone.
 */
export function galleryOf(
  product: ProductDetail,
  size: ProductVariant,
): ApiImage[] {
  if (size.images) return size.images;
  if (size.id === product.variantId) return product.images;
  return size.image ? [size.image] : [];
}

/**
 * The main pictures of the sizes a product page was not loaded for, to be
 * fetched ahead so that a change of size shows its picture at once. Each
 * file once: two sizes can show the same file under ids of their own, and
 * the file the page shows already is not asked for again.
 */
export function mainPicturesOfOtherSizes(product: ProductDetail): ApiImage[] {
  const shown = product.images[0] ?? product.image;
  const files = new Set<string>(shown ? [shown.sizes.medium.url] : []);
  const pictures: ApiImage[] = [];
  for (const size of packSizesOf(product)) {
    if (size.id === product.variantId) continue;
    const main = galleryOf(product, size)[0];
    if (!main || files.has(main.sizes.medium.url)) continue;
    files.add(main.sizes.medium.url);
    pictures.push(main);
  }
  return pictures;
}

/**
 * The three ready-made widths of a picture (320, 800 and 1600 px at most)
 * as a `srcset`. The addresses are used exactly as the API gives them:
 * their content never changes, so nothing is added to them.
 */
export function srcSetOf(image: ApiImage): string {
  const { small, medium, large } = image.sizes;
  return `${small.url} ${small.width}w, ${medium.url} ${medium.width}w, ${large.url} ${large.width}w`;
}
