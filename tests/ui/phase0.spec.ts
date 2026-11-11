import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { type Page, expect, test } from "@playwright/test";

const SCREENSHOT_DIR = resolve(process.cwd(), "test-results", "qa-screenshots");

function screenshotPath(filename: string): string {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  return resolve(SCREENSHOT_DIR, filename);
}

async function pickFirstEligibleChoice(page: Page): Promise<number> {
  const buttons = page.locator('[data-testid^="choice-btn-"]');
  const count = await buttons.count();
  expect(count).toBeGreaterThanOrEqual(2);

  for (let i = 0; i < count; i += 1) {
    const btn = buttons.nth(i);
    if (await btn.isEnabled()) {
      await btn.click();
      return i;
    }
  }
  throw new Error("Expected at least 1 eligible choice on active event card.");
}

async function resolveOneEventStep(page: Page): Promise<void> {
  await expect(page.getByTestId("event-card")).toBeVisible();
  await pickFirstEligibleChoice(page);

  const outcomePanel = page.getByTestId("outcome-panel");
  await expect(outcomePanel).toBeVisible();
  await expect(page.getByTestId("outcome-result-text")).not.toBeEmpty();

  await page.getByTestId("outcome-continue-btn").click();
}

async function advanceUntilQuarterlyTaxModal(page: Page): Promise<void> {
  const trimestreModal = page.getByTestId("trimestre-modal");
  for (let guard = 0; guard < 8; guard += 1) {
    if (await trimestreModal.isVisible()) {
      return;
    }
    await resolveOneEventStep(page);
  }
  await expect(trimestreModal).toBeVisible();
}

test.describe("Autónomo Simulator — Phase 0 E2E & Responsive QA Suite", () => {
  let consoleErrors: string[] = [];
  let pageErrors: string[] = [];
  let failedResponses: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];
    failedResponses = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });
    page.on("pageerror", (err) => {
      pageErrors.push(err.message);
    });
    page.on("response", (res) => {
      if (res.status() >= 400) {
        failedResponses.push(`${res.status()} ${res.url()}`);
      }
    });
  });

  test.afterEach(async () => {
    expect(failedResponses, "Expected zero HTTP >= 400 responses").toEqual([]);
    expect(consoleErrors, "Expected zero browser console.error logs").toEqual([]);
    expect(pageErrors, "Expected zero uncaught browser pageerror events").toEqual([]);
  });

  test("QA-01 / QA-05 / QA-08: Seeded start, asset loading, >=48px touch buttons, and responsive layout", async ({
    page,
  }, testInfo) => {
    const profileTag =
      testInfo.project.name === "mobile-chromium" ? "mobile-390x844" : "desktop-1440x900";

    await page.goto("./");

    await expect(page.getByTestId("title-screen")).toBeVisible();
    await expect(page.locator("blockquote")).toContainText(
      "Sé tu propio jefe. Descubre por qué era mala idea.",
    );

    await page.getByTestId("seed-input").fill("FASE0-QA-2026");
    await page.screenshot({
      path: screenshotPath(`01-title-${profileTag}.png`),
      fullPage: false,
    });

    await page.getByTestId("start-run-btn").click();

    await expect(page.getByTestId("game-screen")).toBeVisible();
    await expect(page.getByTestId("indicator-calendar")).toContainText("Año 1 · Mes 1");
    await expect(page.getByTestId("indicator-money")).toBeVisible();
    await expect(page.getByTestId("event-card")).toBeVisible();

    // Verify all choice buttons meet >= 48px touch target height
    const choiceButtons = page.locator('[data-testid^="choice-btn-"]');
    const choiceCount = await choiceButtons.count();
    expect(choiceCount).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < choiceCount; i += 1) {
      const box = await choiceButtons.nth(i).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(48);
    }

    // Verify all visible <img> elements loaded cleanly with naturalWidth > 0
    await expect
      .poll(async () => {
        return page.evaluate(() => {
          const imgs = Array.from(document.querySelectorAll("img")).filter(
            (img) => img.offsetParent !== null,
          );
          if (imgs.length < 2) {
            return ["fewer-than-2-visible-images"];
          }
          return imgs
            .filter((img) => !img.complete || img.naturalWidth === 0)
            .map((img) => img.getAttribute("src") ?? "unknown");
        });
      })
      .toEqual([]);

    await page.screenshot({
      path: screenshotPath(`02-gamescreen-${profileTag}.png`),
      fullPage: false,
    });

    const viewport = page.viewportSize();
    if (viewport && viewport.width < 1024) {
      // Mobile (< 1024px): slim mobile subject art visible, desktop footer hidden; bottom tabs switch panels
      await expect(page.getByTestId("scene-subject-mobile-art")).toBeVisible();
      await expect(page.getByTestId("scene-subject-art")).toBeHidden();

      const tabCuentas = page.getByTestId("mobile-tab-cuentas");
      const tabBox = await tabCuentas.boundingBox();
      expect(tabBox!.height).toBeGreaterThanOrEqual(48);

      await tabCuentas.click();
      await expect(page.getByTestId("panel-cuentas")).toBeVisible();

      await page.getByTestId("mobile-tab-entorno").click();
      await expect(page.getByTestId("panel-entorno")).toBeVisible();

      await page.getByTestId("mobile-tab-historial").click();
      await expect(page.getByTestId("panel-historial")).toBeVisible();

      await page.getByTestId("mobile-tab-despacho").click();
      await expect(page.getByTestId("event-card")).toBeVisible();
    } else {
      // Desktop (>= 1024px): true 3-column workspace displays all panels simultaneously
      await expect(page.getByTestId("scene-renderer")).toBeVisible();
      await expect(page.getByTestId("scene-subject-art")).toBeVisible();
      await expect(page.getByTestId("scene-subject-mobile-art")).toBeHidden();
      await expect(page.getByTestId("panel-entorno")).toBeVisible();
      await expect(page.getByTestId("event-card")).toBeVisible();
      await expect(page.getByTestId("panel-cuentas")).toBeVisible();
      await expect(page.getByTestId("panel-historial")).toBeVisible();
    }
  });

  test("QA-03: Month 1 -> Month 3 Trimestre settlement (Pay in Full & Aplazamiento)", async ({
    page,
  }, testInfo) => {
    const profileTag =
      testInfo.project.name === "mobile-chromium" ? "mobile-390x844" : "desktop-1440x900";

    await page.goto("./");
    await page.getByTestId("seed-input").fill("FASE0-TRIMESTRE-PAY");
    await page.getByTestId("start-run-btn").click();

    await advanceUntilQuarterlyTaxModal(page);
    await expect(page.getByTestId("indicator-calendar")).toContainText("Año 1 · Mes 3");
    await expect(page.getByTestId("trimestre-modal")).toBeVisible();

    await page.screenshot({
      path: screenshotPath(`03-trimestre-modal-${profileTag}.png`),
      fullPage: false,
    });

    await page.getByTestId("trimestre-pay-btn").click();
    await expect(page.getByTestId("trimestre-modal")).toBeHidden();
    await expect(page.getByTestId("indicator-calendar")).toContainText("Año 1 · Mes 4");

    // Start a second seeded run to verify 1-time Aplazamiento ("defer")
    await page.getByTestId("return-title-btn").click();
    await page.getByTestId("seed-input").fill("FASE0-TRIMESTRE-DEFER");
    await page.getByTestId("start-run-btn").click();

    await advanceUntilQuarterlyTaxModal(page);
    const deferBtn = page.getByTestId("trimestre-defer-btn");
    await expect(deferBtn).toBeEnabled();
    await deferBtn.click();

    await expect(page.getByTestId("trimestre-modal")).toBeHidden();
    await expect(page.getByTestId("indicator-calendar")).toContainText("Año 1 · Mes 4");

    const viewport = page.viewportSize();
    if (viewport && viewport.width < 1024) {
      await page.getByTestId("mobile-tab-cuentas").click();
    }
    await expect(page.getByTestId("ledger-deferred-tax")).toContainText("VENCE MES 6");
  });

  test("QA-04: Mid-run browser reload restores exact GameState from IndexedDB", async ({
    page,
  }) => {
    await page.goto("./");
    await page.getByTestId("seed-input").fill("FASE0-RELOAD-PERSIST");
    await page.getByTestId("start-run-btn").click();

    // Advance from Month 1 into Month 2
    await resolveOneEventStep(page);
    await expect(page.getByTestId("event-card")).toBeVisible();

    const savedCalendar = (await page.getByTestId("indicator-calendar").textContent()) ?? "";
    const savedMoney = (await page.getByTestId("indicator-money-value").textContent()) ?? "";
    const savedMoral = (await page.getByTestId("indicator-moral-value").textContent()) ?? "";
    const savedStress = (await page.getByTestId("indicator-stress-value").textContent()) ?? "";
    const savedPersonalLife =
      (await page.getByTestId("indicator-personal-life-value").textContent()) ?? "";
    const savedReputation =
      (await page.getByTestId("indicator-reputation-value").textContent()) ?? "";
    const savedEventId = (await page.getByTestId("event-card").getAttribute("data-event-id")) ?? "";
    const savedEventTitle = (await page.getByTestId("event-title").textContent()) ?? "";

    // Allow IndexedDB transaction to flush cleanly before reload
    await page.waitForTimeout(120);
    await page.reload();

    // TitleScreen shows Continuar partida with saved calendar & money
    await expect(page.getByTestId("continue-run-card")).toBeVisible();
    await expect(page.getByTestId("continue-run-calendar")).toContainText("Año 1 · Mes 2");
    await expect(page.getByTestId("continue-run-money")).toHaveText(savedMoney);
    await expect(page.getByTestId("continue-run-btn")).toBeVisible();
    await page.getByTestId("continue-run-btn").click();

    // Exact GameState restored with zero RNG re-roll
    await expect(page.getByTestId("indicator-calendar")).toHaveText(savedCalendar);
    await expect(page.getByTestId("indicator-money-value")).toHaveText(savedMoney);
    await expect(page.getByTestId("indicator-moral-value")).toHaveText(savedMoral);
    await expect(page.getByTestId("indicator-stress-value")).toHaveText(savedStress);
    await expect(page.getByTestId("indicator-personal-life-value")).toHaveText(savedPersonalLife);
    await expect(page.getByTestId("indicator-reputation-value")).toHaveText(savedReputation);
    await expect(page.getByTestId("event-card")).toHaveAttribute("data-event-id", savedEventId);
    await expect(page.getByTestId("event-title")).toHaveText(savedEventTitle);
  });

  test("QA-06 / QA-07: Keyboard shortcuts (1 / Enter / Esc), EndRunScreen 1080x1350 Canvas & Hall of Fame", async ({
    page,
  }, testInfo) => {
    const profileTag =
      testInfo.project.name === "mobile-chromium" ? "mobile-390x844" : "desktop-1440x900";

    await page.goto("./");
    await page.getByTestId("seed-input").fill("FASE0-KEYBOARD-END");
    await page.getByTestId("start-run-btn").click();

    await expect(page.getByTestId("event-card")).toBeVisible();

    // Find first eligible choice index (1-based) and trigger via keyboard
    const buttons = page.locator('[data-testid^="choice-btn-"]');
    const count = await buttons.count();
    let eligibleKey = "1";
    for (let i = 0; i < count; i += 1) {
      if (await buttons.nth(i).isEnabled()) {
        eligibleKey = String(i + 1);
        break;
      }
    }

    await page.keyboard.press(eligibleKey);
    await expect(page.getByTestId("outcome-panel")).toBeVisible();

    await page.keyboard.press("Enter");
    await expect(page.getByTestId("outcome-panel")).toBeHidden();
    await expect(page.getByTestId("event-card")).toBeVisible();

    // Open voluntary exit modal, test Escape close, then trigger voluntary abandonment ending
    await page.getByTestId("abandon-run-btn").click();
    await expect(page.getByTestId("abandon-modal")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("abandon-modal")).toBeHidden();

    await page.getByTestId("abandon-run-btn").click();
    await page.getByTestId("abandon-oposiciones-btn").click();

    // Verify EndRunScreen & rendered 1080x1350 certificate canvas
    await expect(page.getByTestId("end-run-screen")).toBeVisible();
    await expect(page.getByTestId("end-run-title")).toContainText("Exilio Voluntario al Temario");

    const endIllustration = page.getByTestId("end-run-illustration");
    await endIllustration.scrollIntoViewIfNeeded();
    await expect
      .poll(async () =>
        endIllustration.evaluate((el) => {
          const img = el as HTMLImageElement;
          return img.complete && img.naturalWidth > 0;
        }),
      )
      .toBe(true);

    const canvasMetrics = await page.getByTestId("share-canvas").evaluate((el) => {
      const canvas = el as HTMLCanvasElement;
      return {
        width: canvas.width,
        height: canvas.height,
        dataUrlLength: canvas.toDataURL("image/png").length,
      };
    });
    expect(canvasMetrics.width).toBe(1080);
    expect(canvasMetrics.height).toBe(1350);
    expect(canvasMetrics.dataUrlLength).toBeGreaterThan(2000);

    await page.screenshot({
      path: screenshotPath(`04-endrun-certificate-${profileTag}.png`),
      fullPage: true,
    });

    await page.getByTestId("copy-summary-btn").click();
    await expect(page.getByTestId("share-feedback")).toBeVisible();

    // Return to TitleScreen: active run cleared, finished run archived in Hall of Fame
    await page.getByTestId("end-return-title-btn").click();
    await expect(page.getByTestId("title-screen")).toBeVisible();
    await expect(page.getByTestId("continue-run-card")).toHaveCount(0);
    await expect(page.getByTestId("hall-of-fame-list")).toContainText(
      "Exilio Voluntario al Temario",
    );
  });
});
