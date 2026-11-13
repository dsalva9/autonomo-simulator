import { describe, expect, it } from "vitest";
import { type GameState, createInitialGameState, startNewRun } from "../../src/engine/index.ts";
import { compiledCatalog, resolveDeskBackgroundAsset } from "../../src/services/content/catalog.ts";
import { evaluateUnlockedAchievements } from "../../src/services/storage/StoragePort.ts";
import { createFixtureCatalog } from "./fixtures.ts";

describe("Phase 3.6 studio background & achievement timing predicates", () => {
  it("resolves bg_despacho_estudio when either estudio_calle_alquilado or estudio_propio_activo flag is set", () => {
    const baseState = createInitialGameState(compiledCatalog, { seed: "DESK-BG-P36" });

    expect(resolveDeskBackgroundAsset(compiledCatalog.manifest, baseState)?.id).toBe(
      "bg_despacho_base",
    );

    const rentedStreetStudio: GameState = {
      ...baseState,
      flags: { estudio_calle_alquilado: true },
    };
    expect(resolveDeskBackgroundAsset(compiledCatalog.manifest, rentedStreetStudio)?.id).toBe(
      "bg_despacho_estudio",
    );

    const ownedStudio: GameState = {
      ...baseState,
      flags: { estudio_propio_activo: true },
    };
    expect(resolveDeskBackgroundAsset(compiledCatalog.manifest, ownedStudio)?.id).toBe(
      "bg_despacho_estudio",
    );
  });

  it("enforces exact milestone survival, Hacienda survival, and post-tax wealth predicates in evaluateUnlockedAchievements", () => {
    const catalog = createFixtureCatalog();
    const started = startNewRun(catalog, { seed: "ACH-PREDICATES-P36" }).state;

    // 1. primer_ano & cinco_anos do NOT unlock merely upon entering Month 12 / Month 60
    const m12Start: GameState = { ...started, month: 12, phase: "event_resolution" };
    expect(evaluateUnlockedAchievements(m12Start, {}).newlyUnlocked).not.toContain("primer_ano");

    const m12BankruptOnQ4: GameState = {
      ...started,
      month: 12,
      phase: "game_over",
      ending: { id: "defeat_bankruptcy", month: 12, summary_quote: "Bancarrota en Q4." },
    };
    expect(evaluateUnlockedAchievements(m12BankruptOnQ4, {}).newlyUnlocked).not.toContain(
      "primer_ano",
    );

    const m12AnnualSummary: GameState = { ...started, month: 12, phase: "annual_summary" };
    expect(evaluateUnlockedAchievements(m12AnnualSummary, {}).newlyUnlocked).toContain(
      "primer_ano",
    );

    const m60Start: GameState = { ...started, month: 60, phase: "quarterly_tax" };
    expect(evaluateUnlockedAchievements(m60Start, {}).newlyUnlocked).not.toContain("cinco_anos");

    const m60AnnualSummary: GameState = { ...started, month: 60, phase: "annual_summary" };
    expect(evaluateUnlockedAchievements(m60AnnualSummary, {}).newlyUnlocked).toContain(
      "cinco_anos",
    );

    // 2. superviviente_hacienda requires surviving a resolved Hacienda event (not merely drawing it or dying on it)
    const haciendaDrawnOnly: GameState = {
      ...started,
      current_turn_events: ["hacienda_carta_certificada"],
      occurrences: {},
      history: [],
    };
    expect(evaluateUnlockedAchievements(haciendaDrawnOnly, {}).newlyUnlocked).not.toContain(
      "superviviente_hacienda",
    );

    const diedOnHacienda: GameState = {
      ...started,
      phase: "game_over",
      occurrences: { hacienda_carta_certificada: 1 },
      history: [
        {
          id: "h1",
          month: 4,
          kind: "event_choice",
          event_id: "hacienda_carta_certificada",
          choice_id: "pagar_recargo",
        },
      ],
      ending: { id: "defeat_bankruptcy", month: 4, summary_quote: "Embargado." },
    };
    expect(evaluateUnlockedAchievements(diedOnHacienda, {}).newlyUnlocked).not.toContain(
      "superviviente_hacienda",
    );

    const survivedHaciendaChoice: GameState = {
      ...started,
      ending: null,
      phase: "event_resolution",
      history: [
        {
          id: "h1",
          month: 4,
          kind: "event_choice",
          event_id: "hacienda_carta_certificada",
          choice_id: "pagar_recargo",
        },
      ],
    };
    expect(evaluateUnlockedAchievements(survivedHaciendaChoice, {}).newlyUnlocked).toContain(
      "superviviente_hacienda",
    );

    // 3. colchon_10k & ricachon_150k subtract accrued_tax_liability during quarterly_tax phase
    const preTaxIllusion10k: GameState = {
      ...started,
      month: 6,
      phase: "quarterly_tax",
      indicators: { ...started.indicators, money: 10_400 },
      finances: { ...started.finances, accrued_tax_liability: 1_200 },
    };
    expect(evaluateUnlockedAchievements(preTaxIllusion10k, {}).newlyUnlocked).not.toContain(
      "colchon_10k",
    );

    const trueNet10kInQuarter: GameState = {
      ...preTaxIllusion10k,
      indicators: { ...started.indicators, money: 11_500 },
    };
    expect(evaluateUnlockedAchievements(trueNet10kInQuarter, {}).newlyUnlocked).toContain(
      "colchon_10k",
    );

    const preTaxIllusion150k: GameState = {
      ...started,
      month: 90,
      phase: "quarterly_tax",
      indicators: { ...started.indicators, money: 151_000 },
      finances: { ...started.finances, accrued_tax_liability: 4_000 },
    };
    expect(evaluateUnlockedAchievements(preTaxIllusion150k, {}).newlyUnlocked).not.toContain(
      "ricachon_150k",
    );
  });
});
