import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The legal pages read their Markdown files from `content/`: make sure
  // the files are part of what a host like Vercel deploys.
  outputFileTracingIncludes: {
    "/[locale]/legal/*": ["./content/legal/**/*"],
  },
  // Product images are served by the API's CDN as ready-made WebP variants
  // (320 / 800 / 1600 px). They are rendered with a plain srcset, so the
  // Next.js image optimizer is not involved and no remote patterns are needed.
  // The pre-order terms were a page of their own until 2026-10-16 and were
  // in the sitemap: the old address leads to the terms, for good.
  async redirects() {
    return [
      {
        source: "/legal/preorder-terms",
        destination: "/en/legal/terms",
        permanent: true,
      },
      {
        source: "/en/legal/preorder-terms",
        destination: "/en/legal/terms",
        permanent: true,
      },
      {
        source: "/de/rechtliches/vorbestellbedingungen",
        destination: "/de/rechtliches/agb",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          // Browsers that have seen the shop over https never try http
          // again. Ignored on plain http (local development).
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000",
          },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), browsing-topics=()",
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
