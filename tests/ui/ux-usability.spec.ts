import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { type Locator, type Page, expect, test } from "@playwright/test";

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
 * Verifies WCAG foreground-vs-background contrast (>= minRatio) by walking ancestor backgrounds
 * AND multiplying ancestor CSS opacity, catching both CSS cascade bugs and washed-out opacity wrappers.
 */
async function assertReadableTextContrast(
  locator: Locator,
  label: string,
  minRatio = 4.5,
): Promise<void> {
  await expect(locator, `Expected ${label} to be visible for contrast check`).toBeVisible();
  const ratio = await locator.evaluate(async (el) => {
    const chain: HTMLElement[] = [];
    let cur: HTMLElement | null = el as HTMLElement;
    while (cur) {
      chain.push(cur);
      cur = cur.parentElement;
    }

    // Wait for finite entrance animations (e.g., 170ms animate-dossier fade-in) so steady-state contrast is measured
    const finiteAnims = chain.flatMap((node) =>
      node
        .getAnimations()
        .filter((anim) => anim.effect?.getComputedTiming().iterations !== Number.POSITIVE_INFINITY),
    );
    if (finiteAnims.length > 0) {
      await Promise.all(finiteAnims.map((anim) => anim.finished.catch(() => undefined)));
    }

    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const parseCssColor = (raw: string): [number, number, number, number] => {
      if (!raw || raw === "transparent" || raw === "rgba(0, 0, 0, 0)" || !ctx) {
        return [0, 0, 0, 0];
      }
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = raw;
      ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      return [d[0] ?? 0, d[1] ?? 0, d[2] ?? 0, (d[3] ?? 0) / 255];
    };

    const blendOver = (
      fgRgb: [number, number, number],
      alpha: number,
      bgRgb: [number, number, number],
    ): [number, number, number] => {
      const a = Math.min(1, Math.max(0, alpha));
      return [
        fgRgb[0] * a + bgRgb[0] * (1 - a),
        fgRgb[1] * a + bgRgb[1] * (1 - a),
        fgRgb[2] * a + bgRgb[2] * (1 - a),
      ];
    };
    const srgbChannel = (c: number) => {
      const v = c / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    const luminance = (rgb: [number, number, number]) =>
      0.2126 * srgbChannel(rgb[0]) + 0.7152 * srgbChannel(rgb[1]) + 0.0722 * srgbChannel(rgb[2]);

    // Composite backgrounds from outermost ancestor inward, honoring static element opacity
    let bg: [number, number, number] = [233, 222, 203]; // desk fallback
    let effectiveOpacity = 1;
    for (let i = chain.length - 1; i >= 0; i -= 1) {
      const node = chain[i]!;
      const style = window.getComputedStyle(node);
      const nodeOpacity = Number.parseFloat(style.opacity || "1");
      if (Number.isFinite(nodeOpacity)) {
        effectiveOpacity *= nodeOpacity;
      }
      const c = parseCssColor(style.backgroundColor);
      if (c[3] > 0) {
        bg = blendOver([c[0], c[1], c[2]], c[3] * effectiveOpacity, bg);
      }
    }

    const rawFg = parseCssColor(window.getComputedStyle(el).color);
    const effectiveFg = blendOver([rawFg[0], rawFg[1], rawFg[2]], rawFg[3] * effectiveOpacity, bg);

    const l1 = luminance(effectiveFg);
    const l2 = luminance(bg);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  });

  expect(
    ratio,
    `UX Regression: ${label} has illegible effective contrast ratio (${ratio.toFixed(2)}:1 < ${minRatio}:1)`,
  ).toBeGreaterThanOrEqual(minRatio);
}

/**
 * DEF-P36-01 Guard: Asserts zero horizontal/vertical bounding-box overlap and zero horizontal
 * flex-child overflow across all visible direct children of `.month-economy-strip-row`.
 */
async function assertEconomyStripRowNonOverlap(page: Page, label: string): Promise<void> {
  const strip = page.getByTestId("month-economy-strip");
  await expect(strip, `Expected month-economy-strip visible (${label})`).toBeVisible();

  const report = await strip.evaluate((stripEl) => {
    const row = stripEl.querySelector(".month-economy-strip-row");
    if (!row) {
      return { ok: false, reason: "Missing .month-economy-strip-row" };
    }
    const visibleChildren = Array.from(row.children).filter((child) => {
      const style = window.getComputedStyle(child);
      if (style.display === "none" || style.visibility === "hidden") {
        return false;
      }
      const rect = child.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }) as HTMLElement[];

    if (visibleChildren.length < 2) {
      return {
        ok: false,
        reason: `Expected >= 2 visible children in .month-economy-strip-row, got ${visibleChildren.length}`,
      };
    }

    for (let i = 0; i < visibleChildren.length; i += 1) {
      const el = visibleChildren[i]!;
      if (el.scrollWidth > el.clientWidth + 1) {
        return {
          ok: false,
          reason: `Child ${i} overflows horizontally (scrollWidth=${el.scrollWidth} > clientWidth=${el.clientWidth}): "${el.textContent?.trim()}"`,
        };
      }
    }

    for (let i = 0; i < visibleChildren.length; i += 1) {
      const a = visibleChildren[i]!.getBoundingClientRect();
      for (let j = i + 1; j < visibleChildren.length; j += 1) {
        const b = visibleChildren[j]!.getBoundingClientRect();
        const overlapsX = a.left < b.right - 0.5 && a.right > b.left + 0.5;
        const overlapsY = a.top < b.bottom - 0.5 && a.bottom > b.top + 0.5;
        if (overlapsX && overlapsY) {
          return {
            ok: false,
            reason: `Children ${i} (right=${a.right.toFixed(1)}) and ${j} (left=${b.left.toFixed(1)}) overlap in .month-economy-strip-row`,
          };
        }
      }
    }

    return { ok: true, reason: "" };
  });

  expect(report.ok, `DEF-P36-01 Regression (${label}): ${report.reason}`).toBe(true);
}

/**
 * DEF-P36-02 Guard: Whenever `[data-testid="event-character-polaroid"]` is visible on desktop,
 * asserts its `<figcaption>` does not horizontally overflow (`scrollWidth <= clientWidth + 1`)
 * and sits strictly inside `[data-testid="event-character-polaroid"]`'s left/right bounds.
 */
async function assertDesktopPolaroidContained(page: Page, label: string): Promise<void> {
  const polaroid = page.getByTestId("event-character-polaroid");
  if (!(await polaroid.isVisible())) {
    return;
  }

  const metrics = await polaroid.evaluate((figEl) => {
    const caption = figEl.querySelector("figcaption");
    if (!caption) {
      return { ok: false, reason: "Missing <figcaption> inside event-character-polaroid" };
    }
    const pRect = figEl.getBoundingClientRect();
    const cRect = caption.getBoundingClientRect();
    if (caption.scrollWidth > caption.clientWidth + 1) {
      return {
        ok: false,
        reason: `figcaption scrollWidth (${caption.scrollWidth}) > clientWidth (${caption.clientWidth}) for "${caption.textContent?.trim()}"`,
      };
    }
    if (cRect.left < pRect.left - 1 || cRect.right > pRect.right + 1) {
      return {
        ok: false,
        reason: `figcaption [${cRect.left.toFixed(1)}..${cRect.right.toFixed(1)}] protrudes outside polaroid [${pRect.left.toFixed(1)}..${pRect.right.toFixed(1)}]`,
      };
    }
    return { ok: true, reason: "" };
  });

  expect(metrics.ok, `DEF-P36-02 Regression (${label}): ${metrics.reason}`).toBe(true);
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
      await page.getByTestId("seed-input").fill("P35-M4-HITO-72");
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
      await clickChoiceAndVerifyOutcomeFitsWithoutScroll(
        "cambiar_de_tema_con_elegancia",
        `${vp.label} M1`,
      );
      await clickChoiceAndVerifyOutcomeFitsWithoutScroll(
        "aceptar_mitad_efectivo_y_cajas",
        `${vp.label} M2`,
      );
      await clickChoiceAndVerifyOutcomeFitsWithoutScroll("seguir_autogestion", `${vp.label} M3`);

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
      await page.getByTestId("seed-input").fill("P35-BANNER-139");
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
    await page.getByTestId("seed-input").fill("P35-BANNER-139");
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
    if (isMobile) {
      const menuBtn = page.getByTestId("mobile-utility-menu-btn");
      await assertCenterHitTargetUnoccluded(menuBtn, "mobile-utility-menu-btn");
      await menuBtn.click();
      await expect(page.getByTestId("mobile-utility-sheet")).toBeVisible();
      for (const hudBtnId of [
        "locale-toggle-btn",
        "toggle-sfx-btn",
        "toggle-fast-pacing-btn",
        "return-title-btn",
        "abandon-run-btn",
      ] as const) {
        await assertCenterHitTargetUnoccluded(page.getByTestId(hudBtnId), hudBtnId);
      }
      await page.keyboard.press("Escape");
      await expect(page.getByTestId("mobile-utility-sheet")).toBeHidden();
    } else {
      for (const hudBtnId of [
        "locale-toggle-btn",
        "toggle-sfx-btn",
        "toggle-fast-pacing-btn",
        "return-title-btn",
        "abandon-run-btn",
      ] as const) {
        await assertCenterHitTargetUnoccluded(page.getByTestId(hudBtnId), hudBtnId);
      }
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

  test("QA-24: Full desktop zero-mouse keyboard navigation across TitleScreen, GameScreen, Modals & EndRunScreen (1366x768)", async ({
    page,
    context,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "Desktop keyboard ergonomics flow executes in desktop-chromium",
    );

    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto("./");
    await expect(page.getByTestId("title-screen")).toBeVisible();

    // 1. TitleScreen shortcuts: switch archive tabs (2 / 1) & WAI-ARIA ArrowRight/ArrowLeft on tablist
    await page.keyboard.press("2");
    await expect(page.getByTestId("achievements-list")).toBeVisible();
    await page.keyboard.press("1");
    await expect(page.getByTestId("hall-of-fame-list")).toBeVisible();

    // Tab until Hall of Fame tab is focused, then use ArrowRight / ArrowLeft + Tab into scrollable tabpanel
    for (let i = 0; i < 16; i += 1) {
      const focusedTestId = await page.evaluate(
        () => document.activeElement?.getAttribute("data-testid") ?? null,
      );
      if (focusedTestId === "title-tab-hall-of-fame") break;
      await page.keyboard.press("Tab");
    }
    await expect(page.getByTestId("title-tab-hall-of-fame")).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("title-tab-achievements")).toBeFocused();
    await expect(page.getByTestId("achievements-list")).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(page.getByTestId("title-archive-panel")).toBeFocused();
    await page.keyboard.press("1");
    await expect(page.getByTestId("hall-of-fame-list")).toBeVisible();

    // Desk preference shortcuts on TitleScreen (R, M, F)
    await page.keyboard.press("r");
    await expect(page.getByTestId("toggle-reduced-motion")).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("r");
    await expect(page.getByTestId("toggle-reduced-motion")).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    const initialSfxPressed = await page
      .getByTestId("toggle-sfx-title-btn")
      .getAttribute("aria-pressed");
    await page.keyboard.press("m");
    await expect(page.getByTestId("toggle-sfx-title-btn")).toHaveAttribute(
      "aria-pressed",
      initialSfxPressed === "true" ? "false" : "true",
    );
    await page.keyboard.press("m");

    await page.keyboard.press("f");
    await expect(page.getByTestId("toggle-fast-pacing-title-btn")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.keyboard.press("f");
    await expect(page.getByTestId("toggle-fast-pacing-title-btn")).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    // Focus seed input with 'S', type deterministic seed, Escape to blur, Enter to start run
    await page.keyboard.press("s");
    await expect(page.getByTestId("seed-input")).toBeFocused();
    await page.keyboard.type("FASE0-TRIMESTRE-PAY");
    await page.keyboard.press("Escape");
    await page.keyboard.press("Enter");

    await expect(page.getByTestId("game-screen")).toBeVisible();
    expect(await page.evaluate(() => window.scrollY)).toBe(0);

    // 2. GameScreen Month 1: ArrowDown / ArrowUp choice cycling + Enter confirm + Space outcome continue
    const enabledMonth1Indices = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLButtonElement>('[data-testid^="choice-btn-"]'))
        .map((btn, idx) => (btn.disabled ? -1 : idx))
        .filter((idx) => idx >= 0),
    );
    expect(enabledMonth1Indices.length).toBeGreaterThanOrEqual(2);

    await page.keyboard.press("ArrowDown");
    await expect(page.getByTestId(`choice-btn-${enabledMonth1Indices[0]}`)).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByTestId(`choice-btn-${enabledMonth1Indices[1]}`)).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(page.getByTestId(`choice-btn-${enabledMonth1Indices[0]}`)).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(page.getByTestId("outcome-panel")).toBeVisible();
    expect(await page.evaluate(() => window.scrollY)).toBe(0);

    await page.keyboard.press("ArrowDown");
    await expect(page.getByTestId("outcome-continue-btn")).toBeFocused();
    await page.keyboard.press("Space");
    await expect(page.getByTestId("indicator-calendar")).toContainText("Año 1 · Mes 2");

    // HUD hotkeys on GameScreen: I -> return to TitleScreen, C -> continue active run
    await page.keyboard.press("i");
    await expect(page.getByTestId("title-screen")).toBeVisible();
    await expect(page.getByTestId("continue-run-card")).toBeVisible();
    await page.keyboard.press("c");
    await expect(page.getByTestId("game-screen")).toBeVisible();
    await expect(page.getByTestId("indicator-calendar")).toContainText("Año 1 · Mes 2");

    // 3. Advance to Month 3 QuarterlyTaxModal purely by keyboard
    for (let step = 0; step < 6; step += 1) {
      if (await page.getByTestId("trimestre-modal").isVisible()) {
        break;
      }
      await expect(page.getByTestId("event-card")).toBeVisible();
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("outcome-panel")).toBeVisible();
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
      await page.keyboard.press("Enter");
    }

    // Verify QuarterlyTaxModal auto-focus, Tab focus trap, ArrowDown/ArrowUp & '1' shortcut
    await expect(page.getByTestId("trimestre-modal")).toBeVisible();
    await expect(page.getByTestId("trimestre-pay-btn")).toBeFocused();
    for (let t = 0; t < 4; t += 1) {
      await page.keyboard.press("Tab");
      const insideTrimestre = await page.evaluate(
        () => document.activeElement?.closest('[data-testid="trimestre-modal"]') !== null,
      );
      expect(insideTrimestre, "Expected Tab focus to stay trapped inside trimestre-modal").toBe(
        true,
      );
    }
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowUp");
    await expect(page.getByTestId("trimestre-pay-btn")).toBeFocused();
    await page.keyboard.press("1");
    await expect(page.getByTestId("trimestre-modal")).toBeHidden();
    await expect(page.getByTestId("indicator-calendar")).toContainText("Año 1 · Mes 4");
    expect(await page.evaluate(() => window.scrollY)).toBe(0);

    // Dismiss AchievementToast with Escape if visible
    if (await page.getByTestId("achievement-toast").isVisible()) {
      await page.keyboard.press("Escape");
      await expect(page.getByTestId("achievement-toast")).toBeHidden();
    }

    // 4. Advance in Fast Pacing ('F') to Month 12 AnnualSummaryModal via keyboard
    await page.keyboard.press("f");
    await expect(page.getByTestId("toggle-fast-pacing-btn")).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    for (let guard = 0; guard < 30; guard += 1) {
      if (await page.getByTestId("annual-summary-modal").isVisible()) {
        break;
      }
      if (await page.getByTestId("end-run-screen").isVisible()) {
        break;
      }
      if (await page.getByTestId("trimestre-modal").isVisible()) {
        await page.keyboard.press("1");
        continue;
      }
      if (await page.getByTestId("outcome-panel").isVisible()) {
        await page.keyboard.press("Enter");
        continue;
      }
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
    }

    await expect(page.getByTestId("annual-summary-modal")).toBeVisible();
    await expect(page.getByTestId("annual-summary-close-btn")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByTestId("annual-summary-close-btn")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("annual-summary-modal")).toBeHidden();
    await expect(page.getByTestId("indicator-calendar")).toContainText("Año 2 · Mes 1");

    // 5. Open AbandonRunModal with 'B', verify Tab focus trap + Escape cancel, then select salaried exit via ArrowDown + Enter
    await page.keyboard.press("b");
    await expect(page.getByTestId("abandon-modal")).toBeVisible();
    await expect(page.getByTestId("abandon-oposiciones-btn")).toBeFocused();
    for (let t = 0; t < 5; t += 1) {
      await page.keyboard.press("Tab");
      const insideAbandon = await page.evaluate(
        () => document.activeElement?.closest('[data-testid="abandon-modal"]') !== null,
      );
      expect(insideAbandon, "Expected Tab focus to stay trapped inside abandon-modal").toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("abandon-modal")).toBeHidden();

    await page.keyboard.press("b");
    await expect(page.getByTestId("abandon-oposiciones-btn")).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByTestId("abandon-salaried-btn")).toBeFocused();
    await page.keyboard.press("Enter");

    // 6. EndRunScreen keyboard actions: auto-focus, Arrow navigation, 'C' copy summary, 'Escape' to Title, 'N' new run
    await expect(page.getByTestId("end-run-screen")).toBeVisible();
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await expect(page.getByTestId("end-new-run-btn")).toBeFocused();

    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("end-return-title-btn")).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByTestId("end-new-run-btn")).toBeFocused();

    await page.keyboard.press("c");
    await expect(page.getByTestId("share-feedback")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("title-screen")).toBeVisible();
    await expect(page.getByTestId("hall-of-fame-list")).toContainText("Regreso a la Nómina Fija");
    await expect(page.getByTestId("hall-of-fame-list")).toContainText("13 meses");

    await page.keyboard.press("n");
    await expect(page.getByTestId("game-screen")).toBeVisible();
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });

  test("QA-25: Month 120 Q40 AnnualSummary -> VictoryModal transition, keyboard focus trap & above-the-fold layout (1366x768)", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "Desktop VictoryModal keyboard check executes in desktop-chromium",
    );

    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto("./");
    await expect(page.getByTestId("title-screen")).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("game-screen")).toBeVisible();

    // Stage Month 120 Q40 quarterly_tax settlement to verify Year 10 AnnualSummaryModal opens BEFORE VictoryModal (M2-07)
    await page.evaluate(async () => {
      await new Promise<void>((resolvePromise, rejectPromise) => {
        const openReq = indexedDB.open("keyval-store");
        openReq.onerror = () => rejectPromise(openReq.error);
        openReq.onsuccess = () => {
          const db = openReq.result;
          const tx = db.transaction("keyval", "readwrite");
          const store = tx.objectStore("keyval");
          const getReq = store.get("autonomo:active_run");
          getReq.onerror = () => rejectPromise(getReq.error);
          getReq.onsuccess = () => {
            const envelope = getReq.result;
            envelope.state.month = 120;
            envelope.state.phase = "quarterly_tax";
            envelope.state.pending_victory_badge = null;
            envelope.state.earned_victories = [];
            envelope.state.indicators.money = 18500;
            envelope.state.finances.accrued_tax_liability = 950;
            store.put(envelope, "autonomo:active_run");
          };
          tx.oncomplete = () => {
            db.close();
            resolvePromise();
          };
          tx.onerror = () => rejectPromise(tx.error);
        };
      });
    });

    await page.reload();
    await expect(page.getByTestId("title-screen")).toBeVisible();
    await page.keyboard.press("Enter");

    await expect(page.getByTestId("trimestre-modal")).toBeVisible();
    await page.getByTestId("trimestre-pay-btn").click();

    // Year 10 AnnualSummaryModal MUST appear first before VictoryModal
    await expect(page.getByTestId("annual-summary-modal")).toBeVisible();
    await expect(page.getByTestId("victory-modal")).toBeHidden();
    await page.getByTestId("annual-summary-close-btn").click();
    await expect(page.getByTestId("annual-summary-modal")).toBeHidden();

    await expect(page.getByTestId("victory-modal")).toBeVisible();
    const bounds = { minTop: 0, maxBottom: 768, viewportWidth: 1366 };
    await assertVisibleInViewportWithoutScroll(
      page.getByTestId("victory-continue-btn"),
      bounds,
      "VictoryModal victory-continue-btn",
    );
    await assertVisibleInViewportWithoutScroll(
      page.getByTestId("victory-retire-btn"),
      bounds,
      "VictoryModal victory-retire-btn",
    );

    await expect(page.getByTestId("victory-continue-btn")).toBeFocused();
    for (let t = 0; t < 4; t += 1) {
      await page.keyboard.press("Tab");
      const insideVictory = await page.evaluate(
        () => document.activeElement?.closest('[data-testid="victory-modal"]') !== null,
      );
      expect(insideVictory, "Expected Tab focus to stay trapped inside victory-modal").toBe(true);
    }

    await page.keyboard.press("ArrowDown");
    await expect(page.getByTestId("victory-retire-btn")).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(page.getByTestId("end-run-screen")).toBeVisible();
    await expect(page.getByTestId("end-run-victory-badges")).toBeVisible();
  });

  test("QA-26: Full English ('en') localization, ES<->EN toggle + 'L' hotkey, reload persistence, modifier translation & zero-scroll UX (1366x768 & 360x780)", async ({
    page,
  }, testInfo) => {
    const isMobile = testInfo.project.name === "mobile-chromium";
    const vp = isMobile ? { width: 360, height: 780 } : { width: 1366, height: 768 };
    await page.setViewportSize(vp);
    await page.goto("./");

    await expect(page.getByTestId("title-screen")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
    await expect(page.getByTestId("start-run-btn")).toContainText("Nueva alta en el RETA");

    // 1. Toggle ES -> EN via locale-toggle-btn and 'L' hotkey on TitleScreen
    const titleLocaleBtn = page.getByTestId("locale-toggle-btn");
    await assertCenterHitTargetUnoccluded(titleLocaleBtn, "TitleScreen locale-toggle-btn");
    await titleLocaleBtn.click();

    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByTestId("start-run-btn")).toContainText("Register as Self-Employed");
    await expect(page.getByTestId("title-tab-hall-of-fame")).toContainText(
      "Hall of the Fallen (0)",
    );
    await expect(page.getByTestId("title-tab-achievements")).toContainText("Achievements (0/15)");

    await page.keyboard.press("l");
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
    await expect(page.getByTestId("start-run-btn")).toContainText("Nueva alta en el RETA");

    await page.keyboard.press("l");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByTestId("start-run-btn")).toContainText("Register as Self-Employed");

    const titleScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(titleScrollWidth).toBeLessThanOrEqual(vp.width);

    // 2. Start deterministic English run (P35-EN-LOCALE-134)
    await page.getByTestId("seed-input").fill("P35-EN-LOCALE-134");
    await page.getByTestId("start-run-btn").click();
    await expect(page.getByTestId("game-screen")).toBeVisible();

    // Verify English HUD, comma thousands formatting, and IndicatorBar ES<->EN hotkey + button
    await expect(page.getByTestId("indicator-calendar")).toContainText("Year 1 · Month 1");
    await expect(page.getByTestId("indicator-money-value")).toHaveText("3,052 €");
    await expect(page.getByTestId("indicator-net-cash")).toContainText("Net:");
    await expect(page.getByTestId("indicator-net-cash")).toContainText("2,532 €");

    await page.keyboard.press("l");
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
    await expect(page.getByTestId("indicator-calendar")).toContainText("Año 1 · Mes 1");

    if (isMobile) {
      const menuBtn = page.getByTestId("mobile-utility-menu-btn");
      await assertCenterHitTargetUnoccluded(menuBtn, "IndicatorBar mobile-utility-menu-btn");
      await menuBtn.click();
      await expect(page.getByTestId("mobile-utility-sheet")).toBeVisible();
    }
    const hudLocaleBtn = page.getByTestId("locale-toggle-btn");
    await assertCenterHitTargetUnoccluded(hudLocaleBtn, "IndicatorBar locale-toggle-btn");
    await hudLocaleBtn.click();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByTestId("indicator-calendar")).toContainText("Year 1 · Month 1");

    // Verify English event copy & translated NPC Polaroid name
    await expect(page.getByTestId("event-card")).toHaveAttribute(
      "data-event-id",
      "clientes_encargo_urgente",
    );
    await expect(page.getByTestId("event-character-polaroid")).toContainText("Mr. Exposure");
    await assertZeroSilentTextTruncation(page.getByTestId("event-title"), "EN event-title");
    await assertZeroSilentTextTruncation(page.getByTestId("event-body"), "EN event-body");

    const choiceButtons = page.locator('[data-testid^="choice-btn-"]');
    const choiceCount = await choiceButtons.count();
    expect(choiceCount).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < choiceCount; i += 1) {
      await assertZeroSilentTextTruncation(choiceButtons.nth(i), `EN choice-btn-${i}`);
    }

    if (!isMobile) {
      // Desktop 1366x768: zero yo-yo scroll, above-the-fold bounds & English side panels
      const scrollState = await page.evaluate(() => ({
        scrollY: window.scrollY,
        scrollHeight: document.documentElement.scrollHeight,
        innerHeight: window.innerHeight,
      }));
      expect(scrollState.scrollY).toBe(0);
      expect(scrollState.scrollHeight).toBeLessThanOrEqual(scrollState.innerHeight + 2);

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
        "EN 1366x768 event-title",
      );
      await assertVisibleInViewportWithoutScroll(
        page.getByTestId("event-body"),
        bounds,
        "EN 1366x768 event-body",
      );
      for (let i = 0; i < choiceCount; i += 1) {
        await assertVisibleInViewportWithoutScroll(
          choiceButtons.nth(i),
          bounds,
          `EN 1366x768 choice-btn-${i}`,
        );
        await assertCenterHitTargetUnoccluded(choiceButtons.nth(i), `EN choice-btn-${i}`);
      }

      await expect(page.getByTestId("panel-cuentas")).toContainText("Account Ledger");
      await expect(page.getByTestId("panel-entorno")).toContainText("Support Network");
      await expect(page.getByTestId("panel-historial")).toContainText("Dossier Logbook");

      // Click Month 1 choice WITHOUT scrollIntoViewIfNeeded() and verify outcome fits above fold
      await page.locator('[data-choice-id="entrega_express_contado"]').click();
      await expect(page.getByTestId("outcome-panel")).toBeVisible();
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
      expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(
        vp.height + 2,
      );
      await assertZeroSilentTextTruncation(
        page.getByTestId("outcome-result-text"),
        "EN outcome-result-text",
      );
      await assertVisibleInViewportWithoutScroll(
        page.getByTestId("outcome-continue-btn"),
        bounds,
        "EN 1366x768 outcome-continue-btn",
      );
      await assertCenterHitTargetUnoccluded(
        page.getByTestId("outcome-continue-btn"),
        "EN outcome-continue-btn",
      );
      await expect(page.getByTestId("outcome-continue-btn")).toContainText("Continue");
      await page.getByTestId("outcome-continue-btn").click();
    } else {
      // Narrow mobile 360x780: zero horizontal overflow, English bottom nav clearance & scroll-reset
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        vp.width,
      );
      const bottomNav = page.locator('nav[aria-label="Office sections"]');
      await expect(bottomNav).toBeVisible();
      await expect(page.getByTestId("mobile-tab-despacho")).toContainText("Desk");
      await expect(page.getByTestId("mobile-tab-cuentas")).toContainText("Ledger");
      await expect(page.getByTestId("mobile-tab-entorno")).toContainText("Network");
      await expect(page.getByTestId("mobile-tab-historial")).toContainText("Logbook");
      for (const tabId of [
        "mobile-tab-despacho",
        "mobile-tab-cuentas",
        "mobile-tab-entorno",
        "mobile-tab-historial",
      ] as const) {
        await assertCenterHitTargetUnoccluded(page.getByTestId(tabId), `EN 360x780 ${tabId}`);
      }

      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      const navBox = await bottomNav.boundingBox();
      const lastChoiceBox = await choiceButtons.nth(choiceCount - 1).boundingBox();
      expect(navBox).not.toBeNull();
      expect(lastChoiceBox).not.toBeNull();
      expect(lastChoiceBox!.y + lastChoiceBox!.height).toBeLessThanOrEqual(navBox!.y - 4);

      const m1Btn = page.locator('[data-choice-id="entrega_express_contado"]');
      await m1Btn.click();

      await expect(page.getByTestId("outcome-panel")).toBeVisible();
      await expect.poll(async () => page.evaluate(() => window.scrollY)).toBe(0);
      await assertZeroSilentTextTruncation(
        page.getByTestId("outcome-result-text"),
        "EN 360x780 outcome-result-text",
      );
      await assertCenterHitTargetUnoccluded(
        page.getByTestId("outcome-continue-btn"),
        "EN 360x780 outcome-continue-btn",
      );
      await page.getByTestId("outcome-continue-btn").click();
    }

    await expect(page.getByTestId("indicator-calendar")).toContainText("Year 1 · Month 2");

    // 3. Reload persistence: locale 'en' and active run survive browser reload
    await page.waitForTimeout(120);
    await page.reload();

    await expect(page.getByTestId("title-screen")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByTestId("continue-run-card")).toBeVisible();
    await expect(page.getByTestId("continue-run-calendar")).toContainText("Year 1 · Month 2");
    await expect(page.getByTestId("continue-run-btn")).toContainText("Continue run");
    await page.getByTestId("continue-run-btn").click();
    await expect(page.getByTestId("indicator-calendar")).toContainText("Year 1 · Month 2");

    // 4. Advance Month 2 -> Month 3, add temporal modifier, settle English QuarterlyTaxModal, and verify translated modifier in Account Ledger
    const m2Btn = page.locator('[data-choice-id="instalar_lector_dni_electronico"]');
    await m2Btn.click();
    await page.getByTestId("outcome-continue-btn").click();

    await expect(page.getByTestId("event-card")).toHaveAttribute(
      "data-event-id",
      "familia_cuota_gimnasio_fantasma",
    );
    const m3Btn = page.locator('[data-choice-id="bloquear_tres_mananas_y_entrenar"]');
    if (!isMobile) {
      expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(
        vp.height + 2,
      );
    }
    await m3Btn.click();
    await page.getByTestId("outcome-continue-btn").click();

    await expect(page.getByTestId("trimestre-modal")).toBeVisible();
    await expect(page.getByTestId("trimestre-modal")).toContainText("FORM 303 / 130");
    await page.getByTestId("trimestre-pay-btn").click();
    await expect(page.getByTestId("indicator-calendar")).toContainText("Year 1 · Month 4");

    if (isMobile) {
      await page.getByTestId("mobile-tab-cuentas").click();
    }
    const cuentasPanel = page.getByTestId("panel-cuentas");
    await expect(cuentasPanel).toBeVisible();
    await expect(cuentasPanel).toContainText("Consistent workout routine");
    await expect(cuentasPanel).not.toContainText("Rutina deportiva cumplida");
  });

  for (const compactVp of [
    { label: "real-windows-laptop-1366x650", width: 1366, height: 650 },
    { label: "dpi-150pct-1280x600", width: 1280, height: 600 },
  ] as const) {
    test(`QA-27 (${compactVp.label}): Real non-fullscreen laptop & 150% DPI zero-scroll active turn loop (including 4-choice 2x2 grid & WCAG opacity contrast)`, async ({
      page,
    }, testInfo) => {
      test.skip(
        testInfo.project.name !== "desktop-chromium",
        "Compact desktop height audit executes in desktop-chromium",
      );

      await page.setViewportSize({ width: compactVp.width, height: compactVp.height });
      await page.goto("./");
      await page.getByTestId("seed-input").fill("P35-M4-HITO-72");
      await page.getByTestId("start-run-btn").click();
      await expect(page.getByTestId("game-screen")).toBeVisible();

      const assertCompactDesktopFit = async (stepLabel: string) => {
        const scrollState = await page.evaluate(() => ({
          scrollY: window.scrollY,
          scrollHeight: document.documentElement.scrollHeight,
          innerHeight: window.innerHeight,
        }));
        expect(scrollState.scrollY, `Expected scrollY === 0 on ${stepLabel}`).toBe(0);
        expect(
          scrollState.scrollHeight,
          `UX Regression: ${stepLabel} overflows ${compactVp.label} (scrollHeight=${scrollState.scrollHeight} > ${scrollState.innerHeight + 2})`,
        ).toBeLessThanOrEqual(scrollState.innerHeight + 2);

        const headerBox = await page.locator("header").first().boundingBox();
        expect(headerBox).not.toBeNull();
        const bounds = {
          minTop: headerBox!.y + headerBox!.height,
          maxBottom: compactVp.height,
          viewportWidth: compactVp.width,
        };

        await assertVisibleInViewportWithoutScroll(
          page.getByTestId("month-economy-strip"),
          bounds,
          `${stepLabel} month-economy-strip`,
        );
        await assertVisibleInViewportWithoutScroll(
          page.getByTestId("event-title"),
          bounds,
          `${stepLabel} event-title`,
        );
        await assertVisibleInViewportWithoutScroll(
          page.getByTestId("event-body"),
          bounds,
          `${stepLabel} event-body`,
        );
        await assertReadableTextContrast(page.getByTestId("event-title"), `${stepLabel} title`);
        await assertReadableTextContrast(page.getByTestId("event-body"), `${stepLabel} body`);
        await assertReadableTextContrast(
          page.getByTestId("indicator-net-cash"),
          `${stepLabel} indicator-net-cash`,
        );

        const choiceBtns = page.locator('[data-testid^="choice-btn-"]');
        const count = await choiceBtns.count();
        expect(count).toBeGreaterThanOrEqual(2);
        for (let i = 0; i < count; i += 1) {
          await assertVisibleInViewportWithoutScroll(
            choiceBtns.nth(i),
            bounds,
            `${stepLabel} choice-btn-${i}`,
          );
          await assertCenterHitTargetUnoccluded(choiceBtns.nth(i), `${stepLabel} choice-btn-${i}`);
        }
      };

      await assertCompactDesktopFit(`${compactVp.label} M1`);

      // Click directly WITHOUT scrollIntoViewIfNeeded() and verify outcome fits 100% above the fold
      await page.locator('[data-choice-id="cambiar_de_tema_con_elegancia"]').click();
      await expect(page.getByTestId("outcome-panel")).toBeVisible();
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
      expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(
        compactVp.height + 2,
      );

      const headerBox = await page.locator("header").first().boundingBox();
      const bounds = {
        minTop: headerBox!.y + headerBox!.height,
        maxBottom: compactVp.height,
        viewportWidth: compactVp.width,
      };
      await assertVisibleInViewportWithoutScroll(
        page.getByTestId("outcome-continue-btn"),
        bounds,
        `${compactVp.label} outcome-continue-btn`,
      );
      await assertCenterHitTargetUnoccluded(
        page.getByTestId("outcome-continue-btn"),
        `${compactVp.label} outcome-continue-btn`,
      );
      await page.getByTestId("outcome-continue-btn").click();

      // Stage a 4-choice event (familia_encrucijada_agotamiento) with 1 locked choice to test 2x2 grid + locked contrast at 600px/650px!
      await page.evaluate(async () => {
        await new Promise<void>((resolvePromise, rejectPromise) => {
          const openReq = indexedDB.open("keyval-store");
          openReq.onerror = () => rejectPromise(openReq.error);
          openReq.onsuccess = () => {
            const db = openReq.result;
            const tx = db.transaction("keyval", "readwrite");
            const store = tx.objectStore("keyval");
            const getReq = store.get("autonomo:active_run");
            getReq.onerror = () => rejectPromise(getReq.error);
            getReq.onsuccess = () => {
              const envelope = getReq.result;
              envelope.state.month = 24;
              envelope.state.indicators.stress = 82;
              envelope.state.indicators.money = 400; // locks expensive sabbatical choice -> tests choice-lock-reason contrast!
              envelope.state.current_turn_events = ["familia_encrucijada_agotamiento"];
              store.put(envelope, "autonomo:active_run");
            };
            tx.oncomplete = () => {
              db.close();
              resolvePromise();
            };
            tx.onerror = () => rejectPromise(tx.error);
          };
        });
      });

      await page.reload();
      await page.getByTestId("continue-run-btn").click();
      await expect(page.getByTestId("event-card")).toHaveAttribute(
        "data-event-id",
        "familia_encrucijada_agotamiento",
      );
      await expect(page.locator('[data-testid^="choice-btn-"]')).toHaveCount(4);

      const fourChoiceScroll = await page.evaluate(() => ({
        scrollY: window.scrollY,
        scrollHeight: document.documentElement.scrollHeight,
        innerHeight: window.innerHeight,
      }));
      expect(fourChoiceScroll.scrollY).toBe(0);
      expect(
        fourChoiceScroll.scrollHeight,
        `Expected 4-choice 2x2 event card to fit ${compactVp.label} with zero vertical scroll`,
      ).toBeLessThanOrEqual(fourChoiceScroll.innerHeight + 2);

      const lockReasons = page.locator('[data-testid^="choice-lock-reason-"]');
      if ((await lockReasons.count()) > 0) {
        await assertReadableTextContrast(
          lockReasons.first(),
          `${compactVp.label} choice-lock-reason`,
        );
      }
    });
  }

  test("QA-28: Multi-resolution responsive ergonomics — 1024x768 2-col desktop workspace (>=500px), 360x640 compact phone & 667x375 phone landscape rail", async ({
    page,
  }) => {
    // 1. 1024x768: 2-column desktop workspace (event-card >= 500px, mobile bottom nav hidden, Right folder visible)
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto("./");
    await page.getByTestId("seed-input").fill("P35-BANNER-139");
    await page.getByTestId("start-run-btn").click();
    await expect(page.getByTestId("game-screen")).toBeVisible();

    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      1024,
    );
    await expect(page.getByTestId("mobile-tab-despacho")).toBeHidden();
    await expect(page.getByTestId("desktop-right-tab-entorno")).toBeVisible();
    await expect(page.getByTestId("desktop-right-tab-cuentas")).toBeVisible();
    await expect(page.getByTestId("desktop-right-tab-historial")).toBeVisible();
    const tabletCardBox = await page.getByTestId("event-card").boundingBox();
    expect(tabletCardBox).not.toBeNull();
    expect(
      tabletCardBox!.width,
      `Expected spacious event-card >= 500px at 1024x768 (got ${tabletCardBox!.width}px)`,
    ).toBeGreaterThanOrEqual(500);

    // 2. Compact phone 360x640 & Phone landscape 667x375 (58px left vertical rail)
    for (const phoneVp of [
      { label: "compact-phone-360x640", width: 360, height: 640 },
      { label: "phone-landscape-667x375", width: 667, height: 375 },
    ] as const) {
      await page.setViewportSize({ width: phoneVp.width, height: phoneVp.height });
      await page.evaluate(() => window.scrollTo(0, 0));

      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
        `Expected zero horizontal overflow on ${phoneVp.label}`,
      ).toBeLessThanOrEqual(phoneVp.width);

      const headerBox = await page.locator("header").first().boundingBox();
      const navBox = await page.locator('nav[aria-label="Secciones del despacho"]').boundingBox();
      expect(headerBox).not.toBeNull();
      expect(navBox).not.toBeNull();

      const titleBox = await page.getByTestId("event-title").boundingBox();
      expect(titleBox).not.toBeNull();
      expect(titleBox!.y).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height - 1);

      if (phoneVp.height <= 500) {
        // Phone landscape docks nav as a 58px left vertical rail instead of a bottom bar
        expect(
          headerBox!.height,
          "Expected ultra-compact HUD <= 96px on short phone landscape",
        ).toBeLessThanOrEqual(96);
        expect(navBox!.width).toBeLessThanOrEqual(62);
        expect(titleBox!.x).toBeGreaterThanOrEqual(navBox!.x + navBox!.width - 1);
        expect(titleBox!.y + titleBox!.height).toBeLessThanOrEqual(phoneVp.height);
      } else {
        expect(titleBox!.y + titleBox!.height).toBeLessThanOrEqual(navBox!.y + 1);
      }

      for (const tabId of [
        "mobile-tab-despacho",
        "mobile-tab-cuentas",
        "mobile-tab-entorno",
        "mobile-tab-historial",
      ] as const) {
        await assertCenterHitTargetUnoccluded(page.getByTestId(tabId), `${phoneVp.label} ${tabId}`);
      }
    }
  });

  test("QA-29: Modo Ágil 2.0 — stake hints, mandatory pause on multi-outcome Dices choice & auto-settled affordable Trimestre receipt", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto("./");
    await page.getByTestId("seed-input").fill("P35-AGIL-1");
    await page.getByTestId("start-run-btn").click();
    await expect(page.getByTestId("game-screen")).toBeVisible();

    // Verify Choice Stake Hints are rendered and legible on Month 1
    const stakes0 = page.getByTestId("choice-stakes-0");
    await expect(stakes0).toBeVisible();
    await assertReadableTextContrast(stakes0.locator("span").first(), "choice-stakes-0 chip");

    // Enable Modo Ágil 2.0
    const fastBtn = page.getByTestId("toggle-fast-pacing-btn");
    await fastBtn.click();
    await expect(fastBtn).toHaveAttribute("aria-pressed", "true");

    // 1. Clicking a multi-outcome Dices choice MUST pause on outcome-panel even in Modo Ágil 2.0!
    await page.locator('[data-choice-id="meter_dinero_por_probar"]').click();
    await expect(page.getByTestId("outcome-panel")).toBeVisible();
    await page.getByTestId("outcome-continue-btn").click();

    // 2. Restart P35-AGIL-1 via TitleScreen overwrite guard and play deterministic safe choices through Q1
    await page.getByTestId("return-title-btn").click();
    await page.getByTestId("seed-input").fill("P35-AGIL-1");
    await page.getByTestId("start-run-btn").click();
    await expect(page.getByTestId("confirm-overwrite-run-modal")).toBeVisible();
    await page.getByTestId("confirm-overwrite-run-btn").click();

    await expect(page.getByTestId("indicator-calendar")).toContainText("Año 1 · Mes 1");
    await page.locator('[data-choice-id="desmontar_su_plan_con_numeros"]').click();
    await expect(page.getByTestId("outcome-panel")).toHaveCount(0);
    await expect(page.getByTestId("indicator-calendar")).toContainText("Año 1 · Mes 2");

    await page.locator('[data-choice-id="seguir_autogestion"]').click();
    await expect(page.getByTestId("outcome-panel")).toHaveCount(0);
    await expect(page.getByTestId("indicator-calendar")).toContainText("Año 1 · Mes 3");

    // Resolving Month 3 with healthy buffer (money - totalDue >= 1,200 €) and zero inspection auto-settles Q1!
    await page.locator('[data-choice-id="separar_cuenta_impuestos"]').click();
    await expect(page.getByTestId("trimestre-modal")).toHaveCount(0);
    await expect(page.getByTestId("indicator-calendar")).toContainText("Año 1 · Mes 4");

    const receipt = page.getByTestId("auto-settled-quarter-receipt");
    await expect(receipt).toBeVisible();
    await expect(receipt).toContainText("Trimestre T1 liquidado");
    await assertReadableTextContrast(receipt, "auto-settled-quarter-receipt");
  });

  test("QA-30: TitleScreen overwrite guard, Endless honorable retirement ('Jubilarse con honores') & fatal outcome-panel reload persistence", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto("./");

    // 1. Start active run, verify TitleScreen <kbd> WCAG contrast, humanized flag pill, and overwrite guard
    await assertReadableTextContrast(
      page.getByTestId("start-run-btn").locator("kbd"),
      "start-run-btn kbd",
    );
    await page.getByTestId("seed-input").fill("P35-CASH-158");
    await page.getByTestId("start-run-btn").click();
    await expect(page.getByTestId("game-screen")).toBeVisible();

    await page.locator('[data-choice-id="empezar_relacion_alex"]').click();
    await expect(page.getByTestId("outcome-panel")).toContainText("Situación familiar:");

    await page.getByTestId("return-title-btn").click();
    await expect(page.getByTestId("continue-run-card")).toContainText("P35-CASH-158");

    await page.getByTestId("seed-input").fill("P35-BANNER-139");
    await page.getByTestId("start-run-btn").click();
    await expect(page.getByTestId("confirm-overwrite-run-modal")).toBeVisible();
    await assertReadableTextContrast(
      page.getByTestId("confirm-overwrite-run-btn").locator("kbd"),
      "confirm-overwrite-run-btn kbd",
    );

    await page.getByTestId("cancel-overwrite-run-btn").click();
    await expect(page.getByTestId("confirm-overwrite-run-modal")).toBeHidden();
    await expect(page.getByTestId("continue-run-card")).toContainText("P35-CASH-158");

    await page.getByTestId("start-run-btn").click();
    await page.getByTestId("confirm-overwrite-run-btn").click();
    await expect(page.getByTestId("game-screen")).toBeVisible();
    await expect(page.getByTestId("event-card")).toHaveAttribute(
      "data-event-id",
      "gestor_oferta_servicios",
    );

    // 2. Stage an Endless post-120m run in IndexedDB and verify Year 11 CuentasPanel tapered living-cost creep + honorable retirement
    await page.evaluate(async () => {
      await new Promise<void>((resolvePromise, rejectPromise) => {
        const openReq = indexedDB.open("keyval-store");
        openReq.onerror = () => rejectPromise(openReq.error);
        openReq.onsuccess = () => {
          const db = openReq.result;
          const tx = db.transaction("keyval", "readwrite");
          const store = tx.objectStore("keyval");
          const getReq = store.get("autonomo:active_run");
          getReq.onerror = () => rejectPromise(getReq.error);
          getReq.onsuccess = () => {
            const envelope = getReq.result;
            envelope.state.month = 128;
            envelope.state.endless_mode = true;
            envelope.state.earned_victories = ["hero_120m"];
            envelope.state.indicators.money = 158000;
            store.put(envelope, "autonomo:active_run");
          };
          tx.oncomplete = () => {
            db.close();
            resolvePromise();
          };
          tx.onerror = () => rejectPromise(tx.error);
        };
      });
    });

    await page.reload();
    await page.getByTestId("continue-run-btn").click();
    // Month 128 (Year 11, tapered 0.5x post-M120): effectiveLivingCost = 1,405 + 9.5 * 64 = 2,013 €/mo
    await expect(page.getByTestId("panel-cuentas")).toContainText(/2\.?013\s*€/);

    await page.getByTestId("abandon-run-btn").click();
    await expect(page.getByTestId("abandon-modal")).toBeVisible();
    await expect(page.getByTestId("abandon-oposiciones-btn")).toHaveCount(0);

    const retireBtn = page.getByTestId("retire-honorable-confirm-btn");
    await expect(retireBtn).toBeVisible();
    await assertCenterHitTargetUnoccluded(retireBtn, "retire-honorable-confirm-btn");
    await retireBtn.click();

    await expect(page.getByTestId("end-run-screen")).toBeVisible();
    await assertReadableTextContrast(
      page.getByTestId("end-new-run-btn").locator("kbd"),
      "end-new-run-btn kbd",
    );
    await expect(page.getByTestId("end-run-victory-badges")).toBeVisible();
    await expect(page.getByTestId("end-run-duration")).toContainText("10 años y 8 meses");

    // 3. Fatal outcome-panel reload persistence: trigger fatal stress choice, reload BEFORE clicking outcome-continue-btn
    await page.getByTestId("end-new-run-btn").click();
    await expect(page.getByTestId("game-screen")).toBeVisible();

    await page.evaluate(async () => {
      await new Promise<void>((resolvePromise, rejectPromise) => {
        const openReq = indexedDB.open("keyval-store");
        openReq.onerror = () => rejectPromise(openReq.error);
        openReq.onsuccess = () => {
          const db = openReq.result;
          const tx = db.transaction("keyval", "readwrite");
          const store = tx.objectStore("keyval");
          const getReq = store.get("autonomo:active_run");
          getReq.onerror = () => rejectPromise(getReq.error);
          getReq.onsuccess = () => {
            const envelope = getReq.result;
            envelope.state.indicators.stress = 98;
            envelope.state.current_turn_events = ["clientes_encargo_urgente"];
            store.put(envelope, "autonomo:active_run");
          };
          tx.oncomplete = () => {
            db.close();
            resolvePromise();
          };
          tx.onerror = () => rejectPromise(tx.error);
        };
      });
    });

    await page.reload();
    await page.getByTestId("continue-run-btn").click();
    await page.locator('[data-choice-id="entrega_express_contado"]').click();

    // Fatal outcome-panel opens first; reload BEFORE clicking outcome-continue-btn!
    await expect(page.getByTestId("outcome-panel")).toBeVisible();
    await expect(page.getByTestId("outcome-continue-btn")).toContainText("Ver certificado final");
    await page.waitForTimeout(120);
    await page.reload();

    // Resuming after reload restores the exact pending fatal outcome-panel first, then opens EndRunScreen on acknowledge
    await expect(page.getByTestId("continue-run-card")).toContainText("Año 1 · Mes 1");
    await page.getByTestId("continue-run-btn").click();
    await expect(page.getByTestId("outcome-panel")).toBeVisible();
    await expect(page.getByTestId("outcome-continue-btn")).toContainText("Ver certificado final");
    await page.getByTestId("outcome-continue-btn").click();

    await expect(page.getByTestId("end-run-screen")).toBeVisible();
    await expect(page.getByTestId("end-run-illustration")).toHaveAttribute(
      "data-asset-id",
      "illus_final_ansiedad",
    );
    await page.getByTestId("end-return-title-btn").click();
    await expect(page.getByTestId("continue-run-card")).toHaveCount(0);
    await expect(page.getByTestId("hall-of-fame-list").locator("li")).toHaveCount(2);
  });

  test("QA-31: Phase 3.6 Desktop Zero-Scroll & Symmetric Baselines across 1024x768, 1152x720, 1280x720, 1366x768, 1440x900 & 1920x1080", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "Desktop spatial reorganization matrix executes in desktop-chromium",
    );

    const desktopMatrix = [
      { label: "1024x768", width: 1024, height: 768 },
      { label: "1152x720", width: 1152, height: 720 },
      { label: "1280x720", width: 1280, height: 720 },
      { label: "1366x768", width: 1366, height: 768 },
      { label: "1440x900", width: 1440, height: 900 },
      { label: "1920x1080", width: 1920, height: 1080 },
    ] as const;

    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto("./");
    await expect(page.getByTestId("title-screen")).toBeVisible();

    // 1. Fresh (0-run) TitleScreen zero-scroll check across all 6 desktop viewports
    for (const vp of desktopMatrix) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const metrics = await page.evaluate(() => ({
        scrollY: window.scrollY,
        scrollHeight: document.documentElement.scrollHeight,
        innerHeight: window.innerHeight,
      }));
      expect(metrics.scrollY).toBe(0);
      expect(
        metrics.scrollHeight,
        `Fresh TitleScreen overflow on ${vp.label} (${metrics.scrollHeight} > ${metrics.innerHeight + 2})`,
      ).toBeLessThanOrEqual(metrics.innerHeight + 2);
      await assertVisibleInViewportWithoutScroll(
        page.getByTestId("start-run-btn"),
        { minTop: 0, maxBottom: vp.height, viewportWidth: vp.width },
        `Fresh TitleScreen start-run-btn (${vp.label})`,
      );
    }

    // Create 1 archived Hall of Fame run + 1 active run so Veteran TitleScreen mounts both cards + archive entries
    await page.getByTestId("seed-input").fill("P36-ARCHIVE-1");
    await page.getByTestId("start-run-btn").click();
    await expect(page.getByTestId("game-screen")).toBeVisible();
    await page.getByTestId("abandon-run-btn").click();
    await page.getByTestId("abandon-oposiciones-btn").click();
    await expect(page.getByTestId("end-run-screen")).toBeVisible();
    await page.getByTestId("end-return-title-btn").click();
    await expect(page.getByTestId("title-screen")).toBeVisible();

    await page.getByTestId("seed-input").fill("P35-BANNER-139");
    await page.getByTestId("start-run-btn").click();
    await expect(page.getByTestId("game-screen")).toBeVisible();
    await page.getByTestId("return-title-btn").click();
    await expect(page.getByTestId("continue-run-card")).toBeVisible();

    // 2. Veteran TitleScreen zero-scroll check across all 6 desktop viewports
    for (const vp of desktopMatrix) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const metrics = await page.evaluate(() => ({
        scrollY: window.scrollY,
        scrollHeight: document.documentElement.scrollHeight,
        innerHeight: window.innerHeight,
      }));
      expect(metrics.scrollY).toBe(0);
      expect(
        metrics.scrollHeight,
        `Veteran TitleScreen overflow on ${vp.label} (${metrics.scrollHeight} > ${metrics.innerHeight + 2})`,
      ).toBeLessThanOrEqual(metrics.innerHeight + 2);
      const bounds = { minTop: 0, maxBottom: vp.height, viewportWidth: vp.width };
      await assertVisibleInViewportWithoutScroll(
        page.getByTestId("continue-run-btn"),
        bounds,
        `Veteran TitleScreen continue-run-btn (${vp.label})`,
      );
      await assertVisibleInViewportWithoutScroll(
        page.getByTestId("start-run-btn"),
        bounds,
        `Veteran TitleScreen start-run-btn (${vp.label})`,
      );
    }

    // 3. GameScreen symmetric column top/bottom baselines + 0px Event->Outcome jump + Diario visibility
    await page.getByTestId("continue-run-btn").click();
    await expect(page.getByTestId("game-screen")).toBeVisible();

    for (const vp of desktopMatrix) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await expect(page.getByTestId("mobile-tab-despacho")).toBeHidden();

      if (vp.width < 1120) {
        await expect(page.getByTestId("desktop-right-tab-entorno")).toBeVisible();
      } else if (vp.height < 740) {
        await expect(page.getByTestId("scene-renderer")).toBeVisible();
        await expect(page.getByTestId("desktop-right-tab-historial")).toBeVisible();
      } else {
        await expect(page.getByTestId("scene-renderer")).toBeVisible();
        await expect(page.getByTestId("panel-historial")).toBeVisible();
      }

      const scrollState = await page.evaluate(() => ({
        scrollY: window.scrollY,
        scrollHeight: document.documentElement.scrollHeight,
        innerHeight: window.innerHeight,
      }));
      expect(scrollState.scrollY).toBe(0);
      expect(
        scrollState.scrollHeight,
        `GameScreen overflow on ${vp.label} (${scrollState.scrollHeight} > ${scrollState.innerHeight + 2})`,
      ).toBeLessThanOrEqual(scrollState.innerHeight + 2);

      if (vp.width < 1120) {
        // 1024x768: 2-column symmetric desk (Center Stage + 3-tab Right folder)
        await expect
          .poll(
            async () => {
              const cBox = await page.getByTestId("event-card").boundingBox();
              const rBox = await page
                .locator(".game-desk-grid > aside > .paper-dossier")
                .first()
                .boundingBox();
              if (!cBox || !rBox) return 999;
              return Math.max(
                Math.abs(cBox.y - rBox.y),
                Math.abs(cBox.y + cBox.height - (rBox.y + rBox.height)),
              );
            },
            { message: `Expected <= 2px column top/bottom delta on ${vp.label}` },
          )
          .toBeLessThanOrEqual(2);
        await page.getByTestId("desktop-right-tab-historial").click();
        await expect(page.getByTestId("panel-historial")).toBeVisible();
        await page.getByTestId("desktop-right-tab-cuentas").click();
      } else if (vp.height < 740) {
        // 1152x720 & 1280x720: 3-column symmetric desk with 2-tab Right folder
        await expect
          .poll(
            async () => {
              const leftTopBox = await page.getByTestId("scene-renderer").boundingBox();
              const leftBotBox = await page.getByTestId("panel-entorno").boundingBox();
              const cBox = await page.getByTestId("event-card").boundingBox();
              const rightBox = await page
                .locator(".game-desk-grid > aside")
                .nth(1)
                .locator(".paper-dossier")
                .first()
                .boundingBox();
              if (!leftTopBox || !leftBotBox || !cBox || !rightBox) return 999;
              const tops = [leftTopBox.y, cBox.y, rightBox.y];
              const bots = [
                leftBotBox.y + leftBotBox.height,
                cBox.y + cBox.height,
                rightBox.y + rightBox.height,
              ];
              return Math.max(
                Math.max(...tops) - Math.min(...tops),
                Math.max(...bots) - Math.min(...bots),
              );
            },
            { message: `Expected <= 2px column top/bottom delta on ${vp.label}` },
          )
          .toBeLessThanOrEqual(2);

        await page.getByTestId("desktop-right-tab-historial").click();
        await expect(page.getByTestId("panel-historial")).toBeVisible();
        await page.getByTestId("desktop-right-tab-cuentas").click();
      } else {
        // 1366x768, 1440x900 & 1920x1080: 3-column symmetric desk with stacked Cuentas + Diario
        await expect(page.getByTestId("panel-historial")).toContainText("Diario de Expediente");

        await expect
          .poll(
            async () => {
              const leftTopBox = await page.getByTestId("scene-renderer").boundingBox();
              const leftBotBox = await page.getByTestId("panel-entorno").boundingBox();
              const cBox = await page.getByTestId("event-card").boundingBox();
              const rightTopBox = await page.getByTestId("panel-cuentas").boundingBox();
              const rightBotBox = await page.getByTestId("panel-historial").boundingBox();
              if (!leftTopBox || !leftBotBox || !cBox || !rightTopBox || !rightBotBox) return 999;
              const tops = [leftTopBox.y, cBox.y, rightTopBox.y];
              const bots = [
                leftBotBox.y + leftBotBox.height,
                cBox.y + cBox.height,
                rightBotBox.y + rightBotBox.height,
              ];
              return Math.max(
                Math.max(...tops) - Math.min(...tops),
                Math.max(...bots) - Math.min(...bots),
              );
            },
            { message: `Expected <= 2px column top/bottom delta on ${vp.label}` },
          )
          .toBeLessThanOrEqual(2);

        if (vp.width === 1920) {
          // Verify single-row Command Band 1 (Calendar, Treasury, Toolbar never wrap) & compact HUD height
          const hudMetrics = await page.evaluate(() => {
            const header = document.querySelector("header")!;
            const band1 = header.querySelector(".hud-shell-inner > div:first-of-type")!;
            const cal = header.querySelector('[data-testid="indicator-calendar"]')!;
            const treasury = header.querySelector(".hud-treasury-strip")!;
            const abandon = header.querySelector('[data-testid="abandon-run-btn"]')!;
            const cy = (el: Element) => {
              const r = el.getBoundingClientRect();
              return r.top + r.height / 2;
            };
            const ys = [cy(cal), cy(treasury), cy(abandon)];
            return {
              headerHeight: header.getBoundingClientRect().height,
              band1Height: band1.getBoundingClientRect().height,
              rowCenterDelta: Math.max(...ys) - Math.min(...ys),
            };
          });
          expect(hudMetrics.band1Height).toBeLessThanOrEqual(40);
          expect(hudMetrics.rowCenterDelta).toBeLessThanOrEqual(4);
          expect(hudMetrics.headerHeight).toBeLessThanOrEqual(90);
        }
      }

      // DEF-P36-01 & DEF-P36-02 Guards across all 6 desktop viewports
      await assertEconomyStripRowNonOverlap(page, `Desktop ES ${vp.label}`);
      await assertDesktopPolaroidContained(page, `Desktop ES ${vp.label}`);
    }

    // Verify <= 2px Center card top-edge jump from event-card -> outcome-panel on 1366x768
    await page.setViewportSize({ width: 1366, height: 768 });
    await expect(page.getByTestId("panel-historial")).toBeVisible();
    await page.evaluate(async () => {
      await Promise.all(
        document.getAnimations().map((anim) => anim.finished.catch(() => undefined)),
      );
    });
    const preEventBox = await page.getByTestId("event-card").boundingBox();
    expect(preEventBox).not.toBeNull();
    await page.locator('[data-choice-id="contratar_paco_barato"]').click();
    await expect(page.getByTestId("outcome-panel")).toBeVisible();
    await expect
      .poll(
        async () => {
          const postOutcomeBox = await page.getByTestId("outcome-panel").boundingBox();
          if (!postOutcomeBox) return 999;
          return Math.max(
            Math.abs(postOutcomeBox.y - preEventBox!.y),
            Math.abs(
              postOutcomeBox.y + postOutcomeBox.height - (preEventBox!.y + preEventBox!.height),
            ),
          );
        },
        { message: "Expected <= 2px Event->Outcome top/bottom jump on 1366x768" },
      )
      .toBeLessThanOrEqual(2);

    // Explicit DEF-P36-01 & DEF-P36-02 regression check on Borja «El de la Visibilidad» (ES & EN) across tight desktop widths
    await page.getByTestId("return-title-btn").click();
    await expect(page.getByTestId("title-screen")).toBeVisible();
    await page.getByTestId("seed-input").fill("P35-EN-LOCALE-134");
    await page.getByTestId("start-run-btn").click();
    await page.getByTestId("confirm-overwrite-run-btn").click();
    await expect(page.getByTestId("game-screen")).toBeVisible();
    await expect(page.getByTestId("event-character-polaroid")).toBeVisible();

    for (const tightVp of [
      { label: "1024x768", width: 1024, height: 768 },
      { label: "1152x720", width: 1152, height: 720 },
      { label: "1280x720", width: 1280, height: 720 },
    ] as const) {
      await page.setViewportSize({ width: tightVp.width, height: tightVp.height });
      await page.evaluate(async () => {
        await Promise.all(
          document.getAnimations().map((anim) => anim.finished.catch(() => undefined)),
        );
      });
      await assertEconomyStripRowNonOverlap(page, `Borja ES ${tightVp.label}`);
      await assertDesktopPolaroidContained(page, `Borja ES ${tightVp.label}`);
    }

    await page.getByTestId("locale-toggle-btn").click();
    for (const tightVp of [
      { label: "1024x768", width: 1024, height: 768 },
      { label: "1152x720", width: 1152, height: 720 },
      { label: "1280x720", width: 1280, height: 720 },
    ] as const) {
      await page.setViewportSize({ width: tightVp.width, height: tightVp.height });
      await page.evaluate(async () => {
        await Promise.all(
          document.getAnimations().map((anim) => anim.finished.catch(() => undefined)),
        );
      });
      await assertEconomyStripRowNonOverlap(page, `Borja EN ${tightVp.label}`);
      await assertDesktopPolaroidContained(page, `Borja EN ${tightVp.label}`);
    }
    await page.getByTestId("locale-toggle-btn").click();
  });

  test("QA-32: Phase 3.6 Mobile & Landscape Zero-Scroll Despacho Loop + Entorno Diorama Showcase (375x667, 360x780, 390x844, 412x915, 667x375)", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "mobile-chromium",
      "Mobile & landscape zero-scroll turn loop executes in mobile-chromium",
    );

    const mobileMatrix = [
      { label: "375x667", width: 375, height: 667 },
      { label: "360x780", width: 360, height: 780 },
      { label: "390x844", width: 390, height: 844 },
      { label: "412x915", width: 412, height: 915 },
      { label: "667x375", width: 667, height: 375 },
    ] as const;

    for (const vp of mobileMatrix) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("./");

      // Start fresh seeded run (handle overwrite modal if active run exists from previous iteration)
      await page.getByTestId("seed-input").fill("P35-EN-LOCALE-134");
      await page.getByTestId("start-run-btn").click();
      if (await page.getByTestId("confirm-overwrite-run-modal").isVisible()) {
        await page.getByTestId("confirm-overwrite-run-btn").click();
      }
      await expect(page.getByTestId("game-screen")).toBeVisible();
      await page.evaluate(async () => {
        await Promise.all(
          document.getAnimations().map((anim) => anim.finished.catch(() => undefined)),
        );
      });
      expect(await page.evaluate(() => window.scrollY)).toBe(0);

      // 1. On Despacho, scene-bg MUST be hidden, and month-economy-strip MUST NOT overlap
      await expect(page.getByTestId("scene-bg")).toBeHidden();
      await assertEconomyStripRowNonOverlap(page, `Mobile/Landscape Despacho ${vp.label}`);

      const headerBox = await page.locator("header").first().boundingBox();
      const navBox = await page.locator("nav.mobile-desk-nav").boundingBox();
      expect(headerBox).not.toBeNull();
      expect(navBox).not.toBeNull();

      const isLandscapeRail = vp.height <= 500;
      const stageBounds = {
        minTop: headerBox!.y + headerBox!.height,
        maxBottom: isLandscapeRail ? vp.height : navBox!.y,
        viewportWidth: vp.width,
      };

      // 2. At scrollY === 0, all choice-btn-* sit strictly inside visible stage (above bottom nav or inside landscape rail viewport)
      const choices = page.locator('[data-testid^="choice-btn-"]');
      const choiceCount = await choices.count();
      expect(choiceCount).toBeGreaterThanOrEqual(2);
      for (let i = 0; i < choiceCount; i += 1) {
        const box = await assertVisibleInViewportWithoutScroll(
          choices.nth(i),
          stageBounds,
          `Despacho choice-btn-${i} (${vp.label})`,
        );
        if (isLandscapeRail) {
          expect(box.x).toBeGreaterThanOrEqual(navBox!.x + navBox!.width - 1);
        }
      }

      // 3. Click choice directly WITHOUT scrolling -> outcome-continue-btn also sits strictly above fold at scrollY === 0
      await page.locator('[data-choice-id="entrega_express_contado"]').click();
      await expect(page.getByTestId("outcome-panel")).toBeVisible();
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
      await assertVisibleInViewportWithoutScroll(
        page.getByTestId("outcome-continue-btn"),
        stageBounds,
        `Despacho outcome-continue-btn (${vp.label})`,
      );

      // 4. Switching to Entorno reveals live scene-bg showcase (>= 140px on standard portrait phones, >= 115px on compact <=690px height, >= 105px on landscape)
      await page.getByTestId("mobile-tab-entorno").click();
      const sceneBg = page.getByTestId("scene-bg");
      await expect(sceneBg).toBeVisible();
      const bgBox = await sceneBg.boundingBox();
      expect(bgBox).not.toBeNull();
      const minShowcaseHeight = isLandscapeRail ? 105 : vp.height <= 690 ? 115 : 140;
      expect(
        bgBox!.height,
        `Expected Entorno scene-bg height >= ${minShowcaseHeight}px on ${vp.label} (got ${bgBox!.height}px)`,
      ).toBeGreaterThanOrEqual(minShowcaseHeight);
      await page.getByTestId("mobile-tab-despacho").click();
      await page.getByTestId("outcome-continue-btn").click();
    }
  });

  test("QA-33: HUD Delta Non-Overlap, EndRunScreen Above-the-Fold CTAs + Toast Non-Occlusion & Repeat-Key Guard (H2-02, H2-03, H2-06)", async ({
    page,
  }, testInfo) => {
    const isMobile = testInfo.project.name === "mobile-chromium";
    const targetViewports = isMobile
      ? ([
          { label: "360x780", width: 360, height: 780 },
          { label: "390x844", width: 390, height: 844 },
        ] as const)
      : ([
          { label: "1366x768", width: 1366, height: 768 },
          { label: "1440x900", width: 1440, height: 900 },
        ] as const);

    // 1. H2-06 Repeat-Key Guard: synthetic keydown with repeat: true MUST NOT trigger choice or advance outcome
    await page.setViewportSize(targetViewports[0]);
    await page.goto("./");
    await page.getByTestId("seed-input").fill("P35-CASH-158");
    await page.getByTestId("start-run-btn").click();
    await expect(page.getByTestId("game-screen")).toBeVisible();

    await page.getByTestId("choice-btn-0").focus();
    await page.evaluate(() => {
      const active = document.activeElement ?? window;
      active.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          code: "Enter",
          repeat: true,
          bubbles: true,
          cancelable: true,
        }),
      );
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "1",
          code: "Digit1",
          repeat: true,
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    await expect(page.getByTestId("event-card")).toBeVisible();
    await expect(page.getByTestId("outcome-panel")).toHaveCount(0);

    // Trigger choice that mutates money, stress, moral & personal_life
    await page.locator('[data-choice-id="escapada_desconexion_total"]').click();
    await expect(page.getByTestId("outcome-panel")).toBeVisible();

    // Repeat Enter on outcome-panel MUST NOT advance month
    await page.getByTestId("outcome-continue-btn").focus();
    await page.evaluate(() => {
      const active = document.activeElement ?? window;
      active.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          code: "Enter",
          repeat: true,
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    await expect(page.getByTestId("outcome-panel")).toBeVisible();
    await expect(page.getByTestId("indicator-calendar")).toContainText("Año 1 · Mes 1");

    // 2. H2-03 Mobile HUD Delta Non-Overlap (360x780 & 390x844): 0px intersection between *-delta pills and sibling *-value
    if (isMobile) {
      for (const vp of targetViewports) {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        const overlaps = await page.evaluate(() => {
          const pairs = [
            ["indicator-money-value", "indicator-money-delta"],
            ["indicator-moral-value", "indicator-moral-delta"],
            ["indicator-stress-value", "indicator-stress-delta"],
            ["indicator-personal-life-value", "indicator-personal-life-delta"],
            ["indicator-reputation-value", "indicator-reputation-delta"],
          ] as const;
          const issues: string[] = [];
          let checkedCount = 0;
          for (const [valId, deltaId] of pairs) {
            const valEl = document.querySelector(`[data-testid="${valId}"]`);
            const deltaEl = document.querySelector(`[data-testid="${deltaId}"]`);
            if (!valEl || !deltaEl) continue;
            const vr = valEl.getBoundingClientRect();
            const dr = deltaEl.getBoundingClientRect();
            if (dr.width === 0 || dr.height === 0) continue;
            checkedCount += 1;
            const ix = Math.max(0, Math.min(vr.right, dr.right) - Math.max(vr.left, dr.left));
            const iy = Math.max(0, Math.min(vr.bottom, dr.bottom) - Math.max(vr.top, dr.top));
            if (ix > 0.25 && iy > 0.25) {
              issues.push(`${deltaId} overlaps ${valId} by ${ix.toFixed(1)}x${iy.toFixed(1)}px`);
            }
          }
          return { checkedCount, issues };
        });
        expect(overlaps.checkedCount).toBeGreaterThanOrEqual(4);
        expect(overlaps.issues, `HUD delta overlap on ${vp.label}`).toEqual([]);
      }
    }

    // 3. H2-02 EndRunScreen Above-the-Fold Primary CTAs + Zero AchievementToast Occlusion
    for (const vp of targetViewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("./");
      // Clear unlocked achievements so hiring Paco freshly triggers AchievementToast right before ending
      await page.evaluate(async () => {
        await new Promise<void>((resolvePromise, rejectPromise) => {
          const openReq = indexedDB.open("keyval-store");
          openReq.onerror = () => rejectPromise(openReq.error);
          openReq.onsuccess = () => {
            const db = openReq.result;
            const tx = db.transaction("keyval", "readwrite");
            const store = tx.objectStore("keyval");
            const getReq = store.get("autonomo:profile");
            getReq.onerror = () => rejectPromise(getReq.error);
            getReq.onsuccess = () => {
              const env = getReq.result;
              if (env && typeof env === "object") {
                env.achievements = {};
                store.put(env, "autonomo:profile");
              }
              store.delete("autonomo:active_run");
            };
            tx.oncomplete = () => {
              db.close();
              resolvePromise();
            };
            tx.onerror = () => rejectPromise(tx.error);
          };
        });
      });
      await page.reload();

      await page.getByTestId("seed-input").fill("P35-BANNER-139");
      await page.getByTestId("start-run-btn").click();
      if (await page.getByTestId("confirm-overwrite-run-modal").isVisible()) {
        await page.getByTestId("confirm-overwrite-run-btn").click();
      }
      await expect(page.getByTestId("game-screen")).toBeVisible();

      // Unlock gestor_contratado toast, then immediately abandon to EndRunScreen while toast is active
      await page.locator('[data-choice-id="contratar_paco_barato"]').click();
      await expect(page.getByTestId("achievement-toast")).toBeVisible();

      if (vp.width < 768) {
        await page.getByTestId("mobile-utility-menu-btn").click();
        await expect(page.getByTestId("mobile-utility-sheet")).toBeVisible();
      }
      await page.getByTestId("abandon-run-btn").click();
      await expect(page.getByTestId("abandon-modal")).toBeVisible();
      // While modal is open, AchievementToast must defer rendering (0% modal overlap)
      await expect(page.getByTestId("achievement-toast")).toBeHidden();
      await page.getByTestId("abandon-oposiciones-btn").click();

      await expect(page.getByTestId("end-run-screen")).toBeVisible();
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
      await expect(page.getByTestId("achievement-toast")).toBeVisible();

      const fullBounds = { minTop: 0, maxBottom: vp.height, viewportWidth: vp.width };
      await assertVisibleInViewportWithoutScroll(
        page.getByTestId("end-new-run-btn"),
        fullBounds,
        `EndRunScreen end-new-run-btn (${vp.label})`,
      );
      await assertVisibleInViewportWithoutScroll(
        page.getByTestId("end-return-title-btn"),
        fullBounds,
        `EndRunScreen end-return-title-btn (${vp.label})`,
      );
      await assertCenterHitTargetUnoccluded(
        page.getByTestId("end-new-run-btn"),
        `EndRunScreen end-new-run-btn with toast (${vp.label})`,
      );
      await assertCenterHitTargetUnoccluded(
        page.getByTestId("end-return-title-btn"),
        `EndRunScreen end-return-title-btn with toast (${vp.label})`,
      );
    }
  });
});
