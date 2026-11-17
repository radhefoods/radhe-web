import { describe, expect, it } from "vitest";
import type { PackSize } from "@/lib/api/types";
import { productPageTitle, titleOnce, withoutShopName } from "./title";

const size = (value: number, unit: PackSize["unit"], label: string) => ({
  value,
  unit,
  label,
});

describe("withoutShopName", () => {
  it("takes the shop's name from the end of a title", () => {
    expect(withoutShopName("Rice | Radhe Foods")).toBe("Rice");
    expect(withoutShopName("The perfect dal – Radhe Foods")).toBe(
      "The perfect dal",
    );
    expect(withoutShopName("Reis - radhe foods ")).toBe("Reis");
  });

  it("leaves every other title as it is", () => {
    expect(withoutShopName("Basmati Rice")).toBe("Basmati Rice");
    expect(withoutShopName("Radhe Foods Chai")).toBe("Radhe Foods Chai");
    // A title that is nothing but the name is not emptied.
    expect(withoutShopName("Radhe Foods")).toBe("Radhe Foods");
  });
});

describe("titleOnce", () => {
  it("keeps a title that names the shop as it was written", () => {
    // The layout would append the name a second time.
    expect(titleOnce("Rice | Radhe Foods")).toEqual({
      absolute: "Rice | Radhe Foods",
    });
    expect(titleOnce("Versand bei RADHE FOODS")).toEqual({
      absolute: "Versand bei RADHE FOODS",
    });
  });

  it("leaves any other title to the pattern of the shop, which appends the name", () => {
    expect(titleOnce("Rice")).toBe("Rice");
  });
});

describe("productPageTitle", () => {
  const small = size(100, "g", "100 g");
  const large = size(250, "g", "250 g");
  const chillies = (title: string | null) => ({
    name: "Aachi Long Red Chillies with Stem",
    displayName: "Aachi Long Red Chillies with Stem (100 g)",
    seo: { title },
  });

  it("is the shop's own title without a title of the admin", () => {
    // The API then sends its own name of the size, which the shop never
    // shows as it comes.
    const guava = {
      name: "Guava (Jamfal)",
      displayName: "Guava (Jamfal) (500 g)",
      seo: { title: "Guava (Jamfal) (500 g)" },
    };
    expect(productPageTitle(guava, size(500, "g", "500 g"))).toBe(
      "Guava / Jamfal (500g)",
    );
    // The customer has switched to another size on the same page.
    expect(productPageTitle(guava, size(1, "kg", "1 kg"))).toBe(
      "Guava / Jamfal (1kg)",
    );
    expect(productPageTitle(chillies(null), small)).toBe(
      "Aachi Long Red Chillies with Stem (100g)",
    );
    expect(productPageTitle(chillies("  "), small)).toBe(
      "Aachi Long Red Chillies with Stem (100g)",
    );
  });

  it("gives every pack size of a product a title of its own", () => {
    // What the catalogue holds today: one title for all sizes, with the
    // shop's name, which the layout appends itself.
    const product = chillies("Aachi Long Red Chillies with Stem | Radhe Foods");
    expect(productPageTitle(product, small)).toBe(
      "Aachi Long Red Chillies with Stem (100g)",
    );
    expect(productPageTitle(product, large)).toBe(
      "Aachi Long Red Chillies with Stem (250g)",
    );
  });

  it("adds the size to a title the admin wrote, unless it names it", () => {
    expect(productPageTitle(chillies("Buy red chillies online"), small)).toBe(
      "Buy red chillies online (100g)",
    );
    expect(productPageTitle(chillies("Red chillies, 100 g pack"), small)).toBe(
      "Red chillies, 100 g pack",
    );
    // "1100g" does not name "100g".
    expect(productPageTitle(chillies("Red chillies 1100g"), small)).toBe(
      "Red chillies 1100g (100g)",
    );
  });
});
