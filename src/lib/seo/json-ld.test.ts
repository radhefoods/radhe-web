import { describe, expect, it } from "vitest";
import { webPageJsonLd } from "./json-ld";

const SITE = "http://localhost:3001";

describe("the structured data of a legal page", () => {
  it("names the page, the language of its text and its last change", () => {
    expect(
      webPageJsonLd({
        url: `${SITE}/en/legal/shipping`,
        name: "Shipping information",
        description: "How we deliver.",
        // A German text on the English page.
        language: "de",
        modified: "2026-11-11T09:00:00.000Z",
      }),
    ).toMatchObject({
      "@context": "https://schema.org",
      "@type": "WebPage",
      "@id": `${SITE}/en/legal/shipping#webpage`,
      url: `${SITE}/en/legal/shipping`,
      name: "Shipping information",
      description: "How we deliver.",
      inLanguage: "de",
      dateModified: "2026-11-11T09:00:00.000Z",
      isPartOf: { "@type": "WebSite", "@id": `${SITE}/#website` },
      publisher: { "@type": "Organization", name: "Radhe Foods" },
    });
  });

  it("leaves out what it does not know", () => {
    const block = webPageJsonLd({
      url: `${SITE}/de/rechtliches/agb`,
      name: "AGB",
      language: "de",
    });
    expect(block).not.toHaveProperty("description");
    expect(block).not.toHaveProperty("dateModified");
  });
});
