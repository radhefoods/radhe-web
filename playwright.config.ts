import { defineConfig, devices } from "@playwright/test";

// End-to-end tests: a real browser against the built shop and the mock API.
//
//   npm run test:e2e
//
// Both servers are started when they are not running yet. The tests change
// the state of the mock (cargo open or closed), so they run one at a time.

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3001",
    locale: "en-GB",
    trace: "retain-on-failure",
    // The cookie notice has been read: it would lie over the bottom of the
    // page on phones. Its own test starts without this.
    storageState: {
      cookies: [],
      origins: [
        {
          origin: "http://localhost:3001",
          localStorage: [{ name: "rf.cookie-notice.v1", value: "1" }],
        },
      ],
    },
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
      },
    },
    {
      name: "phone",
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: [
    {
      command: "npm run dev:mock",
      url: "http://localhost:3000/health/live",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: "npm run build && npm run start",
      url: "http://localhost:3001/en",
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
    },
  ],
});
