import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { type Locator, type Page, expect, test } from "@playwright/test";

const SCREENSHOT_DIR = resolve(process.cwd(), "test-results", "qa-screenshots");

function screenshotPath(filename: string): string {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  return resolve(SCREENSHOT_DIR, filename);
}

const PHASE1_ACHIEVEMENT_IDS = [
  "primer_trimestre",
  "primer_ano",
  "gestor_contratado",
  "superviviente_hacienda",
  "primer_empleado",
  "familia_formada",
  "cinco_anos",
  "heroe_120m",
  "ricachon_150k",
] as const;

async function waitForImageDimensions(
  locator: Locator,
): Promise<{ naturalWidth: number; naturalHeight: number }> {
  await expect(locator).toBeVisible();
  await locator.scrollIntoViewIfNeeded();

  let dims: { naturalWidth: number; naturalHeight: number } | null = null;
  await expect
    .poll(async () => {
      dims = await locator.evaluate((el) => {
        const img = el as HTMLImageElement;
        if (!img.complete || img.naturalWidth === 0) {
          return null;
        }
        return { naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight };
      });
      return dims;
    })
    .not.toBeNull();

  return dims!;
}

async function clickCentered(locator: Locator): Promise<void> {
  await expect(locator).toBeVisible();
  await locator.evaluate((el) => {
    el.scrollIntoView({ block: "center", inline: "nearest" });
  });
  await locator.click();
}

async function selectChoiceAndAcknowledge(page: Page, choiceId: string): Promise<void> {
  const choiceBtn = page.locator(`[data-choice-id="${choiceId}"]`);
  await expect(choiceBtn).toBeEnabled();
  await clickCentered(choiceBtn);

  await expect(page.getByTestId("outcome-panel")).toBeVisible();
  await expect(page.getByTestId("outcome-result-text")).not.toBeEmpty();
  await clickCentered(page.getByTestId("outcome-continue-btn"));
}

async function assertPolaroidDoesNotOverlapChoices(page: Page): Promise<void> {
  const geometry = await page.evaluate(() => {
    const polaroid = document.querySelector('[data-testid="event-character-polaroid"]');
    const choices = Array.from(document.querySelectorAll('[data-testid^="choice-btn-"]'));
    if (!polaroid || choices.length === 0) {
      return null;
    }

    const sx = window.scrollX;
    const sy = window.scrollY;
    const pr = polaroid.getBoundingClientRect();
    const polaroidBox = {
      left: pr.left + sx,
      top: pr.top + sy,
      right: pr.right + sx,
      bottom: pr.bottom + sy,
      width: pr.width,
      height: pr.height,
    };

    const choiceBoxes = choices.map((btn) => {
      const r = btn.getBoundingClientRect();
      return {
        testId: btn.getAttribute("data-testid") ?? "",
        left: r.left + sx,
        top: r.top + sy,
        right: r.right + sx,
        bottom: r.bottom + sy,
        width: r.width,
        height: r.height,
      };
    });

    return { polaroidBox, choiceBoxes };
  });

  expect(geometry).not.toBeNull();
  expect(geometry!.polaroidBox.width).toBeGreaterThan(0);
  expect(geometry!.polaroidBox.height).toBeGreaterThan(0);
  expect(geometry!.choiceBoxes.length).toBeGreaterThanOrEqual(2);

  for (const choiceBox of geometry!.choiceBoxes) {
    const overlaps =
      geometry!.polaroidBox.left < choiceBox.right &&
      geometry!.polaroidBox.right > choiceBox.left &&
      geometry!.polaroidBox.top < choiceBox.bottom &&
      geometry!.polaroidBox.bottom > choiceBox.top;

    expect(
      overlaps,
      `Expected Polaroid card not to overlap ${choiceBox.testId} (polaroid bottom=${geometry!.polaroidBox.bottom}, choice top=${choiceBox.top})`,
    ).toBe(false);
    expect(geometry!.polaroidBox.bottom).toBeLessThanOrEqual(choiceBox.top);
  }
}

test.describe("Autónomo Simulator — Phase 1 Art, Polaroids, Achievements & Endings QA Suite", () => {
  let consoleErrors: string[] = [];
  let pageErrors: string[] = [];
  let failedResponses: string[] = [];
  let okWebpCount = 0;
  let okSvgCount = 0;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];
    failedResponses = [];
    okWebpCount = 0;
    okSvgCount = 0;

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });
    page.on("pageerror", (err) => {
      pageErrors.push(err.message);
    });
    page.on("response", (res) => {
      const status = res.status();
      const url = res.url();
      if (status >= 400) {
        failedResponses.push(`${status} ${url}`);
      } else if (status === 200 || status === 304) {
        if (url.includes(".webp")) okWebpCount += 1;
        if (url.includes(".svg")) okSvgCount += 1;
      }
    });
  });

  test.afterEach(async () => {
    expect(failedResponses, "Expected zero HTTP >= 400 responses").toEqual([]);
    expect(consoleErrors, "Expected zero browser console.error logs").toEqual([]);
    expect(pageErrors, "Expected zero uncaught browser pageerror events").toEqual([]);
  });

  test("QA-08 / QA-09 / QA-10: Style A WebP desk background, reactive props, 8:3 banner, CSS Polaroid & zero choice-button overlap", async ({
    page,
  }, testInfo) => {
    const profileTag =
      testInfo.project.name === "mobile-chromium" ? "mobile-390x844" : "desktop-1440x900";

    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("./");

    await page.getByTestId("seed-input").fill("FASE1-BANNER-1");
    await page.getByTestId("start-run-btn").click();

    await expect(page.getByTestId("game-screen")).toBeVisible();

    // 1. Style A WebP desk background & SVG reactive prop
    const sceneBg = page.getByTestId("scene-bg");
    await expect(sceneBg).toHaveAttribute("data-asset-id", "bg_despacho_base");
    const bgDims = await waitForImageDimensions(sceneBg);
    expect(bgDims).toEqual({ naturalWidth: 1280, naturalHeight: 720 });

    const propFacturas = page.getByTestId("scene-prop-facturas");
    const propDims = await waitForImageDimensions(propFacturas);
    expect(propDims).toEqual({ naturalWidth: 256, naturalHeight: 256 });

    // 2. Modular 8:3 category banner
    const bannerArt = page.getByTestId("event-banner-art");
    await expect(bannerArt).toHaveAttribute("data-banner-kind", "banner");
    await expect(bannerArt).toHaveAttribute("data-asset-id", "banner_gestor_base");
    const bannerDims = await waitForImageDimensions(bannerArt);
    expect(bannerDims).toEqual({ naturalWidth: 960, naturalHeight: 360 });

    // 3. CSS-framed multi-expression NPC Polaroid + nameplate + zero overlap
    const polaroid = page.getByTestId("event-character-polaroid");
    await expect(polaroid).toBeVisible();
    await expect(polaroid).toHaveAttribute("data-expression", "pleased");
    await expect(polaroid).toHaveAttribute("data-asset-id", "char_gestor_barato_paco_confiado");
    await expect(polaroid.locator("figcaption")).toBeVisible();
    await expect(polaroid.locator("figcaption")).toContainText("Paco");

    const portraitDims = await waitForImageDimensions(
      page.getByTestId("event-character-polaroid-img"),
    );
    expect(portraitDims).toEqual({ naturalWidth: 512, naturalHeight: 512 });

    const defaultTransform = await polaroid.evaluate((el) => getComputedStyle(el).transform);
    expect(defaultTransform).not.toBe("none");
    expect(defaultTransform).not.toBe("matrix(1, 0, 0, 1, 0, 0)");

    await assertPolaroidDoesNotOverlapChoices(page);

    expect(okWebpCount).toBeGreaterThanOrEqual(3);
    expect(okSvgCount).toBeGreaterThanOrEqual(1);

    await page.screenshot({
      path: screenshotPath(`05-phase1-polaroid-stage-${profileTag}.png`),
      fullPage: false,
    });

    // Hire Paco -> verify Entorno miniature CSS Polaroid loads cleanly
    await selectChoiceAndAcknowledge(page, "contratar_paco_barato");

    const viewport = page.viewportSize();
    if (viewport && viewport.width < 1024) {
      await page.getByTestId("mobile-tab-entorno").click();
    }
    const entornoGestorPolaroid = page.getByTestId("entorno-polaroid-gestor");
    await expect(entornoGestorPolaroid).toBeVisible();
    const gestorThumbDims = await waitForImageDimensions(entornoGestorPolaroid.locator("img"));
    expect(gestorThumbDims).toEqual({ naturalWidth: 512, naturalHeight: 512 });
  });

  test("QA-11: Reduced-motion toggle flattens Polaroid CSS transform & Logros displays all 9 Phase 1 achievements", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("./");

    // 1. Verify Phase 1 achievements remain present in expanded 15-achievement Logros tab
    const achievementsTab = page.getByTestId("title-tab-achievements");
    await expect(achievementsTab).toContainText("Logros (0/15)");
    await achievementsTab.click();

    await expect(page.getByTestId("achievements-list")).toBeVisible();
    for (const achId of PHASE1_ACHIEVEMENT_IDS) {
      await expect(page.getByTestId(`achievement-item-${achId}`)).toBeVisible();
    }

    // 2. Activate accessibility reduced-motion toggle
    const motionToggle = page.getByTestId("toggle-reduced-motion");
    await motionToggle.click();
    await expect(motionToggle).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('[data-reduced-motion="true"]')).toBeAttached();

    // 3. Start run and verify .polaroid-card transform is flattened
    await page.getByTestId("seed-input").fill("FASE1-ALEX-3");
    await page.getByTestId("start-run-btn").click();

    const polaroid = page.getByTestId("event-character-polaroid");
    await expect(polaroid).toBeVisible();
    const flattenedTransform = await polaroid.evaluate((el) => getComputedStyle(el).transform);
    expect(["none", "matrix(1, 0, 0, 1, 0, 0)"]).toContain(flattenedTransform);

    // 4. Advance to Month 2 familia_cita_con_alex and verify reactive family photo desk prop
    await clickCentered(page.getByTestId("choice-btn-0"));
    await clickCentered(page.getByTestId("outcome-continue-btn"));

    await expect(page.getByTestId("event-card")).toHaveAttribute(
      "data-event-id",
      "familia_cita_con_alex",
    );
    await selectChoiceAndAcknowledge(page, "apostar_por_citas_con_alex");

    const propFamilia = page.getByTestId("scene-prop-familia");
    const familiaDims = await waitForImageDimensions(propFamilia);
    expect(familiaDims).toEqual({ naturalWidth: 256, naturalHeight: 256 });
  });

  test("QA-12: Bespoke 16:9 milestone illustration, reactive burnout desk & deterministic EndRunScreen with 16:9 ending panel + Canvas export", async ({
    page,
  }, testInfo) => {
    const profileTag =
      testInfo.project.name === "mobile-chromium" ? "mobile-390x844" : "desktop-1440x900";

    await page.goto("./");
    await page.getByTestId("seed-input").fill("FASE1-BURNOUT-1601");
    await page.getByTestId("start-run-btn").click();

    // Month 1..3 escalation
    await selectChoiceAndAcknowledge(page, "aceptar_sobre_en_b");
    await selectChoiceAndAcknowledge(page, "tragar_para_no_discutir");
    await selectChoiceAndAcknowledge(page, "aplicar_tarifa_emergencia_nocturna");

    // Month 3 Trimestre deferral -> Stress reaches 63
    await expect(page.getByTestId("trimestre-modal")).toBeVisible();
    await page.getByTestId("trimestre-defer-btn").click();

    // Month 4 card 1: hacienda_carta_certificada (16:9 milestone illustration + reactive cafe prop)
    await expect(page.getByTestId("event-card")).toHaveAttribute(
      "data-event-id",
      "hacienda_carta_certificada",
    );
    const cafeDims = await waitForImageDimensions(page.getByTestId("scene-prop-cafe"));
    expect(cafeDims).toEqual({ naturalWidth: 256, naturalHeight: 256 });

    const milestoneBanner = page.getByTestId("event-banner-art");
    await expect(milestoneBanner).toHaveAttribute("data-banner-kind", "milestone");
    await expect(milestoneBanner).toHaveAttribute(
      "data-asset-id",
      "illus_hito_inspeccion_hacienda",
    );
    const milestoneDims = await waitForImageDimensions(milestoneBanner);
    expect(milestoneDims).toEqual({ naturalWidth: 960, naturalHeight: 540 });

    await assertPolaroidDoesNotOverlapChoices(page);
    await selectChoiceAndAcknowledge(page, "presentar_escrito_casero");

    // Month 4 card 2: stress >= 75 switches desk background to bg_despacho_burnout
    await expect(page.getByTestId("scene-bg")).toHaveAttribute(
      "data-asset-id",
      "bg_despacho_burnout",
    );
    const burnoutBgDims = await waitForImageDimensions(page.getByTestId("scene-bg"));
    expect(burnoutBgDims).toEqual({ naturalWidth: 1280, naturalHeight: 720 });

    await selectChoiceAndAcknowledge(page, "parche_taller_barrio");

    // Month 5..6: stress reaches 100 -> burnout defeat at Month 6 Trimestre -> EndRunScreen
    await selectChoiceAndAcknowledge(page, "priorizar_cartera_clientes");
    await selectChoiceAndAcknowledge(page, "firmar_acta_en_conformidad");
    await selectChoiceAndAcknowledge(page, "campana_caza_clientes_verano");
    await expect(page.getByTestId("trimestre-modal")).toBeVisible();
    await page.getByTestId("trimestre-pay-btn").click();

    await expect(page.getByTestId("end-run-screen")).toBeVisible();
    const endIllus = page.getByTestId("end-run-illustration");
    await expect(endIllus).toHaveAttribute("data-asset-id", "illus_final_ansiedad");
    const endIllusDims = await waitForImageDimensions(endIllus);
    expect(endIllusDims).toEqual({ naturalWidth: 960, naturalHeight: 540 });

    await expect(page.getByTestId("end-run-quote")).not.toBeEmpty();
    await expect(page.getByTestId("end-run-duration")).toBeVisible();
    await expect(page.getByTestId("end-run-money")).toBeVisible();
    await expect(page.getByTestId("end-run-billed")).toBeVisible();

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
      path: screenshotPath(`06-phase1-endrun-burnout-${profileTag}.png`),
      fullPage: true,
    });

    // Verify unlocked Phase 1 achievements persisted to profile
    await clickCentered(page.getByTestId("end-return-title-btn"));
    await page.getByTestId("title-tab-achievements").click();
    await expect(page.getByTestId("achievement-item-primer_trimestre")).toContainText("SELLADO");
    await expect(page.getByTestId("achievement-item-superviviente_hacienda")).toContainText(
      "SELLADO",
    );
  });
});
