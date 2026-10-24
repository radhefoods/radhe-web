import { describe, expect, it } from "vitest";
import type { ApiImage, Category, ProductSummary } from "@/lib/api/types";
import { shopCategories, standInPictures } from "./categories";

const picture = (id: string) => ({ id }) as ApiImage;
const category = (id: string, productCount: number, image: ApiImage | null) =>
  ({ id, productCount, image }) as Category;
const product = (image: ApiImage | null) => ({ image }) as ProductSummary;

describe("shopCategories", () => {
  it("keeps the categories with products, in their order", () => {
    const rice = category("rice", 5, null);
    const empty = category("empty", 0, null);
    const spices = category("spices", 2, null);
    expect(shopCategories([rice, empty, spices])).toEqual([rice, spices]);
  });
});

describe("standInPictures", () => {
  it("gives a category without a picture the first picture of its row", () => {
    const own = picture("own");
    const first = picture("first");
    const pictures = standInPictures([
      {
        category: category("rice", 3, null),
        items: [product(null), product(first), product(picture("later"))],
      },
      // The admin's own picture is not replaced.
      { category: category("spices", 3, own), items: [product(first)] },
      // Nothing to stand in: the mark shows.
      { category: category("snacks", 1, null), items: [product(null)] },
      { category: category("fruits", 1, null), items: [] },
    ]);
    expect(pictures).toEqual({ rice: first });
  });
});
