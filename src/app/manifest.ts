import type { MetadataRoute } from "next";

// `/manifest.webmanifest`: name, colours and icons for phones that put the
// shop on the home screen.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Radhe Foods",
    short_name: "Radhe Foods",
    description: "Indian groceries, in stock and delivered across Germany.",
    start_url: "/",
    display: "browser",
    background_color: "#f1f6f1",
    theme_color: "#f1f6f1",
    // The peacock feather on the shop's ground (`scripts/make-icons.mjs`).
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
      // Smaller in its square, for the circle or squircle Android cuts out.
      {
        src: "/brand/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
