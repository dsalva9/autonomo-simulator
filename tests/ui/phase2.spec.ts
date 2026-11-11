import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { type Locator, type Page, expect, test } from "@playwright/test";

const SCREENSHOT_DIR = resolve(process.cwd(), "test-results", "qa-screenshots");

function screenshotPath(filename: string): string {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  return resolve(SCREENSHOT_DIR, filename);
}

const PHASE2_ACHIEVEMENT_IDS = [
  "primer_trimestre",
  "primer_ano",
  "gestor_contratado",
  "aplazamiento_solicitado",
  "numeros_rojos_superados",
  "superviviente_hacienda",
  "colchon_10k",
  "primer_empleado",
  "familia_formada",
  "criatura_en_casa",
  "cinco_anos",
  "facturacion_100k",
  "heroe_120m",
  "ricachon_150k",
  "modo_infinito",
] as const;

const MOBILE_AUDIT_VIEWPORTS = [
  { label: "narrow-mobile-360x780", width: 360, height: 780 },
  { label: "mobile-390x844", width: 390, height: 844 },
] as const;

async function assertZeroHorizontalOverflow(
  page: Page,
  expectedViewportWidth: number,
  stageLabel: string,
): Promise<void> {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(metrics.innerWidth, `Expected viewport innerWidth on ${stageLabel}`).toBe(
    expectedViewportWidth,
  );
  expect(
    metrics.scrollWidth,
    `Expected zero horizontal overflow on ${stageLabel} (scrollWidth=${metrics.scrollWidth}, innerWidth=${metrics.innerWidth})`,
  ).toBeLessThanOrEqual(metrics.innerWidth);
}

async function assertBoxContainedInViewport(
  locator: Locator,
  viewportWidth: number,
  label: string,
  options?: { minHeight?: number; maxViewportHeight?: number },
): Promise<{ x: number; y: number; width: number; height: number }> {
  await expect(locator, `Expected ${label} to be visible`).toBeVisible();
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  expect(box, `Expected non-null boundingBox for ${label}`).not.toBeNull();
  expect(box!.x, `Expected ${label} left edge >= 0 (got x=${box!.x})`).toBeGreaterThanOrEqual(0);
  expect(
    box!.x + box!.width,
    `Expected ${label} right edge <= ${viewportWidth + 0.5} (got right=${box!.x + box!.width})`,
  ).toBeLessThanOrEqual(viewportWidth + 0.5);

  if (options?.minHeight !== undefined) {
    expect(box!.height, `Expected ${label} height >= ${options.minHeight}`).toBeGreaterThanOrEqual(
      options.minHeight,
    );
  }
  if (options?.maxViewportHeight !== undefined) {
    expect(box!.y, `Expected ${label} top edge >= 0`).toBeGreaterThanOrEqual(0);
    expect(
      box!.y + box!.height,
      `Expected ${label} bottom edge <= ${options.maxViewportHeight + 0.5}`,
    ).toBeLessThanOrEqual(options.maxViewportHeight + 0.5);
  }

  return box!;
}

async function resolveOneEventStep(page: Page): Promise<void> {
  await expect(page.getByTestId("event-card")).toBeVisible();
  const buttons = page.locator('[data-testid^="choice-btn-"]');
  const count = await buttons.count();
  expect(count).toBeGreaterThanOrEqual(2);

  let clicked = false;
  for (let i = 0; i < count; i += 1) {
    const btn = buttons.nth(i);
    if (await btn.isEnabled()) {
      await btn.scrollIntoViewIfNeeded();
      await btn.click();
      clicked = true;
      break;
    }
  }
  expect(clicked, "Expected at least 1 eligible choice").toBe(true);

  await expect(page.getByTestId("outcome-panel")).toBeVisible();
  const continueBtn = page.getByTestId("outcome-continue-btn");
  await continueBtn.scrollIntoViewIfNeeded();
  await continueBtn.click();
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

test.describe("Autónomo Simulator — Phase 2 Cashflow Timing, Geometry, PWA & Share Card QA Suite", () => {
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

  test("QA-14: Two-step cashflow timing (Month N outcome preview vs Month N+1) & tax-adjusted liquidity (Caja vs Libre)", async ({
    page,
  }) => {
    await page.goto("./");
    await page.getByTestId("seed-input").fill("FASE2-CASH-3");
    await page.getByTestId("start-run-btn").click();

    await expect(page.getByTestId("game-screen")).toBeVisible();
    await expect(page.getByTestId("indicator-calendar")).toContainText("Año 1 · Mes 1");

    // Month 1 post-start cash: 2.600 € initial seed capital + 2.216 € billing - 1.600 € fixed costs = 3.216 €
    // Accrued tax on Month 1 billing: -620 € -> Tax-adjusted Libre = 2.596 €
    const viewport = page.viewportSize();
    const moneyBox = page.getByTestId("indicator-money");
    const moneyValue = page.getByTestId("indicator-money-value");
    const netCash = page.getByTestId("indicator-net-cash");

    await expect(page.getByTestId("month-economy-strip")).toContainText("Caja fija: +616 €");
    await expect(moneyBox).toBeVisible();
    await expect(moneyValue).toHaveText("3.216 €");
    await expect(netCash).toBeVisible();
    await expect(netCash).toContainText(
      viewport && viewport.width < 768 ? "Res.:" : "Reserva Trimestre:",
    );
    await expect(netCash).toContainText("-620 €");
    await expect(netCash).toContainText("Libre:");
    await expect(netCash).toContainText("2.596 €");

    // Verify ledger-net-after-tax in CuentasPanel (desktop right column or mobile Cuentas tab)
    if (viewport && viewport.width < 1024) {
      await page.getByTestId("mobile-tab-cuentas").click();
      await expect(page.getByTestId("ledger-net-after-tax")).toBeVisible();
      await expect(page.getByTestId("ledger-net-after-tax")).toHaveText("-4 €");
      await page.getByTestId("mobile-tab-despacho").click();
    } else {
      await expect(page.getByTestId("ledger-net-after-tax")).toBeVisible();
      await expect(page.getByTestId("ledger-net-after-tax")).toHaveText("-4 €");
    }

    // Step 1 (Negative Cash Effect, -90 €): click choice on Month 1 and verify immediate Month 1 preview
    const negChoice = page.locator('[data-choice-id="escapada_desconexion_total"]');
    await expect(negChoice).toBeEnabled();
    await negChoice.scrollIntoViewIfNeeded();
    await negChoice.click();

    await expect(page.getByTestId("outcome-panel")).toBeVisible();
    // Calendar MUST remain at Month 1 during outcome resolution (NOT Month 2)
    await expect(page.getByTestId("indicator-calendar")).toContainText("Año 1 · Mes 1");
    await expect(page.getByTestId("indicator-calendar")).not.toContainText("Año 1 · Mes 2");
    // Cash and negative red delta update immediately on Month 1
    await expect(moneyValue).toHaveText("3.126 €");
    await expect(netCash).toContainText("2.506 €");

    const moneyDelta = page.getByTestId("indicator-money-delta");
    await expect(moneyDelta).toBeVisible();
    await expect(moneyDelta).toHaveText("-90 €");
    await expect(moneyDelta).toHaveClass(/text-\[#b42b24\]/);

    // Only upon clicking outcome-continue-btn does calendar advance to Month 2
    await page.getByTestId("outcome-continue-btn").click();
    await expect(page.getByTestId("outcome-panel")).toBeHidden();
    await expect(page.getByTestId("indicator-calendar")).toContainText("Año 1 · Mes 2");
    await expect(moneyValue).toHaveText("3.800 €");

    // Step 2 (Positive Cash Effect, +1.400 €): verify positive green delta stays on Month 2 until acknowledged
    const posChoice = page.locator('[data-choice-id="exigir_factura_legal"]');
    await expect(posChoice).toBeEnabled();
    await posChoice.scrollIntoViewIfNeeded();
    await posChoice.click();

    await expect(page.getByTestId("outcome-panel")).toBeVisible();
    await expect(page.getByTestId("indicator-calendar")).toContainText("Año 1 · Mes 2");
    await expect(page.getByTestId("indicator-calendar")).not.toContainText("Año 1 · Mes 3");
    await expect(moneyValue).toHaveText("5.200 €");
    await expect(moneyDelta).toBeVisible();
    await expect(moneyDelta).toHaveText("+1.400 €");
    await expect(moneyDelta).toHaveClass(/text-\[#1f5c53\]/);

    await page.getByTestId("outcome-continue-btn").click();
    await expect(page.getByTestId("indicator-calendar")).toContainText("Año 1 · Mes 3");
  });

  for (const vp of MOBILE_AUDIT_VIEWPORTS) {
    test(`QA-15 (${vp.label}): Strict zero-clip & alignment geometry audit across screens, tabs & modals`, async ({
      page,
    }, testInfo) => {
      test.skip(
        testInfo.project.name !== "mobile-chromium",
        "Mobile viewport geometry audit executes in the mobile-chromium device profile",
      );
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("./");

      // 1. TitleScreen zero horizontal overflow + hero stamp containment
      await expect(page.getByTestId("title-screen")).toBeVisible();
      await assertZeroHorizontalOverflow(page, vp.width, `TitleScreen (${vp.label})`);

      const heroStamp = page.getByText("VENTANILLA ÚNICA").locator("..");
      await assertBoxContainedInViewport(heroStamp, vp.width, "TitleScreen hero stamp");

      // Start deterministic run with NPC Polaroid on Month 1
      await page.getByTestId("seed-input").fill("FASE1-BANNER-1");
      await page.getByTestId("start-run-btn").click();
      await expect(page.getByTestId("game-screen")).toBeVisible();

      // 2. GameScreen (Despacho / Evento tab): HUD height, 4 aligned micro-gauges, treasury, Polaroid, choices & bottom nav
      await page.evaluate(() => window.scrollTo(0, 0));
      await assertZeroHorizontalOverflow(page, vp.width, `GameScreen Despacho (${vp.label})`);

      const headerBox = await page.locator("header").first().boundingBox();
      expect(headerBox).not.toBeNull();
      expect(
        headerBox!.height,
        `Expected compact mobile IndicatorBar height <= 140px on ${vp.label}`,
      ).toBeLessThanOrEqual(140);

      const gaugeIds = [
        "indicator-moral",
        "indicator-stress",
        "indicator-personal-life",
        "indicator-reputation",
      ] as const;
      const gaugeBoxes = [];
      for (const gaugeId of gaugeIds) {
        const box = await assertBoxContainedInViewport(
          page.getByTestId(gaugeId),
          vp.width,
          gaugeId,
        );
        gaugeBoxes.push(box);
      }
      const gaugeYs = gaugeBoxes.map((b) => b.y);
      expect(
        Math.max(...gaugeYs) - Math.min(...gaugeYs),
        `Expected all 4 micro-gauges on the exact same horizontal row on ${vp.label}`,
      ).toBeLessThanOrEqual(2);

      await assertBoxContainedInViewport(
        page.getByTestId("indicator-money"),
        vp.width,
        "indicator-money",
      );
      await assertBoxContainedInViewport(
        page.getByTestId("indicator-net-cash"),
        vp.width,
        "indicator-net-cash",
      );
      await assertBoxContainedInViewport(
        page.getByTestId("event-character-polaroid"),
        vp.width,
        "event-character-polaroid",
      );
      await assertBoxContainedInViewport(page.getByTestId("event-card"), vp.width, "event-card");

      const choiceButtons = page.locator('[data-testid^="choice-btn-"]');
      const choiceCount = await choiceButtons.count();
      expect(choiceCount).toBeGreaterThanOrEqual(2);
      for (let i = 0; i < choiceCount; i += 1) {
        await assertBoxContainedInViewport(choiceButtons.nth(i), vp.width, `choice-btn-${i}`, {
          minHeight: 48,
        });
      }

      const mobileTabIds = [
        "mobile-tab-despacho",
        "mobile-tab-cuentas",
        "mobile-tab-entorno",
        "mobile-tab-historial",
      ] as const;
      for (const tabId of mobileTabIds) {
        await assertBoxContainedInViewport(page.getByTestId(tabId), vp.width, tabId, {
          minHeight: 48,
        });
      }

      // 3. Remaining 3 Mobile Workspace Tabs (Cuentas, Entorno, Historial)
      await page.getByTestId("mobile-tab-cuentas").click();
      await assertBoxContainedInViewport(
        page.getByTestId("panel-cuentas"),
        vp.width,
        "panel-cuentas",
      );
      await assertZeroHorizontalOverflow(page, vp.width, `GameScreen Cuentas (${vp.label})`);

      await page.getByTestId("mobile-tab-entorno").click();
      await assertBoxContainedInViewport(
        page.getByTestId("panel-entorno"),
        vp.width,
        "panel-entorno",
      );
      await assertZeroHorizontalOverflow(page, vp.width, `GameScreen Entorno (${vp.label})`);

      await page.getByTestId("mobile-tab-historial").click();
      await assertBoxContainedInViewport(
        page.getByTestId("panel-historial"),
        vp.width,
        "panel-historial",
      );
      await assertZeroHorizontalOverflow(page, vp.width, `GameScreen Historial (${vp.label})`);

      await page.getByTestId("mobile-tab-despacho").click();
      await expect(page.getByTestId("event-card")).toBeVisible();

      if (vp.width === 360) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({
          path: screenshotPath("07-phase2-narrow-360x780.png"),
          fullPage: false,
        });
      }

      // 4. AbandonRunModal zero-clip check (then cancel to continue to Month 3)
      await page.getByTestId("abandon-run-btn").click();
      const abandonModal = page.getByTestId("abandon-modal");
      await expect(abandonModal).toBeVisible();
      await assertZeroHorizontalOverflow(page, vp.width, `AbandonRunModal (${vp.label})`);
      await assertBoxContainedInViewport(
        abandonModal.locator(".paper-dossier").first(),
        vp.width,
        "AbandonRunModal dossier",
        { maxViewportHeight: vp.height },
      );
      await page.getByTestId("abandon-cancel-btn").click();
      await expect(abandonModal).toBeHidden();

      // 5. QuarterlyTaxModal at Month 3 zero-clip check
      await advanceUntilQuarterlyTaxModal(page);
      const trimestreModal = page.getByTestId("trimestre-modal");
      await expect(trimestreModal).toBeVisible();
      await assertZeroHorizontalOverflow(page, vp.width, `QuarterlyTaxModal (${vp.label})`);
      await assertBoxContainedInViewport(
        trimestreModal.locator(".paper-dossier").first(),
        vp.width,
        "QuarterlyTaxModal dossier",
        { maxViewportHeight: vp.height },
      );
      await page.getByTestId("trimestre-pay-btn").click();
      await expect(trimestreModal).toBeHidden();

      // 6. EndRunScreen zero-clip check
      await page.getByTestId("abandon-run-btn").click();
      await page.getByTestId("abandon-oposiciones-btn").click();
      await expect(page.getByTestId("end-run-screen")).toBeVisible();
      await assertZeroHorizontalOverflow(page, vp.width, `EndRunScreen (${vp.label})`);
      await assertBoxContainedInViewport(
        page.getByTestId("share-canvas"),
        vp.width,
        "EndRunScreen share-canvas",
      );
    });
  }

  test("QA-16: Strict 3-column desktop alignment & 15-seal HistorialPanel audit (1440x900)", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "Desktop 3-column alignment audit executes in the desktop-chromium profile",
    );
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("./");

    await page.getByTestId("seed-input").fill("FASE1-BANNER-1");
    await page.getByTestId("start-run-btn").click();
    await expect(page.getByTestId("game-screen")).toBeVisible();

    await page.evaluate(() => window.scrollTo(0, 0));
    const scrollMetrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(scrollMetrics.scrollWidth).toBeLessThanOrEqual(1440);
    expect(scrollMetrics.scrollWidth).toBeLessThanOrEqual(scrollMetrics.innerWidth);

    const leftCol = page.getByTestId("scene-renderer");
    const centerTop = page.getByTestId("month-economy-strip");
    const eventCard = page.getByTestId("event-card");
    const rightCol = page.getByTestId("panel-cuentas");
    const panelHistorial = page.getByTestId("panel-historial");

    await expect(leftCol).toBeVisible();
    await expect(centerTop).toBeVisible();
    await expect(eventCard).toBeVisible();
    await expect(rightCol).toBeVisible();
    await expect(panelHistorial).toBeVisible();

    const leftBox = await leftCol.boundingBox();
    const centerBox = await centerTop.boundingBox();
    const eventCardBox = await eventCard.boundingBox();
    const rightBox = await rightCol.boundingBox();

    expect(leftBox).not.toBeNull();
    expect(centerBox).not.toBeNull();
    expect(eventCardBox).not.toBeNull();
    expect(rightBox).not.toBeNull();

    // Strict 3-track horizontal non-overlap and viewport containment
    expect(leftBox!.x).toBeGreaterThanOrEqual(0);
    expect(leftBox!.x + leftBox!.width).toBeLessThanOrEqual(centerBox!.x + 1);
    expect(centerBox!.x + centerBox!.width).toBeLessThanOrEqual(rightBox!.x + 1);
    expect(rightBox!.x + rightBox!.width).toBeLessThanOrEqual(1440.5);
    expect(Math.abs(eventCardBox!.x - centerBox!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(eventCardBox!.width - centerBox!.width)).toBeLessThanOrEqual(1);

    // Aligned top edges across Left, Center, and Right columns (<= 4px spread)
    const topSpread =
      Math.max(leftBox!.y, centerBox!.y, rightBox!.y) -
      Math.min(leftBox!.y, centerBox!.y, rightBox!.y);
    expect(
      topSpread,
      `Expected aligned top edges across 3 desktop columns (left=${leftBox!.y}, center=${centerBox!.y}, right=${rightBox!.y})`,
    ).toBeLessThanOrEqual(4);

    // Verify HistorialPanel displays 15 career seals without horizontal overflow
    await expect(panelHistorial).toContainText("Sellos de carrera");
    await expect(panelHistorial).toContainText("0/15");
    await expect(panelHistorial.locator(".grid.grid-cols-2 > span")).toHaveCount(15);

    const historialBox = await panelHistorial.boundingBox();
    expect(historialBox).not.toBeNull();
    expect(historialBox!.x).toBeGreaterThanOrEqual(0);
    expect(historialBox!.x + historialBox!.width).toBeLessThanOrEqual(1440.5);
    const historialNoOverflow = await panelHistorial.evaluate(
      (el) => el.scrollWidth <= el.clientWidth + 1,
    );
    expect(historialNoOverflow).toBe(true);

    await page.screenshot({
      path: screenshotPath("08-phase2-desktop-1440x900.png"),
      fullPage: false,
    });
  });

  test("QA-17 / QA-18 / QA-19: PWA + OpenGraph assets, 15 achievements, SFX mute, Fast Pacing & illustrated 1080x1350 Share Card", async ({
    page,
  }) => {
    await page.goto("./");
    await expect(page.getByTestId("title-screen")).toBeVisible();

    // 1. Verify HTML head manifest + OpenGraph tags & live HTTP 200 static PWA/social endpoints
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
      "href",
      "./manifest.webmanifest",
    );
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      "content",
      /og-preview\.png$/,
    );

    const manifestUrl = new URL("./manifest.webmanifest", page.url()).toString();
    const manifestRes = await page.request.get(manifestUrl);
    expect(manifestRes.status()).toBe(200);
    const manifestJson = (await manifestRes.json()) as {
      name?: string;
      display?: string;
      icons?: { src?: string; sizes?: string; type?: string }[];
    };
    expect(manifestJson.name).toBe("Autónomo Simulator");
    expect(manifestJson.display).toBe("standalone");
    expect(Array.isArray(manifestJson.icons)).toBe(true);
    expect(manifestJson.icons!.some((icon) => icon.sizes === "192x192")).toBe(true);
    expect(manifestJson.icons!.some((icon) => icon.sizes === "512x512")).toBe(true);

    const icon192Res = await page.request.get(
      new URL("./icons/icon-192.png", page.url()).toString(),
    );
    expect(icon192Res.status()).toBe(200);
    const icon512Res = await page.request.get(
      new URL("./icons/icon-512.png", page.url()).toString(),
    );
    expect(icon512Res.status()).toBe(200);

    const ogRes = await page.request.get(new URL("./og-preview.png", page.url()).toString());
    expect(ogRes.status()).toBe(200);
    expect((await ogRes.body()).byteLength).toBeGreaterThan(10_000);

    const swRes = await page.request.get(new URL("./sw.js", page.url()).toString());
    expect(swRes.status()).toBe(200);
    const swSource = await swRes.text();
    expect(swSource).toContain("PRECACHE_URLS");

    // 2. Verify TitleScreen Logros displays all 15 Phase 2 achievements
    const achievementsTab = page.getByTestId("title-tab-achievements");
    await expect(achievementsTab).toContainText("Logros (0/15)");
    await achievementsTab.click();
    await expect(page.getByTestId("achievements-list")).toBeVisible();
    await expect(page.locator('[data-testid^="achievement-item-"]')).toHaveCount(15);
    for (const achId of PHASE2_ACHIEVEMENT_IDS) {
      await expect(page.getByTestId(`achievement-item-${achId}`)).toBeVisible();
    }

    // 3. Start run and verify HUD Audio Mute (toggle-sfx-btn) & Fast Pacing (toggle-fast-pacing-btn)
    await page.getByTestId("seed-input").fill("FASE2-CASH-3");
    await page.getByTestId("start-run-btn").click();
    await expect(page.getByTestId("game-screen")).toBeVisible();

    const sfxBtn = page.getByTestId("toggle-sfx-btn");
    await expect(sfxBtn).toHaveAttribute("aria-pressed", "true");
    await sfxBtn.click();
    await expect(sfxBtn).toHaveAttribute("aria-pressed", "false");
    expect(await page.evaluate(() => window.localStorage.getItem("autonomo:sfx_muted"))).toBe(
      "true",
    );
    await sfxBtn.click();
    await expect(sfxBtn).toHaveAttribute("aria-pressed", "true");
    expect(await page.evaluate(() => window.localStorage.getItem("autonomo:sfx_muted"))).toBe(
      "false",
    );

    const fastPacingBtn = page.getByTestId("toggle-fast-pacing-btn");
    await expect(fastPacingBtn).toHaveAttribute("aria-pressed", "false");
    await fastPacingBtn.click();
    await expect(fastPacingBtn).toHaveAttribute("aria-pressed", "true");

    // With Modo ágil active, clicking a non-terminal choice advances directly to Month 2 without stopping at outcome-panel
    await expect(page.getByTestId("indicator-calendar")).toContainText("Año 1 · Mes 1");
    const month1Choice = page.locator('[data-choice-id="quedarse_adelantando_entregas"]');
    await month1Choice.scrollIntoViewIfNeeded();
    await month1Choice.click();

    await expect(page.getByTestId("outcome-panel")).toHaveCount(0);
    await expect(page.getByTestId("indicator-calendar")).toContainText("Año 1 · Mes 2");
    await expect(page.getByTestId("event-card")).toBeVisible();

    // 4. Abandon run -> EndRunScreen -> verify illustrated 1080x1350 Share Card canvas
    await page.getByTestId("abandon-run-btn").click();
    await expect(page.getByTestId("abandon-modal")).toBeVisible();
    await page.getByTestId("abandon-oposiciones-btn").click();

    await expect(page.getByTestId("end-run-screen")).toBeVisible();
    const endIllus = page.getByTestId("end-run-illustration");
    await expect(endIllus).toBeVisible();
    await expect
      .poll(async () =>
        endIllus.evaluate((el) => {
          const img = el as HTMLImageElement;
          return img.complete && img.naturalWidth === 960 && img.naturalHeight === 540;
        }),
      )
      .toBe(true);

    const shareCanvas = page.getByTestId("share-canvas");
    await shareCanvas.scrollIntoViewIfNeeded();
    await expect
      .poll(async () => {
        return shareCanvas.evaluate((el) => {
          const canvas = el as HTMLCanvasElement;
          if (canvas.width !== 1080 || canvas.height !== 1350) {
            return { ok: false, width: canvas.width, height: canvas.height, uniqueColors: 0 };
          }
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            return { ok: false, width: canvas.width, height: canvas.height, uniqueColors: 0 };
          }
          // Sample the 512x288 illustrated comic vignette region (x=284, y=489)
          const imgData = ctx.getImageData(284, 489, 512, 288).data;
          const colorBuckets = new Set<number>();
          for (let i = 0; i < imgData.length; i += 64) {
            const a = imgData[i + 3] ?? 0;
            if (a > 200) {
              const r = (imgData[i] ?? 0) >> 3;
              const g = (imgData[i + 1] ?? 0) >> 3;
              const b = (imgData[i + 2] ?? 0) >> 3;
              colorBuckets.add((r << 10) | (g << 5) | b);
            }
          }
          const pngLen = canvas.toDataURL("image/png").length;
          return {
            ok: colorBuckets.size >= 20 && pngLen > 25_000,
            width: canvas.width,
            height: canvas.height,
            uniqueColors: colorBuckets.size,
          };
        });
      })
      .toMatchObject({ ok: true, width: 1080, height: 1350 });
  });
});
