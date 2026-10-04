import { describe, expect, it } from "vitest";
import { parseReturnTo, returnHref } from "./return-to";

describe("parseReturnTo", () => {
  it("accepts the pages of the list", () => {
    expect(parseReturnTo("/checkout")).toBe("/checkout");
    expect(parseReturnTo("/cart")).toBe("/cart");
    expect(parseReturnTo(["/account/profile", "/cart"])).toBe(
      "/account/profile",
    );
  });

  it("accepts the page of one order", () => {
    expect(parseReturnTo("/account/orders/RF-1084")).toBe(
      "/account/orders/RF-1084",
    );
    expect(parseReturnTo("/account/orders/rf-1084")).toBe(
      "/account/orders/RF-1084",
    );
  });

  it("falls back to the account for everything else", () => {
    expect(parseReturnTo(undefined)).toBe("/account");
    expect(parseReturnTo(null)).toBe("/account");
    expect(parseReturnTo("")).toBe("/account");
    expect(parseReturnTo("/unknown")).toBe("/account");
    expect(parseReturnTo("/account/orders/RF-1084/../../evil")).toBe(
      "/account",
    );
    expect(parseReturnTo("/account/orders/<script>")).toBe("/account");
  });

  it("never leaves the shop", () => {
    expect(parseReturnTo("https://evil.example")).toBe("/account");
    expect(parseReturnTo("//evil.example")).toBe("/account");
    expect(parseReturnTo("/checkout/../../evil")).toBe("/account");
    expect(parseReturnTo("javascript:alert(1)")).toBe("/account");
  });
});

describe("returnHref", () => {
  it("gives the router a page of the list as it is", () => {
    expect(returnHref("/checkout")).toBe("/checkout");
  });

  it("gives the router the order page with its number", () => {
    expect(returnHref("/account/orders/RF-1084")).toEqual({
      pathname: "/account/orders/[orderNumber]",
      params: { orderNumber: "RF-1084" },
    });
  });
});
