import { describe, expect, it } from "vitest";
import { primarySiteUrl } from "./env";

describe("primarySiteUrl", () => {
  it("reads the bare domain as the address it redirects to", () => {
    expect(primarySiteUrl("https://radhefoods.de")).toBe(
      "https://www.radhefoods.de",
    );
    expect(primarySiteUrl("https://radhefoods.de/")).toBe(
      "https://www.radhefoods.de",
    );
    expect(primarySiteUrl("http://radhefoods.de")).toBe(
      "https://www.radhefoods.de",
    );
    expect(primarySiteUrl("https://RadheFoods.de")).toBe(
      "https://www.radhefoods.de",
    );
  });

  it("keeps the primary address, and makes it https", () => {
    expect(primarySiteUrl("https://www.radhefoods.de")).toBe(
      "https://www.radhefoods.de",
    );
    expect(primarySiteUrl("http://www.radhefoods.de/")).toBe(
      "https://www.radhefoods.de",
    );
  });

  it("leaves every other address alone", () => {
    for (const other of [
      "http://localhost:3001",
      "https://api.radhefoods.de",
      "https://radhefoods.de.example.com",
      "https://radhe-web-git-main.vercel.app",
    ]) {
      expect(primarySiteUrl(other)).toBe(other);
    }
  });
});
