import { defineConfig, devices } from "@playwright/test";

// The browser tests run against the built site (npm run build), served as GitHub Pages serves it (scripts/serve-out.mjs).
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  fullyParallel: true,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:3300", reducedMotion: "reduce" },
  webServer: { command: "node scripts/serve-out.mjs 3300", url: "http://localhost:3300", reuseExistingServer: true },
  projects: [
    { name: "computer", use: { viewport: { width: 1440, height: 900 } } },
    { name: "phone", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } },
  ],
});
