import { defineConfig, devices } from "@playwright/test";

const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL;
const baseURL = externalBaseUrl ?? "http://localhost:4173";
const localChannel = process.env.PLAYWRIGHT_CHANNEL ?? (process.env.CI ? undefined : "chrome");

export default defineConfig({
  testDir: "./tests/ui",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL,
    channel: localChannel,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: {
        ...devices["Desktop Chrome"],
        channel: localChannel,
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "mobile-chromium",
      use: {
        ...devices["Pixel 7"],
        channel: localChannel,
        viewport: { width: 390, height: 844 },
      },
    },
  ],
  webServer: externalBaseUrl
    ? undefined
    : {
        command: "pnpm preview",
        url: "http://localhost:4173",
        reuseExistingServer: !process.env.CI,
        timeout: 60000,
      },
});
