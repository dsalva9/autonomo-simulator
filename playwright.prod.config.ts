import { defineConfig, devices } from "@playwright/test";

export const PRODUCTION_BASE_URL = "https://autonomo-simulator.vercel.app";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? PRODUCTION_BASE_URL;
const localChannel = process.env.PLAYWRIGHT_CHANNEL ?? (process.env.CI ? undefined : "chrome");

export default defineConfig({
  testDir: "./tests/ui",
  timeout: 45_000,
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL,
    channel: localChannel,
    navigationTimeout: 30_000,
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
  webServer: undefined,
});
