import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { type Locator, expect, test } from "@playwright/test";

const SCREENSHOT_DIR = resolve(process.cwd(), "test-results", "qa-screenshots");

function screenshotPath(filename: string): string {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  return resolve(SCREENSHOT_DIR, filename);
}

const DESKTOP_UX_VIEWPORTS = [
  { label: "laptop-1366x768", width: 1366, height: 768 },
  { label: "desktop-1440x900", width: 1440, height: 900 },
] as const;

const MOBILE_UX_VIEWPORTS = [
  { label: "narrow-mobile-360x780", width: 360, height: 780 },
  { label: "mobile-390x844", width: 390, height: 844 },
] as const;

/**
 * Asserts that an element is 100% visible inside the live browser viewport WITHOUT calling
 * scrollIntoViewIfNeeded() — catching any "scroll down to find buttons / scroll up to read results" UX regressions.
 */
async function assertVisibleInViewportWithoutScroll(
  locator: Locator,
  bounds: { minTop: number; maxBottom: number; viewportWidth: number },
  label: string,
): Promise<{ x: number; y: number; width: number; height: number }> {
  await expect(locator, `Expected ${label} to be rendered`).toBeVisible();
  const box = await locator.boundingBox();
  expect(box, `Expected non-null boundingBox for ${label}`).not.toBeNull();

  expect(
    box!.x,
    `Expected ${label} left edge >= 0 without horizontal scroll (got x=${box!.x})`,
  ).toBeGreaterThanOrEqual(0);
  expect(
    box!.x + box!.width,
    `Expected ${label} right edge <= ${bounds.viewportWidth + 0.5} (got right=${box!.x + box!.width})`,
  ).toBeLessThanOrEqual(bounds.viewportWidth + 0.5);

  expect(
    box!.y,
    `UX Regression: ${label} top (${box!.y}px) is tucked behind sticky HUD or above viewport (minTop=${bounds.minTop}px)`,
  ).toBeGreaterThanOrEqual(bounds.minTop - 1);
  expect(
    box!.y + box!.height,
    `UX Regression: ${label} bottom (${box!.y + box!.height}px) overflows below the fold (${bounds.maxBottom}px) requiring manual scroll`,
  ).toBeLessThanOrEqual(bounds.maxBottom + 1);

  return box!;
}

/**
 * Verifies via document.elementFromPoint(cx, cy) that the visual center of `locator` actually
 * receives pointer clicks and is not occluded by a sticky header, fixed nav bar, Polaroid, or toast.
 */
async function assertCenterHitTargetUnoccluded(locator: Locator, label: string): Promise<void> {
  await expect(locator, `Expected ${label} to be visible before hit-target check`).toBeVisible();
  const hitResult = await locator.evaluate((el) => {
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const topEl = document.elementFromPoint(cx, cy);
    return {
      cx,
      cy,
      unoccluded: topEl !== null && (el === topEl || el.contains(topEl)),
      hitTag: topEl?.tagName ?? "null",
      hitTestId: topEl?.closest("[data-testid]")?.getAttribute("data-testid") ?? null,
    };
  });

  expect(
    hitResult.unoccluded,
    `UX Regression: ${label} center (${Math.round(hitResult.cx)}, ${Math.round(hitResult.cy)}) is occluded by <${hitResult.hitTag} data-testid="${hitResult.hitTestId ?? ""}">`,
  ).toBe(true);
}

/**
 * Verifies that critical narrative/choice copy is never silently clipped or ellipsis-truncated.
 */
async function assertZeroSilentTextTruncation(locator: Locator, label: string): Promise<void> {
  await expect(locator, `Expected ${label} to be visible`).toBeVisible();
  const metrics = await locator.evaluate((el) => {
    const style = window.getComputedStyle(el);
    return {
      clientHeight: el.clientHeight,
      scrollHeight: el.scrollHeight,
      clientWidth: el.clientWidth,
      scrollWidth: el.scrollWidth,
      textOverflow: style.textOverflow,
      overflowY: style.overflowY,
    };
  });

  expect(
    metrics.textOverflow,
    `UX Regression: ${label} must not truncate gameplay text with ellipsis`,
  ).not.toBe("ellipsis");
  expect(
    metrics.scrollHeight,
    `UX Regression: ${label} vertically clips text (scrollHeight=${metrics.scrollHeight}, clientHeight=${metrics.clientHeight})`,
  ).toBeLessThanOrEqual(metrics.clientHeight + 2);
  expect(
    metrics.scrollWidth,
    `UX Regression: ${label} horizontally clips text (scrollWidth=${metrics.scrollWidth}, clientWidth=${metrics.clientWidth})`,
  ).toBeLessThanOrEqual(metrics.clientWidth + 2);
}

/**
 * Verifies WCAG foreground-vs-background contrast (>= minRatio) by walking ancestor backgrounds,
 * catching CSS cascade / layer bugs like white text rendered over a white card.
 */
async function assertReadableTextContrast(
  locator: Locator,
  label: string,
  minRatio = 4.5,
): Promise<void> {
  await expect(locator, `Expected ${label} to be visible for contrast check`).toBeVisible();
  const ratio = await locator.evaluate((el) => {
    const parseRgba = (raw: string): [number, number, number, number] => {
      const nums = raw.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0, 1];
      return [nums[0] ?? 0, nums[1] ?? 0, nums[2] ?? 0, nums.length >= 4 ? (nums[3] ?? 1) : 1];
    };
    const srgbChannel = (c: number) => {
      const v = c / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    const luminance = (rgb: [number, number, number]) =>
      0.2126 * srgbChannel(rgb[0]) + 0.7152 * srgbChannel(rgb[1]) + 0.0722 * srgbChannel(rgb[2]);

    const fg = parseRgba(window.getComputedStyle(el).color);
    let bg: [number, number, number] = [233, 222, 203]; // desk fallback
    let cur: HTMLElement | null = el as HTMLElement;
    while (cur) {
      const c = parseRgba(window.getComputedStyle(cur).backgroundColor);
      if (c[3] >= 0.85) {
        bg = [c[0], c[1], c[2]];
        break;
      }
      cur = cur.parentElement;
    }

    const l1 = luminance([fg[0], fg[1], fg[2]]);
    const l2 = luminance(bg);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  });

  expect(
    ratio,
    `UX Regression: ${label} has illegible contrast ratio (${ratio.toFixed(2)}:1 < ${minRatio}:1)`,
  ).toBeGreaterThanOrEqual(minRatio);
}

test.describe("Autónomo Simulator — Usability & User Experience (UX) Audit Suite", () => {
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

  for (const vp of DESKTOP_UX_VIEWPORTS) {
    test(`QA-20 (${vp.label}): Zero yo-yo scroll — event banner, body, all choices & outcome fit 100% above the fold`, async ({
      page,
    }, testInfo) => {
      test.skip(
        testInfo.project.name !== "desktop-chromium",
        "Desktop viewport UX audit executes in desktop-chromium",
      );

      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("./");
      await page.getByTestId("seed-input").fill("FASE1-BURNOUT-1601");
      await page.getByTestId("start-run-btn").click();
      await expect(page.getByTestId("game-screen")).toBeVisible();

      const verifyActiveEventFitsWithoutScroll = async (turnLabel: string) => {
        const scrollState = await page.evaluate(() => ({
          scrollY: window.scrollY,
          scrollHeight: document.documentElement.scrollHeight,
          innerHeight: window.innerHeight,
        }));
        expect(scrollState.scrollY, `Expected zero vertical scroll on ${turnLabel}`).toBe(0);
        expect(
          scrollState.scrollHeight,
          `Expected entire 3-column desktop workspace to fit ${vp.label} without page scrollbar on ${turnLabel} (scrollHeight=${scrollState.scrollHeight}, innerHeight=${scrollState.innerHeight})`,
        ).toBeLessThanOrEqual(scrollState.innerHeight + 2);

        const headerBox = await page.locator("header").first().boundingBox();
        expect(headerBox).not.toBeNull();
        const bounds = {
          minTop: headerBox!.y + headerBox!.height,
          maxBottom: vp.height,
          viewportWidth: vp.width,
        };

        await assertVisibleInViewportWithoutScroll(
          page.getByTestId("event-title"),
          bounds,
          `${turnLabel} event-title`,
        );
        await assertVisibleInViewportWithoutScroll(
          page.getByTestId("event-body"),
          bounds,
          `${turnLabel} event-body`,
        );

        const choiceButtons = page.locator('[data-testid^="choice-btn-"]');
        const choiceCount = await choiceButtons.count();
        expect(choiceCount).toBeGreaterThanOrEqual(2);
        for (let i = 0; i < choiceCount; i += 1) {
          await assertVisibleInViewportWithoutScroll(
            choiceButtons.nth(i),
            bounds,
            `${turnLabel} choice-btn-${i}`,
          );
        }
      };

      const clickChoiceAndVerifyOutcomeFitsWithoutScroll = async (
        choiceId: string,
        turnLabel: string,
      ) => {
        await verifyActiveEventFitsWithoutScroll(turnLabel);

        // Click directly WITHOUT scrollIntoViewIfNeeded()
        const choiceBtn = page.locator(`[data-choice-id="${choiceId}"]`);
        await expect(choiceBtn).toBeEnabled();
        await choiceBtn.click();

        const headerBox = await page.locator("header").first().boundingBox();
        expect(headerBox).not.toBeNull();
        const bounds = {
          minTop: headerBox!.y + headerBox!.height,
          maxBottom: vp.height,
          viewportWidth: vp.width,
        };

        expect(
          await page.evaluate(() => window.scrollY),
          `Expected scrollY === 0 when reading outcome on ${turnLabel}`,
        ).toBe(0);

        await assertVisibleInViewportWithoutScroll(
          page.getByTestId("outcome-panel"),
          bounds,
          `${turnLabel} outcome-panel`,
        );
        await assertVisibleInViewportWithoutScroll(
          page.getByTestId("outcome-result-text"),
          bounds,
          `${turnLabel} outcome-result-text`,
        );
        await assertVisibleInViewportWithoutScroll(
          page.getByTestId("outcome-continue-btn"),
          bounds,
          `${turnLabel} outcome-continue-btn`,
        );

        await page.getByTestId("outcome-continue-btn").click();
      };

      // Play Months 1..3 + Trimestre + Month 4 (16:9 milestone illustration + Inspector Polaroid)
      await clickChoiceAndVerifyOutcomeFitsWithoutScroll("aceptar_sobre_en_b", `${vp.label} M1`);
      await clickChoiceAndVerifyOutcomeFitsWithoutScroll(
        "tragar_para_no_discutir",
        `${vp.label} M2`,
      );
      await clickChoiceAndVerifyOutcomeFitsWithoutScroll(
        "aplicar_tarifa_emergencia_nocturna",
        `${vp.label} M3`,
      );

      await expect(page.getByTestId("trimestre-modal")).toBeVisible();
      await page.getByTestId("trimestre-defer-btn").click();

      // Month 4 card 1 is hacienda_carta_certificada (16:9 milestone art + NPC Polaroid + 3 choices)
      await expect(page.getByTestId("event-card")).toHaveAttribute(
        "data-event-id",
        "hacienda_carta_certificada",
      );
      await verifyActiveEventFitsWithoutScroll(`${vp.label} M4 milestone`);

      if (vp.width === 1366) {
        await page.screenshot({
          path: screenshotPath("09-ux-laptop-1366x768-zero-scroll.png"),
          fullPage: false,
        });
      }
    });

    test(`QA-21 (${vp.label}): Primary CTAs on TitleScreen, Modals & EndRunScreen are 100% visible above the fold`, async ({
      page,
    }, testInfo) => {
      test.skip(
        testInfo.project.name !== "desktop-chromium",
        "Desktop CTA fold audit executes in desktop-chromium",
      );

      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("./");

      const fullViewportBounds = { minTop: 0, maxBottom: vp.height, viewportWidth: vp.width };

      // 1. Fresh TitleScreen
      await assertVisibleInViewportWithoutScroll(
        page.getByTestId("seed-input"),
        fullViewportBounds,
        `TitleScreen seed-input (${vp.label})`,
      );
      await assertVisibleInViewportWithoutScroll(
        page.getByTestId("start-run-btn"),
        fullViewportBounds,
        `TitleScreen start-run-btn (${vp.label})`,
      );

      // 2. Start run -> return to TitleScreen so continue-run-card is ALSO mounted
      await page.getByTestId("seed-input").fill("FASE0-TRIMESTRE-PAY");
      await page.getByTestId("start-run-btn").click();
      await expect(page.getByTestId("game-screen")).toBeVisible();

      await page.getByTestId("return-title-btn").click();
      await expect(page.getByTestId("continue-run-card")).toBeVisible();
      await assertVisibleInViewportWithoutScroll(
        page.getByTestId("continue-run-btn"),
        fullViewportBounds,
        `TitleScreen continue-run-btn (${vp.label})`,
      );
      await assertVisibleInViewportWithoutScroll(
        page.getByTestId("start-run-btn"),
        fullViewportBounds,
        `TitleScreen start-run-btn with active run (${vp.label})`,
      );

      // 3. Resume -> AbandonRunModal primary exit options all visible without scrolling
      await page.getByTestId("continue-run-btn").click();
      await page.getByTestId("abandon-run-btn").click();
      await expect(page.getByTestId("abandon-modal")).toBeVisible();
      for (const btnId of [
        "abandon-oposiciones-btn",
        "abandon-salaried-btn",
        "abandon-cese-btn",
      ] as const) {
        await assertVisibleInViewportWithoutScroll(
          page.getByTestId(btnId),
          fullViewportBounds,
          `AbandonRunModal ${btnId} (${vp.label})`,
        );
      }
      await page.getByTestId("abandon-cancel-btn").click();

      // 4. Advance to Month 3 QuarterlyTaxModal -> both Pay & Defer buttons visible without scrolling
      for (let guard = 0; guard < 6; guard += 1) {
        if (await page.getByTestId("trimestre-modal").isVisible()) break;
        const buttons = page.locator('[data-testid^="choice-btn-"]');
        const count = await buttons.count();
        for (let i = 0; i < count; i += 1) {
          if (await buttons.nth(i).isEnabled()) {
            await buttons.nth(i).click();
            break;
          }
        }
        await page.getByTestId("outcome-continue-btn").click();
      }
      await expect(page.getByTestId("trimestre-modal")).toBeVisible();
      await assertVisibleInViewportWithoutScroll(
        page.getByTestId("trimestre-pay-btn"),
        fullViewportBounds,
        `QuarterlyTaxModal trimestre-pay-btn (${vp.label})`,
      );
      await assertVisibleInViewportWithoutScroll(
        page.getByTestId("trimestre-defer-btn"),
        fullViewportBounds,
        `QuarterlyTaxModal trimestre-defer-btn (${vp.label})`,
      );
      await page.getByTestId("trimestre-pay-btn").click();

      // 5. Exit to EndRunScreen -> title, illustration, certificate canvas, Share & Replay CTAs all above the fold
      await page.getByTestId("abandon-run-btn").click();
      await page.getByTestId("abandon-oposiciones-btn").click();
      await expect(page.getByTestId("end-run-screen")).toBeVisible();
      expect(await page.evaluate(() => window.scrollY)).toBe(0);

      for (const id of [
        "end-run-title",
        "end-run-illustration",
        "share-canvas",
        "share-native-btn",
        "copy-summary-btn",
        "download-card-btn",
        "end-new-run-btn",
        "end-return-title-btn",
      ] as const) {
        await assertVisibleInViewportWithoutScroll(
          page.getByTestId(id),
          fullViewportBounds,
          `EndRunScreen ${id} (${vp.label})`,
        );
      }
    });
  }

  for (const vp of MOBILE_UX_VIEWPORTS) {
    test(`QA-22 (${vp.label}): Mobile bottom-nav clearance & automatic scroll-reset on choice -> outcome -> next event`, async ({
      page,
    }, testInfo) => {
      test.skip(
        testInfo.project.name !== "mobile-chromium",
        "Mobile UX scroll-reset audit executes in mobile-chromium",
      );

      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("./");
      await page.getByTestId("seed-input").fill("FASE1-BANNER-1");
      await page.getByTestId("start-run-btn").click();
      await expect(page.getByTestId("game-screen")).toBeVisible();

      // Scroll to the very bottom of the mobile page and verify the lowest choice button clears the fixed bottom nav
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      const bottomNav = page.locator('nav[aria-label="Secciones del despacho"]');
      const bottomNavBox = await bottomNav.boundingBox();
      expect(bottomNavBox).not.toBeNull();

      const choices = page.locator('[data-testid^="choice-btn-"]');
      const lastChoice = choices.nth((await choices.count()) - 1);
      const lastChoiceBox = await lastChoice.boundingBox();
      expect(lastChoiceBox).not.toBeNull();
      expect(
        lastChoiceBox!.y + lastChoiceBox!.height,
        `UX Regression: lowest choice button is tucked behind fixed mobile bottom nav on ${vp.label}`,
      ).toBeLessThanOrEqual(bottomNavBox!.y - 4);

      // Force a scrolled-down state (if page is taller than viewport) or click the bottom eligible choice
      await lastChoice.click();
      await expect(page.getByTestId("outcome-panel")).toBeVisible();

      // Scroll MUST automatically reset to 0 so user never has to manually scroll back up to read the outcome!
      expect(
        await page.evaluate(() => window.scrollY),
        `UX Regression: scrollY was not reset to 0 when outcome-panel opened on ${vp.label}`,
      ).toBe(0);

      const headerBox = await page.locator("header").first().boundingBox();
      expect(headerBox).not.toBeNull();
      const mobileVisibleBounds = {
        minTop: headerBox!.y + headerBox!.height,
        maxBottom: bottomNavBox!.y,
        viewportWidth: vp.width,
      };

      await assertVisibleInViewportWithoutScroll(
        page.getByTestId("outcome-result-text"),
        mobileVisibleBounds,
        `${vp.label} outcome-result-text`,
      );
      await assertVisibleInViewportWithoutScroll(
        page.getByTestId("outcome-continue-btn"),
        mobileVisibleBounds,
        `${vp.label} outcome-continue-btn`,
      );

      await page.getByTestId("outcome-continue-btn").click();
      await expect(page.getByTestId("event-card")).toBeVisible();
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
      await assertVisibleInViewportWithoutScroll(
        page.getByTestId("event-title"),
        mobileVisibleBounds,
        `${vp.label} next month event-title`,
      );
    });
  }

  test("QA-23: Hit-target non-occlusion (elementFromPoint + live AchievementToast), zero silent text truncation, legibility floor & spacing", async ({
    page,
  }, testInfo) => {
    const isMobile = testInfo.project.name === "mobile-chromium";
    await page.setViewportSize(
      isMobile ? { width: 390, height: 844 } : { width: 1366, height: 768 },
    );
    await page.goto("./");
    await page.getByTestId("seed-input").fill("FASE1-BANNER-1");
    await page.getByTestId("start-run-btn").click();
    await expect(page.getByTestId("game-screen")).toBeVisible();

    // 1. Zero silent truncation, contrast & typography legibility floor on active event
    await assertZeroSilentTextTruncation(page.getByTestId("event-title"), "event-title");
    await assertZeroSilentTextTruncation(page.getByTestId("event-body"), "event-body");
    await assertReadableTextContrast(page.getByTestId("event-title"), "event-title");
    await assertReadableTextContrast(page.getByTestId("event-body"), "event-body");

    const fontSizes = await page.evaluate(() => {
      const px = (sel: string) => {
        const el = document.querySelector(sel);
        return el ? Number.parseFloat(window.getComputedStyle(el).fontSize) : 0;
      };
      return {
        title: px('[data-testid="event-title"]'),
        body: px('[data-testid="event-body"]'),
        money: px('[data-testid="indicator-money-value"]'),
      };
    });
    expect(fontSizes.title, "Expected readable event-title >= 17px").toBeGreaterThanOrEqual(17);
    expect(fontSizes.body, "Expected readable event-body >= 13.5px").toBeGreaterThanOrEqual(13.5);
    expect(fontSizes.money, "Expected readable HUD money >= 12px").toBeGreaterThanOrEqual(12);

    // 2. Hit-target non-occlusion & >= 6px inter-button spacing across HUD and choices
    for (const hudBtnId of [
      "toggle-sfx-btn",
      "toggle-fast-pacing-btn",
      "return-title-btn",
      "abandon-run-btn",
    ] as const) {
      await assertCenterHitTargetUnoccluded(page.getByTestId(hudBtnId), hudBtnId);
    }

    const choiceButtons = page.locator('[data-testid^="choice-btn-"]');
    const choiceCount = await choiceButtons.count();

    for (let i = 0; i < choiceCount; i += 1) {
      const btn = choiceButtons.nth(i);
      if (isMobile) {
        // Standard W3C scrollIntoView honors CSS scroll-padding-top / scroll-padding-bottom,
        // proving keyboard/focus scrolling clears both sticky HUD and fixed mobile bottom nav.
        await btn.evaluate((el) => el.scrollIntoView({ block: "nearest", behavior: "instant" }));
      }
      await assertZeroSilentTextTruncation(btn, `choice-btn-${i}`);
      await assertCenterHitTargetUnoccluded(btn, `choice-btn-${i}`);
      const box = await btn.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height, `Expected choice-btn-${i} height >= 48px`).toBeGreaterThanOrEqual(48);
    }

    // Reset to top on desktop (already 0) or re-read document-space Ys for vertical gap check
    const gaps = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('[data-testid^="choice-btn-"]'));
      const rects = els.map((e) => e.getBoundingClientRect());
      const out: number[] = [];
      for (let i = 1; i < rects.length; i += 1) {
        const prev = rects[i - 1];
        const curr = rects[i];
        if (prev && curr) {
          out.push(curr.top - prev.bottom);
        }
      }
      return out;
    });
    for (const gap of gaps) {
      expect(gap, "Expected >= 6px ergonomic gap between choice buttons").toBeGreaterThanOrEqual(6);
    }

    if (isMobile) {
      for (const tabId of [
        "mobile-tab-despacho",
        "mobile-tab-cuentas",
        "mobile-tab-entorno",
        "mobile-tab-historial",
      ] as const) {
        await assertCenterHitTargetUnoccluded(page.getByTestId(tabId), tabId);
      }
    }

    // 3. Trigger live AchievementToast (hiring Paco unlocks gestor_contratado) and prove it NEVER blocks outcome-continue-btn
    const hirePacoBtn = page.locator('[data-choice-id="contratar_paco_barato"]');
    await hirePacoBtn.click();

    await expect(page.getByTestId("outcome-panel")).toBeVisible();
    await expect(page.getByTestId("achievement-toast")).toBeVisible();
    await assertReadableTextContrast(
      page.getByTestId("achievement-toast").locator("strong"),
      "achievement-toast title",
    );
    await assertReadableTextContrast(
      page.getByTestId("outcome-continue-btn"),
      "outcome-continue-btn",
    );
    await assertZeroSilentTextTruncation(
      page.getByTestId("outcome-result-text"),
      "outcome-result-text",
    );
    await assertCenterHitTargetUnoccluded(
      page.getByTestId("outcome-continue-btn"),
      "outcome-continue-btn while achievement-toast is open",
    );
  });

  test("QA-24: Frictionless keyboard-only 3-month turn loop + Trimestre settlement with zero scroll drift (1366x768)", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "Desktop keyboard ergonomics flow executes in desktop-chromium",
    );

    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto("./");
    await page.getByTestId("seed-input").fill("FASE0-TRIMESTRE-PAY");
    await page.keyboard.press("Enter");

    await expect(page.getByTestId("game-screen")).toBeVisible();

    for (let step = 0; step < 6; step += 1) {
      if (await page.getByTestId("trimestre-modal").isVisible()) {
        break;
      }
      await expect(page.getByTestId("event-card")).toBeVisible();
      expect(await page.evaluate(() => window.scrollY)).toBe(0);

      // Find first eligible 1-based shortcut key
      const buttons = page.locator('[data-testid^="choice-btn-"]');
      const count = await buttons.count();
      let keyToPress = "1";
      for (let i = 0; i < count; i += 1) {
        if (await buttons.nth(i).isEnabled()) {
          keyToPress = String(i + 1);
          break;
        }
      }

      await page.keyboard.press(keyToPress);
      await expect(page.getByTestId("outcome-panel")).toBeVisible();
      expect(await page.evaluate(() => window.scrollY)).toBe(0);

      await page.keyboard.press("Enter");
    }

    await expect(page.getByTestId("trimestre-modal")).toBeVisible();
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await page.keyboard.press("1");
    await expect(page.getByTestId("trimestre-modal")).toBeHidden();
    await expect(page.getByTestId("indicator-calendar")).toContainText("Año 1 · Mes 4");
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });
});
