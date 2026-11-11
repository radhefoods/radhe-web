import { describe, expect, it } from "vitest";
import type { ApiImage, ProductDetail, ProductVariant } from "@/lib/api/types";
import { productJsonLd } from "@/lib/seo/json-ld";
import {
  galleryOf,
  mainPicturesOfOtherSizes,
  packSizesOf,
  srcSetOf,
} from "./pictures";

function picture(id: string, file = id): ApiImage {
  const size = (name: string, width: number) => ({
    url: `https://cdn.example/${file}/${name}.webp`,
    width,
    height: width,
  });
  return {
    id,
    alt: id,
    isPrimary: false,
    url: size("large", 1600).url,
    sizes: {
      small: size("small", 320),
      medium: size("medium", 800),
      large: size("large", 1600),
    },
  };
}

function size(
  id: string,
  images: ApiImage[] | undefined,
  image: ApiImage | null = images?.[0] ?? null,
): ProductVariant {
  return {
    id,
    sku: `RF-${id}`,
    slug: `rice-${id}`,
    packSize: { value: 1, unit: "kg", label: id },
    displayName: `Rice (${id})`,
    pricing: {
      currency: "EUR",
      price: 599,
      regularPrice: 599,
      salePrice: null,
      onSale: false,
      discountPercent: 0,
      discountAmount: 0,
      vatIncluded: true,
      vatRate: 700,
      vatPercent: 7,
      vatAmount: 39,
      basePrice: { amount: 599, per: "kg" },
    },
    ordering: null,
    isDefault: false,
    isSelected: false,
    image,
    ...(images && { images }),
  };
}

/** A rice shown as its 5 kg bag: 1 kg and 5 kg with pictures, 10 kg without. */
function rice(variants: ProductVariant[], selected = "5kg"): ProductDetail {
  const shown = variants.find((variant) => variant.id === selected);
  return {
    id: "rice",
    variantId: selected,
    sku: `RF-${selected}`,
    slug: `rice-${selected}`,
    name: "Rice",
    displayName: `Rice (${selected})`,
    subtitle: null,
    shortDescription: null,
    brand: null,
    category: null,
    packSize: { value: 5, unit: "kg", label: selected },
    pricing: size(selected, []).pricing,
    isAvailable: true,
    isFeatured: false,
    quantity: { min: 1, max: null },
    ordering: null,
    storageType: "ambient",
    tags: [],
    image: shown?.image ?? null,
    variants,
    variantCount: variants.length,
    slugs: { en: `rice-${selected}`, de: `reis-${selected}` },
    gtin: null,
    description: null,
    highlights: [],
    uses: [],
    images: shown?.images ?? [],
    breadcrumbs: [],
    food: {
      ingredients: null,
      allergens: null,
      nutrition: null,
      storageInstructions: null,
      origin: null,
      manufacturer: null,
    },
    seo: { title: null, description: null },
    publishedAt: null,
    updatedAt: "2026-11-11T09:00:00.000Z",
  };
}

const small = [picture("1kg-front")];
const big = [picture("5kg-front"), picture("5kg-back")];
const sizes = () => [size("1kg", small), size("5kg", big), size("10kg", [])];

describe("galleryOf", () => {
  it("gives every size its own pictures, main picture first", () => {
    const product = rice(sizes());
    const [one, five] = product.variants;
    expect(galleryOf(product, one)).toEqual(small);
    expect(galleryOf(product, five)).toEqual(big);
  });

  it("gives a size without pictures none, never those of another size", () => {
    const product = rice(sizes());
    expect(galleryOf(product, product.variants[2])).toEqual([]);
    // Whichever size the page was loaded for.
    const loadedForEmpty = rice(sizes(), "10kg");
    expect(galleryOf(loadedForEmpty, loadedForEmpty.variants[2])).toEqual([]);
    expect(loadedForEmpty.images).toEqual([]);
  });

  it("takes the page's own gallery for the size the page was loaded for only", () => {
    // An answer whose sizes carry no galleries: the product's pictures are
    // those of the selected size and of no other.
    const bare = [
      size("1kg", undefined, null),
      size("5kg", undefined, null),
      size("10kg", undefined, null),
    ];
    const product = { ...rice(bare), images: big, image: big[0] };
    expect(galleryOf(product, product.variants[1])).toEqual(big);
    expect(galleryOf(product, product.variants[0])).toEqual([]);
    expect(galleryOf(product, product.variants[2])).toEqual([]);
  });

  it("shows the main picture of a size that came without its gallery", () => {
    const product = rice([size("1kg", undefined, small[0]), size("5kg", big)]);
    expect(galleryOf(product, product.variants[0])).toEqual(small);
  });
});

describe("packSizesOf", () => {
  it("is the list of the answer", () => {
    const product = rice(sizes());
    expect(packSizesOf(product)).toBe(product.variants);
  });

  it("makes the shown size from the product when the list is empty", () => {
    const product = { ...rice([]), image: big[0], images: big };
    const [only] = packSizesOf(product);
    expect(only).toMatchObject({ id: "5kg", slug: "rice-5kg", image: big[0] });
    expect(galleryOf(product, only)).toEqual(big);
  });
});

describe("mainPicturesOfOtherSizes", () => {
  it("names the main picture of each other size that has one", () => {
    expect(mainPicturesOfOtherSizes(rice(sizes()))).toEqual([small[0]]);
    expect(mainPicturesOfOtherSizes(rice(sizes(), "10kg"))).toEqual([
      small[0],
      big[0],
    ]);
  });

  it("asks for a file once, and not for the one the page shows", () => {
    // "Copy from another pack size": an entry of its own, the same file.
    const copy = picture("10kg-front", "5kg-front");
    const again = picture("20kg-front", "1kg-front");
    const product = rice([
      size("1kg", small),
      size("5kg", big),
      size("10kg", [copy]),
      size("20kg", [again]),
    ]);
    expect(mainPicturesOfOtherSizes(product)).toEqual([small[0]]);
  });

  it("is empty for a product in one size", () => {
    expect(mainPicturesOfOtherSizes(rice([size("5kg", big)]))).toEqual([]);
  });
});

describe("srcSetOf", () => {
  it("lists the three widths with the addresses as they came", () => {
    expect(srcSetOf(picture("a"))).toBe(
      "https://cdn.example/a/small.webp 320w, https://cdn.example/a/medium.webp 800w, https://cdn.example/a/large.webp 1600w",
    );
  });
});

describe("productJsonLd", () => {
  type Size = { "@id": string; image?: string[] };

  it("gives each size its own pictures and none to a size without", () => {
    const data = productJsonLd(rice(sizes()), "en");
    const [one, five, ten] = data.hasVariant as Size[];
    expect(one.image).toEqual(["https://cdn.example/1kg-front/large.webp"]);
    expect(five.image).toEqual([
      "https://cdn.example/5kg-front/large.webp",
      "https://cdn.example/5kg-back/large.webp",
    ]);
    expect(ten).not.toHaveProperty("image");
    // The group shows the size of the page.
    expect(data.image).toEqual(five.image);
  });

  it("leaves the picture out of the group when the shown size has none", () => {
    const data = productJsonLd(rice(sizes(), "10kg"), "en");
    expect(data).not.toHaveProperty("image");
    const [one, , ten] = data.hasVariant as Size[];
    expect(one.image).toHaveLength(1);
    expect(ten).not.toHaveProperty("image");
  });
});
