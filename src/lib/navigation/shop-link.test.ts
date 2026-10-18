import { describe, expect, it } from "vitest";
import { shopHref } from "./shop-link";

describe("shopHref", () => {
  it("turns the paths of the API into links of the router", () => {
    expect(shopHref("/products/basmati-rice-1kg")).toEqual({
      pathname: "/products/[slug]",
      params: { slug: "basmati-rice-1kg" },
    });
    expect(shopHref("/categories/rice")).toEqual({
      pathname: "/category/[slug]",
      params: { slug: "rice" },
    });
    expect(shopHref("/category/whole-spices/")).toEqual({
      pathname: "/category/[slug]",
      params: { slug: "whole-spices" },
    });
    expect(shopHref("/")).toBe("/");
    expect(shopHref("/products")).toBe("/products");
    expect(shopHref("/products/")).toBe("/products");
    expect(shopHref("/delivery-and-payment")).toBe("/delivery-and-payment");
  });

  it("answers null for a path it does not know", () => {
    expect(shopHref("/offers")).toBeNull();
    expect(shopHref("/products/not a slug")).toBeNull();
    expect(shopHref("/products/basmati?size=1kg")).toBeNull();
    expect(shopHref("https://example.com/products/x")).toBeNull();
  });
});
