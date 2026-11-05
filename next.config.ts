import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

/**
 * What a page of the shop may load and where it may send data. The shop's
 * own files, the API (the browser calls it with the session cookies) and
 * pictures over https (the API's CDN, and pictures an editor puts into a
 * blog post or a legal text). No frames, no plugins, no forms to other
 * sites.
 *
 * Scripts: Next.js writes the page's data into inline scripts that differ
 * with every render, and most pages are prerendered, so they cannot carry a
 * nonce: `'unsafe-inline'` stays, and the policy still keeps scripts from
 * other origins out. Styles: React writes `style` attributes, and the
 * sheets of the menus lock scrolling with a `<style>` element.
 *
 * `next dev` needs `eval` and a WebSocket for its tooling; Vercel's preview
 * deployments load the comment toolbar from vercel.live.
 */
function contentSecurityPolicy(): string {
  const dev = process.env.NODE_ENV !== "production";
  const preview = process.env.VERCEL_ENV === "preview";
  const api = originOf(
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000",
  );
  const directives: Record<string, (string | false)[]> = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      "'unsafe-inline'",
      dev && "'unsafe-eval'",
      preview && "https://vercel.live",
    ],
    "style-src": [
      "'self'",
      "'unsafe-inline'",
      preview && "https://vercel.live",
    ],
    "img-src": ["'self'", "data:", "blob:", "https:", api],
    "font-src": [
      "'self'",
      preview && "https://vercel.live https://assets.vercel.com",
    ],
    "connect-src": [
      "'self'",
      api,
      dev && "ws://localhost:* ws://127.0.0.1:*",
      preview && "https://vercel.live wss://ws-us3.pusher.com",
    ],
    "frame-src": [preview ? "https://vercel.live" : "'none'"],
    "manifest-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.filter(Boolean).join(" ")}`)
    .join("; ");
}

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
        // The logo, the icons and the picture for shared links: files that
        // keep their names. Without this the browser asks for each of them
        // again on every page; a day in the browser, renewed in the
        // background for a week after that.
        source: "/brand/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: contentSecurityPolicy(),
          },
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
