// The configuration of the shop, read once from the environment. Every value
// here is public: the shop has no secrets. `NEXT_PUBLIC_` variables are
// replaced at build time, so each one is named in full below.

function withoutTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function flag(value: string | undefined): boolean {
  return value === "true";
}

const siteUrl = withoutTrailingSlash(
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3001",
);

const apiUrl = withoutTrailingSlash(
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000",
);

export const env = {
  /** Public address of the shop, no trailing slash. */
  siteUrl,
  /** Address of the API as the browser reaches it, no trailing slash, no `/v1`. */
  apiUrl,
  /**
   * Address of the API as the Next.js server reaches it. Server only: the
   * variable is not exposed to the browser, where this equals `apiUrl`.
   */
  apiInternalUrl: withoutTrailingSlash(process.env.API_INTERNAL_URL || apiUrl),
  /** Empty: the Google sign-in button is not shown. */
  googleClientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "",
  features: {
    /**
     * WhatsApp opt-in in the account preferences. The API stores the
     * preference already; sending is switched on later by Radhe Foods.
     */
    whatsapp: flag(process.env.NEXT_PUBLIC_FEATURE_WHATSAPP),
  },
} as const;

export type FeatureName = keyof typeof env.features;

export function isFeatureEnabled(name: FeatureName): boolean {
  return env.features[name];
}
