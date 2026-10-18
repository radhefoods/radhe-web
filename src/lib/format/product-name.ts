import type { PackSize } from "@/lib/api/types";

// How a product is named in the shop (owner, 2026-10-18). The admin writes
// the alternative name in brackets, "Guava (Jamfal)"; the shop shows it
// after a slash. The pack size loses the space before a unit of weight or
// volume, not before pieces: "Guava / Jamfal (500g)", "Mango / Keri (1 pcs)".
// The API's `displayName` is never shown as it comes; `name` and
// `packSize` are, through these.

/** "Guava (Jamfal)" → "Guava / Jamfal"; a name without brackets stays. */
export function formatProductName(name: string): string {
  return name
    .replace(/\s*\(([^()]*)\)/g, (_, inner: string) => {
      const alternative = inner.trim();
      return alternative ? ` / ${alternative}` : "";
    })
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\/ /, "");
}

/** "500 g" → "500g", "0,5 kg" → "0,5kg"; "1 pcs" and "6 Stk." keep the space. */
export function formatPackSize(packSize: PackSize): string {
  const label = packSize.label.trim();
  return packSize.unit === "pcs"
    ? label.replace(/\s+/g, " ")
    : label.replace(/\s+/g, "");
}

/** The title of a pack size: "Guava / Jamfal (500g)". */
export function productTitle(name: string, packSize: PackSize): string {
  return `${formatProductName(name)} (${formatPackSize(packSize)})`;
}
