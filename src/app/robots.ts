import type { MetadataRoute } from "next";
import { env } from "@/config/env";

// `/robots.txt`. Search engines may read everything; the pages that belong
// to one visitor (cart, checkout, account, sign-in) say `noindex` themselves,
// which only works when they may be read. Only the page behind the link in
// marketing emails is closed: its address carries a personal token.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/unsubscribe/", "/*/unsubscribe/"],
      },
    ],
    sitemap: `${env.siteUrl}/sitemap.xml`,
  };
}
