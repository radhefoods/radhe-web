import { describe, expect, it } from "vitest";
import type { PackSize } from "@/lib/api/types";
import {
  formatPackSize,
  formatProductName,
  productTitle,
} from "./product-name";

const size = (value: number, unit: PackSize["unit"], label: string) => ({
  value,
  unit,
  label,
});

describe("formatProductName", () => {
  it("puts the alternative name after a slash", () => {
    expect(formatProductName("Guava (Jamfal)")).toBe("Guava / Jamfal");
    expect(formatProductName("Indian Gooseberry (Amla)")).toBe(
      "Indian Gooseberry / Amla",
    );
  });

  it("leaves a plain name alone", () => {
    expect(formatProductName("Basmati Rice")).toBe("Basmati Rice");
  });

  it("copes with several brackets, odd spacing and empty ones", () => {
    expect(formatProductName("Chana Dal (Split) (Organic)")).toBe(
      "Chana Dal / Split / Organic",
    );
    expect(formatProductName("Guava  ( Jamfal )")).toBe("Guava / Jamfal");
    expect(formatProductName("Guava ()")).toBe("Guava");
    expect(formatProductName("(Jamfal) Guava")).toBe("Jamfal Guava");
  });
});

describe("formatPackSize", () => {
  it("closes the gap before a unit of weight or volume", () => {
    expect(formatPackSize(size(500, "g", "500 g"))).toBe("500g");
    expect(formatPackSize(size(1, "kg", "1 kg"))).toBe("1kg");
    expect(formatPackSize(size(0.5, "kg", "0,5 kg"))).toBe("0,5kg");
    expect(formatPackSize(size(500, "ml", "500 ml"))).toBe("500ml");
    expect(formatPackSize(size(1, "l", "1 l"))).toBe("1l");
  });

  it("keeps the gap before pieces, in both languages", () => {
    expect(formatPackSize(size(1, "pcs", "1 pcs"))).toBe("1 pcs");
    expect(formatPackSize(size(6, "pcs", "6 Stk."))).toBe("6 Stk.");
  });
});

describe("productTitle", () => {
  it("is the name with the size, in the shop's form", () => {
    expect(productTitle("Guava (Jamfal)", size(500, "g", "500 g"))).toBe(
      "Guava / Jamfal (500g)",
    );
    expect(productTitle("Mango (Keri)", size(1, "pcs", "1 pcs"))).toBe(
      "Mango / Keri (1 pcs)",
    );
    expect(productTitle("Basmati Rice", size(1, "kg", "1 kg"))).toBe(
      "Basmati Rice (1kg)",
    );
  });
});
