import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "mocks/**/*.test.ts"],
    environment: "node",
    // next-intl imports "next/navigation" without a file extension, which
    // only a bundler resolves: let Vite process the package.
    server: { deps: { inline: ["next-intl"] } },
  },
});
