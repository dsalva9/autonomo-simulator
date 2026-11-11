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
  renderShareCardToCanvas,
  resolveShareUrl,
} from "../../src/services/share/shareResult.ts";

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
      earned_victories: ["hero_120m", "rich_150k"],
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
    expect(text).toContain("Ricachón (150.000 €)");
    expect(text).toContain("SHARE-SEED-99");
    expect(text).toContain("https://autonomo.example/juego");
  });

  it("resolves canonical Vercel game URL by default, on localhost, and in non-browser contexts", () => {
    expect(CANONICAL_GAME_URL).toBe("https://autonomo-simulator.vercel.app/");
    expect(resolveShareUrl()).toBe("https://autonomo-simulator.vercel.app/");
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
      expect(resolveShareUrl()).toBe("https://autonomo-simulator.vercel.app/");

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
      expect(resolveShareUrl()).toBe("https://autonomo-simulator.vercel.app/");
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

  it("renders share canvas for all 8 endings with explicit maxWidth guards and stamp clearance", () => {
    const { state } = startNewRun(compiledCatalog, {
      seed: "SEMILLA-MUY-LARGA-PARA-COMPROBAR-LIMITES-2026",
    });

    for (const endingId of Object.keys(ENDING_METADATA) as Array<keyof typeof ENDING_METADATA>) {
      const drawnText: Array<{
        text: string;
        x: number;
        y: number;
        maxWidth: number | undefined;
        font: string;
        inSavedTransform: boolean;
      }> = [];
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

      const summary = createShareSummaryFromState(
        {
          ...state,
          endless_mode: true,
          earned_victories: ["hero_120m", "rich_150k"],
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

      // Every single fillText call must carry an explicit maxWidth guard
      for (const call of drawnText) {
        expect(call.maxWidth).toBeTypeOf("number");
        expect(call.maxWidth).toBeGreaterThan(0);
      }

      // Header title must fit inside the 912px inner banner width
      const headerCall = drawnText.find((c) => c.text.includes("AUTÓNOMO SIMULATOR"));
      expect(headerCall).toBeDefined();
      expect(headerCall?.maxWidth).toBeLessThanOrEqual(912);

      // Outcome block lines (y between 260 and 520 outside stamp transform) must stay in left column <= 556px
      // and finish strictly above gridTop (530)
      const outcomeCalls = drawnText.filter((c) => !c.inSavedTransform && c.y >= 260 && c.y < 530);
      expect(outcomeCalls.length).toBeGreaterThanOrEqual(3);
      for (const call of outcomeCalls) {
        expect(call.x).toBe(84);
        expect(call.maxWidth).toBeLessThanOrEqual(556);
        expect(call.y).toBeLessThanOrEqual(505);
      }

      // Stamp text must carry inner border maxWidth <= 268
      const stampCalls = drawnText.filter((c) => c.inSavedTransform);
      expect(stampCalls).toHaveLength(2);
      for (const call of stampCalls) {
        expect(call.maxWidth).toBeLessThanOrEqual(268);
      }
    }
  });
});
