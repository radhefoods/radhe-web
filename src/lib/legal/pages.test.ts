import { describe, expect, it } from "vitest";
import { footerLegalPages, legalTitle } from "./pages";

describe("the legal pages of the footer", () => {
  it("links all seven when the admin has published the six of the API", () => {
    expect(
      footerLegalPages([
        "imprint",
        "shipping",
        "refund",
        "terms",
        "privacy",
        "withdrawal",
      ]),
    ).toEqual([
      "terms",
      "withdrawal",
      "shipping",
      "refund",
      "privacy",
      "cookies",
      "imprint",
    ]);
  });

  it("leaves out a page that is not published and would answer 404", () => {
    expect(footerLegalPages(["shipping", "terms", "privacy"])).toEqual([
      "terms",
      "withdrawal",
      "shipping",
      "privacy",
      "cookies",
      "imprint",
    ]);
    // Not even the terms are linked while there are none.
    expect(footerLegalPages(["privacy"])).not.toContain("terms");
  });

  it("always links the imprint, the withdrawal and the cookie page: they have a file of the shop", () => {
    expect(footerLegalPages([])).toEqual(["withdrawal", "cookies", "imprint"]);
  });

  it("is the footer of before with an API that knows two types", () => {
    expect(footerLegalPages(["terms", "privacy"])).toEqual([
      "terms",
      "withdrawal",
      "privacy",
      "cookies",
      "imprint",
    ]);
  });

  it("shows the pages the shop has had all along when the API did not answer", () => {
    expect(footerLegalPages(null)).toEqual([
      "terms",
      "withdrawal",
      "privacy",
      "cookies",
      "imprint",
    ]);
  });

  it("ignores a type this shop has no page for", () => {
    expect(footerLegalPages(["terms", "returns" as never])).toEqual([
      "terms",
      "withdrawal",
      "cookies",
      "imprint",
    ]);
  });
});

describe("the title of a legal page", () => {
  it("keeps a title that names the shop as the admin wrote it", () => {
    expect(legalTitle("AGB | Radhe Foods", "Radhe Foods")).toEqual({
      absolute: "AGB | Radhe Foods",
    });
    expect(legalTitle("Versand bei RADHE FOODS", "Radhe Foods")).toEqual({
      absolute: "Versand bei RADHE FOODS",
    });
  });

  it("leaves any other title to the pattern of the shop, which appends the name", () => {
    expect(legalTitle("Impressum", "Radhe Foods")).toBe("Impressum");
  });
});
