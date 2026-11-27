import { afterEach, describe, expect, it } from "vitest";
import { type GameState, startNewRun } from "../../src/engine/index.ts";
import { compiledCatalog } from "../../src/services/content/catalog.ts";
import {
  clearLocaleOverlays,
  explainChoiceLockReasons,
  formatCalendarBadgeEs,
  formatDurationMonthsEs,
  formatEuros,
  registerLocaleOverlay,
  resolveEventText,
} from "../../src/services/i18n/resolveEventText.ts";
import {
  CANONICAL_GAME_URL,
  ENDING_METADATA,
  buildShareText,
  createShareSummaryFromState,
  loadAndRenderShareCard,
  renderShareCardToCanvas,
  resolveShareUrl,
} from "../../src/services/share/shareResult.ts";

interface RecordedCanvasHarness {
  fakeCanvas: HTMLCanvasElement;
  drawnText: Array<{
    text: string;
    x: number;
    y: number;
    maxWidth: number | undefined;
    font: string;
    inSavedTransform: boolean;
  }>;
  drawnImages: Array<{
    args: unknown[];
  }>;
}

function createRecordedCanvasHarness(): RecordedCanvasHarness {
  const drawnText: RecordedCanvasHarness["drawnText"] = [];
  const drawnImages: RecordedCanvasHarness["drawnImages"] = [];
  let currentFont = "400 16px sans-serif";
  let saveDepth = 0;

  const mockCtx = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    textAlign: "left",
    get font() {
      return currentFont;
    },
    set font(value: string) {
      currentFont = value;
    },
    fillRect: () => {},
    strokeRect: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    save: () => {
      saveDepth += 1;
    },
    restore: () => {
      saveDepth = Math.max(0, saveDepth - 1);
    },
    translate: () => {},
    rotate: () => {},
    drawImage: (...args: unknown[]) => {
      drawnImages.push({ args });
    },
    measureText: (str: string) => {
      const pxMatch = /(\d+)px/.exec(currentFont);
      const fontSize = pxMatch ? Number(pxMatch[1]) : 20;
      return { width: str.length * fontSize * 0.56 };
    },
    fillText: (str: string, x: number, y: number, maxWidth?: number) => {
      drawnText.push({
        text: str,
        x,
        y,
        maxWidth,
        font: currentFont,
        inSavedTransform: saveDepth > 0,
      });
    },
  };

  const fakeCanvas = {
    width: 0,
    height: 0,
    getContext: () => mockCtx,
  } as unknown as HTMLCanvasElement;

  return { fakeCanvas, drawnText, drawnImages };
}

describe("Share Summary & i18n Helpers", () => {
  afterEach(() => {
    clearLocaleOverlays();
  });

  it("preserves earned VictoryBadges on share text even after an Endless defeat", () => {
    const { state } = startNewRun(compiledCatalog, { seed: "SHARE-SEED-99" });
    const endlessDefeat: GameState = {
      ...state,
      month: 134,
      endless_mode: true,
      earned_victories: ["hero_120m", "rich_250k"],
      indicators: { ...state.indicators, money: -5200, stress: 100 },
      finances: { ...state.finances, lifetime_billed: 312_450 },
      ending: {
        id: "defeat_burnout_stress",
        month: 134,
        summary_quote: "El médico te quitó el portátil.",
      },
    };

    const summary = createShareSummaryFromState(endlessDefeat, "https://autonomo.example/juego");
    const text = buildShareText(summary);

    expect(text).toContain("MODELO 036-FIN");
    expect(text).toContain("Baja por Ansiedad Aguda");
    expect(text).toContain("11 años y 2 meses (134 meses)");
    expect(text).toContain("-5.200 €");
    expect(text).toContain("312.450 €");
    expect(text).toContain("¡Eres un héroe! (120 meses)");
    expect(text).toContain("Ricachón (250.000 €)");
    expect(text).toContain("SHARE-SEED-99");
    expect(text).toContain("https://autonomo.example/juego");
  });

  it("resolves canonical production domain by default, on localhost, on legacy vercel.app host, and in non-browser contexts", () => {
    expect(CANONICAL_GAME_URL).toBe("https://autonomo-simulator.com/");
    expect(resolveShareUrl()).toBe("https://autonomo-simulator.com/");
    expect(resolveShareUrl("  https://autonomo.example/custom  ")).toBe(
      "https://autonomo.example/custom",
    );

    const originalWindow = globalThis.window;
    try {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: {
          location: {
            href: "http://localhost:4173/",
            protocol: "http:",
            hostname: "localhost",
            origin: "http://localhost:4173",
            pathname: "/",
          },
        },
      });
      expect(resolveShareUrl()).toBe("https://autonomo-simulator.com/");

      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: {
          location: {
            href: "https://autonomo-simulator.vercel.app/",
            protocol: "https:",
            hostname: "autonomo-simulator.vercel.app",
            origin: "https://autonomo-simulator.vercel.app",
            pathname: "/",
          },
        },
      });
      expect(resolveShareUrl()).toBe("https://autonomo-simulator.com/");

      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: {
          location: {
            href: "https://autonomo-simulator.com/",
            protocol: "https:",
            hostname: "autonomo-simulator.com",
            origin: "https://autonomo-simulator.com",
            pathname: "/",
          },
        },
      });
      expect(resolveShareUrl()).toBe("https://autonomo-simulator.com/");
    } finally {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: originalWindow,
      });
    }
  });

  it("formats Spanish numbers, durations, calendar trimestres, and choice lock reasons", () => {
    expect(formatEuros(3500)).toBe("3.500 €");
    expect(formatEuros(-1250)).toBe("-1.250 €");
    expect(formatDurationMonthsEs(3)).toBe("3 meses");
    expect(formatDurationMonthsEs(12)).toBe("1 año (12 meses)");
    expect(formatDurationMonthsEs(25)).toBe("2 años y 1 mes (25 meses)");

    const calM1 = formatCalendarBadgeEs(1);
    expect(calM1.label).toBe("Año 1 · Mes 1");
    expect(calM1.trimestreLabel).toBe("Trimestre en 2 meses");

    const calM3 = formatCalendarBadgeEs(3);
    expect(calM3.trimestreLabel).toBe("Cierre T1 este mes");

    const { state } = startNewRun(compiledCatalog, { seed: "LOCK-CHECK" });
    const reasons = explainChoiceLockReasons(state, {
      gestor_tiers: ["cheap", "premium"],
      stats: { money: { min: 10_000 } },
    });
    expect(reasons).toContain("Requiere Dinero mín. 10.000 €");
    expect(reasons).toContain("Requiere gestoría: Gestor económico o Asesoría premium");
  });

  it("resolves inline Spanish fallback and overlays registered locale strings", () => {
    expect(resolveEventText("es-ES", "evt_1", "title", "Título original")).toBe("Título original");

    registerLocaleOverlay("en", {
      "evt_1.title": "Translated Title",
    });
    expect(resolveEventText("en", "evt_1", "title", "Título original")).toBe("Translated Title");
    expect(resolveEventText("en", "evt_1", "body", "Cuerpo original")).toBe("Cuerpo original");
  });

  it("renders synchronous fallback share canvas for all 8 endings with explicit maxWidth guards and stamp clearance", () => {
    const { state } = startNewRun(compiledCatalog, {
      seed: "SEMILLA-MUY-LARGA-PARA-COMPROBAR-LIMITES-2026",
    });

    for (const endingId of Object.keys(ENDING_METADATA) as Array<keyof typeof ENDING_METADATA>) {
      const { fakeCanvas, drawnText, drawnImages } = createRecordedCanvasHarness();

      const summary = createShareSummaryFromState(
        {
          ...state,
          endless_mode: true,
          earned_victories: ["hero_120m", "rich_250k"],
          ending: {
            id: endingId,
            month: 48,
            summary_quote:
              "Una cita satírica extensa para verificar que el cuadro de observaciones envuelve líneas limpiamente.",
          },
        },
        "https://autonomo-simulator.example.org/partidas/expediente",
      );

      const ok = renderShareCardToCanvas(fakeCanvas, summary);
      expect(ok).toBe(true);
      expect(fakeCanvas.width).toBe(1080);
      expect(fakeCanvas.height).toBe(1350);
      expect(drawnImages).toHaveLength(0);

      for (const call of drawnText) {
        expect(call.maxWidth).toBeTypeOf("number");
        expect(call.maxWidth).toBeGreaterThan(0);
      }

      const headerCall = drawnText.find((c) => c.text.includes("AUTÓNOMO SIMULATOR"));
      expect(headerCall).toBeDefined();
      expect(headerCall?.maxWidth).toBeLessThanOrEqual(912);

      const outcomeCalls = drawnText.filter((c) => !c.inSavedTransform && c.y >= 260 && c.y < 530);
      expect(outcomeCalls.length).toBeGreaterThanOrEqual(3);
      for (const call of outcomeCalls) {
        expect(call.x).toBe(84);
        expect(call.maxWidth).toBeLessThanOrEqual(556);
        expect(call.y).toBeLessThanOrEqual(505);
      }

      const stampCalls = drawnText.filter((c) => c.inSavedTransform);
      expect(stampCalls).toHaveLength(2);
      for (const call of stampCalls) {
        expect(call.maxWidth).toBeLessThanOrEqual(268);
      }
    }
  });

  it("composites a framed 16:9 ending illustration into the 1080×1350 card with zero text or stamp collisions", () => {
    const { state } = startNewRun(compiledCatalog, {
      seed: "SEMILLA-ILUSTRADA-FASE2-2026",
    });

    const mockIllustration = {
      naturalWidth: 960,
      naturalHeight: 540,
    } as unknown as CanvasImageSource;

    for (const endingId of Object.keys(ENDING_METADATA) as Array<keyof typeof ENDING_METADATA>) {
      const { fakeCanvas, drawnText, drawnImages } = createRecordedCanvasHarness();

      const summary = createShareSummaryFromState({
        ...state,
        endless_mode: true,
        earned_victories: ["hero_120m", "rich_250k"],
        ending: {
          id: endingId,
          month: 126,
          summary_quote:
            "Sobreviviste diez años de trimestres para terminar cerrando el portátil frente al mar con la agenda apagada.",
        },
      });

      const ok = renderShareCardToCanvas(fakeCanvas, summary, {
        illustrationImage: mockIllustration,
      });
      expect(ok).toBe(true);
      expect(drawnImages).toHaveLength(1);

      // Verify exact 16:9 comic panel destination box (512×288 at x=284, y=489)
      const [, sx, sy, sw, sh, dx, dy, dw, dh] = drawnImages[0]!.args as [
        unknown,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
      ];
      expect([sx, sy, sw, sh]).toEqual([0, 0, 960, 540]);
      expect([dx, dy, dw, dh]).toEqual([284, 489, 512, 288]);
      expect(dw / dh).toBeCloseTo(16 / 9, 5);

      for (const call of drawnText) {
        expect(call.maxWidth).toBeTypeOf("number");
        expect(call.maxWidth).toBeGreaterThan(0);
      }

      // Outcome block lines must stay strictly above vignette top (448) and clear of stamp (<= 556px)
      const outcomeCalls = drawnText.filter((c) => !c.inSavedTransform && c.y >= 230 && c.y < 448);
      expect(outcomeCalls.length).toBeGreaterThanOrEqual(3);
      for (const call of outcomeCalls) {
        expect(call.x).toBe(84);
        expect(call.maxWidth).toBeLessThanOrEqual(556);
        expect(call.y).toBeLessThanOrEqual(438);
      }

      // No non-header text should draw inside the 16:9 artwork viewport (y = 489..777)
      const collidingInsideArt = drawnText.filter(
        (c) => !c.inSavedTransform && c.y >= 489 && c.y <= 777,
      );
      expect(collidingInsideArt).toEqual([]);

      // Casillas, quote, victory seals, and footer sit strictly in ascending non-overlapping bands < 1300
      const casillaHeader = drawnText.find((c) => c.text.includes("CASILLA [01]"));
      const quoteHeader = drawnText.find((c) => c.text.includes("OBSERVACIONES"));
      const victorySeal = drawnText.find((c) => c.text.includes("SELLO HÉROE"));
      const footerMotto = drawnText.find((c) => c.text.includes("Sé tu propio jefe"));

      expect(casillaHeader?.y).toBeGreaterThan(804);
      expect(quoteHeader?.y).toBeGreaterThan(1050);
      expect(victorySeal?.y).toBeGreaterThan(1204);
      expect(footerMotto?.y).toBe(1282);
    }
  });

  it("preloads ending illustration asynchronously in loadAndRenderShareCard and falls back cleanly on load error", async () => {
    const { state } = startNewRun(compiledCatalog, { seed: "ASYNC-SHARE-01" });
    const summary = createShareSummaryFromState(state);

    const originalImage = globalThis.Image;
    try {
      class MockSuccessImage {
        naturalWidth = 960;
        naturalHeight = 540;
        decoding = "async";
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        set src(_url: string) {
          queueMicrotask(() => this.onload?.());
        }
      }

      Object.defineProperty(globalThis, "Image", {
        configurable: true,
        value: MockSuccessImage,
      });

      const successHarness = createRecordedCanvasHarness();
      const okLoaded = await loadAndRenderShareCard(
        successHarness.fakeCanvas,
        summary,
        "./assets/illustrations/illus_final_bancarrota.webp",
      );
      expect(okLoaded).toBe(true);
      expect(successHarness.drawnImages).toHaveLength(1);

      class MockErrorImage {
        decoding = "async";
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        set src(_url: string) {
          queueMicrotask(() => this.onerror?.());
        }
      }

      Object.defineProperty(globalThis, "Image", {
        configurable: true,
        value: MockErrorImage,
      });

      const fallbackHarness = createRecordedCanvasHarness();
      const okFallback = await loadAndRenderShareCard(
        fallbackHarness.fakeCanvas,
        summary,
        "./assets/illustrations/missing.webp",
      );
      expect(okFallback).toBe(true);
      expect(fallbackHarness.drawnImages).toHaveLength(0);
      expect(fallbackHarness.drawnText.length).toBeGreaterThan(5);
    } finally {
      Object.defineProperty(globalThis, "Image", {
        configurable: true,
        value: originalImage,
      });
    }
  });

  it("auto-shrinks long Endless durations (186 months) onto a single line inside CASILLA [01] without wrapping or clipping", () => {
    const { state } = startNewRun(compiledCatalog, { seed: "ENDLESS-186M-FIT" });
    const mockIllustration = {
      naturalWidth: 960,
      naturalHeight: 540,
    } as unknown as CanvasImageSource;

    const summary = createShareSummaryFromState({
      ...state,
      month: 186,
      endless_mode: true,
      earned_victories: ["hero_120m"],
      ending: {
        id: "retired_hero",
        month: 186,
        summary_quote: "Quince años y medio cotizando sin perder el humor.",
      },
    });

    for (const locale of ["es-ES", "en"] as const) {
      const { fakeCanvas, drawnText } = createRecordedCanvasHarness();
      const ok = renderShareCardToCanvas(fakeCanvas, summary, {
        illustrationImage: mockIllustration,
        locale,
      });
      expect(ok).toBe(true);

      // CASILLA [01] occupies x=84..528, y=804..912: header draws at y=828, value draws on 1 line at y=879 (never a 2nd wrapped line at y>=900)
      const casilla01Calls = drawnText.filter(
        (c) => !c.inSavedTransform && c.x === 102 && c.y >= 804 && c.y <= 912,
      );
      expect(casilla01Calls).toHaveLength(2);
      const valueCall = casilla01Calls[1]!;
      expect(valueCall.text).toContain("186");
      expect(valueCall.y).toBeLessThanOrEqual(885);
    }
  });

  it("showcases v2 businessTier & teamHeadcount in BOX [04] and share text across ES and EN while preserving 1080×1350 bounds", () => {
    const { state } = startNewRun(compiledCatalog, { seed: "AGENCY-SHARE-V2" });
    const agencyState: GameState = {
      ...state,
      month: 96,
      business: { tier: "agencia_consultora", months_in_tier: 18, sl_formed_month: 54 },
      employee: {
        character_id: "empleada_senior_laura",
        role_label: "Especialista sénior",
        headcount: 7,
        lead_monthly_cost: 2450,
        monthly_cost: 13_550,
        billing_multiplier: 2.05,
        satisfaction: 80,
        months_employed: 48,
      },
      indicators: { ...state.indicators, money: 265_000, reputation: 88 },
      earned_victories: ["rich_250k"],
      ending: {
        id: "retired_rich",
        month: 96,
        summary_quote:
          "Con 250.000 € limpios en el banco, por fin puedes decir la frase mágica: «Consultadlo con mi asesor».",
      },
    };

    const summary = createShareSummaryFromState(agencyState, "https://autonomo.example/v2");
    expect(summary.businessTier).toBe("agencia_consultora");
    expect(summary.teamHeadcount).toBe(7);

    const esText = buildShareText(summary, "es-ES");
    const enText = buildShareText(summary, "en");
    expect(esText).toContain("Agencia · 7 pers.");
    expect(esText).toContain("Ricachón (250.000 €)");
    expect(enText).toContain("Agency · 7 staff");
    expect(enText).toContain("Rolling in It (250,000 €)");

    const esHarness = createRecordedCanvasHarness();
    expect(renderShareCardToCanvas(esHarness.fakeCanvas, summary, { locale: "es-ES" })).toBe(true);
    expect(esHarness.drawnText.some((t) => t.text === "CASILLA [04] · ESTRUCTURA")).toBe(true);
    expect(esHarness.drawnText.some((t) => t.text === "Agencia · 7 pers.")).toBe(true);

    const enHarness = createRecordedCanvasHarness();
    expect(renderShareCardToCanvas(enHarness.fakeCanvas, summary, { locale: "en" })).toBe(true);
    expect(enHarness.drawnText.some((t) => t.text === "BOX [04] · STRUCTURE")).toBe(true);
    expect(enHarness.drawnText.some((t) => t.text === "Agency · 7 staff")).toBe(true);
  });
});
