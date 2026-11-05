/** Spaces, hyphens and brackets are fine to type; the API wants none. */
export function normalizePhone(value: string): string {
  return value.replace(/[\s\-()/.]/g, "");
}
