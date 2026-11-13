import { describe, expect, it } from "vitest";
import { type GameState, startNewRun } from "../../src/engine/index.ts";
import { compiledCatalog } from "../../src/services/content/catalog.ts";
import {
  ACHIEVEMENT_CATALOG,
  ACTIVE_RUN_KEY,
  CORRUPT_BACKUP_KEY,
  CURRENT_SAVE_VERSION,
  ENGINE_BUILD,
  KNOWN_ACHIEVEMENT_IDS,
  PROFILE_KEY,
  createMemoryStorageDriver,
  createStorageAdapter,
  migrateProfileEnvelope,
  migrateSaveEnvelope,
} from "../../src/services/storage/index.ts";

describe("StoragePort & Save Migrations", () => {
  it("saves and reloads an active run with exact GameState fidelity on Phase 2 engine build", async () => {
    const driver = createMemoryStorageDriver();
    const storage = createStorageAdapter(driver);

    const { state } = startNewRun(compiledCatalog, {
      seed: "TEST-SAVE-01",
      runId: "run_save_01",
    });

    await storage.syncRunProgress(state, "2026-11-11T10:00:00.000Z");

    const loaded = await storage.loadActiveRun();
    expect(loaded.corruptedRecovery).toBeNull();
    expect(loaded.envelope).not.toBeNull();
    expect(loaded.envelope?.save_version).toBe(CURRENT_SAVE_VERSION);
    expect(loaded.envelope?.engine_build).toBe("0.3.0-phase2");
    expect(ENGINE_BUILD).toBe("0.3.0-phase2");
    expect(loaded.envelope?.state).toEqual(state);
  });

  it("exposes all 15 unique snake_case achievements (preserving all 9 Phase 1 IDs + 6 Phase 2 milestones)", () => {
    expect(ACHIEVEMENT_CATALOG).toHaveLength(15);
    expect(KNOWN_ACHIEVEMENT_IDS.size).toBe(15);

    const ids = ACHIEVEMENT_CATALOG.map((item) => item.id);
    for (const id of ids) {
      expect(id).toMatch(/^[a-z0-9]+(?:_[a-z0-9]+)*$/);
    }

    // All 9 Phase 1 IDs must remain intact
    for (const legacyId of [
      "primer_trimestre",
      "primer_ano",
      "gestor_contratado",
      "superviviente_hacienda",
      "primer_empleado",
      "familia_formada",
      "cinco_anos",
      "heroe_120m",
      "ricachon_150k",
    ] as const) {
      expect(ids).toContain(legacyId);
    }

    // All 6 Phase 2 IDs must be registered
    for (const phase2Id of [
      "aplazamiento_solicitado",
      "numeros_rojos_superados",
      "colchon_10k",
      "criatura_en_casa",
      "facturacion_100k",
      "modo_infinito",
    ] as const) {
      expect(ids).toContain(phase2Id);
    }
  });

  it("unlocks all 15 Phase 0, Phase 1, and Phase 2 career achievements progressively", async () => {
    const driver = createMemoryStorageDriver();
    const storage = createStorageAdapter(driver);

    const { state: baseState } = startNewRun(compiledCatalog, {
      seed: "TEST-ACH-01",
      runId: "run_ach_01",
    });

    // Reaching Month 3 alone (before settling Q1) must NOT prematurely unlock primer_trimestre
    const month3PreQuarter: GameState = { ...baseState, month: 3 };
    const syncM3Pre = await storage.syncRunProgress(month3PreQuarter, "2026-11-11T10:02:30.000Z");
    expect(syncM3Pre.newlyUnlocked).toEqual([]);

    // Settling Q1 (month > 3 or taxes_paid > 0 / quarterly_tax history) unlocks primer_trimestre
    const month3State: GameState = {
      ...baseState,
      month: 4,
      annual_snapshot: { ...baseState.annual_snapshot, taxes_paid: 420 },
    };
    const syncM3 = await storage.syncRunProgress(month3State, "2026-11-11T10:03:00.000Z");
    expect(syncM3.newlyUnlocked).toEqual(["primer_trimestre"]);
    expect(syncM3.profile.achievements.primer_trimestre).toBe("2026-11-11T10:03:00.000Z");

    // Non-hacienda occurrences or still-negative cash do not prematurely unlock achievements
    const negativeState: GameState = {
      ...month3State,
      indicators: { ...month3State.indicators, money: -450 },
      finances: {
        ...month3State.finances,
        consecutive_negative_months: 1,
      },
      occurrences: { cliente_pago_sin_factura: 2, hacienda_carta_certificada: 0 },
    };
    const syncNeg = await storage.syncRunProgress(negativeState, "2026-11-11T10:04:00.000Z");
    expect(syncNeg.newlyUnlocked).toEqual([]);

    // Recovering from negative cash via history trajectory (even after consecutive_negative_months resets to 0)
    // plus requesting an Aplazamiento unlocks both fiscal survival badges
    const recoveredAndDeferredState: GameState = {
      ...month3State,
      indicators: { ...month3State.indicators, money: 350 },
      finances: {
        ...month3State.finances,
        consecutive_negative_months: 0,
        deferred_tax: { principal: 900, surcharge: 90, due_month: 6 },
      },
      history: [
        ...month3State.history,
        {
          id: "hist_choice_3_recovery",
          month: 3,
          kind: "event_choice",
          money_delta: 800, // 350 - 800 = -450 prior balance -> overcame números rojos!
        },
      ],
    };
    const syncRecov = await storage.syncRunProgress(
      recoveredAndDeferredState,
      "2026-11-11T10:05:00.000Z",
    );
    expect(syncRecov.newlyUnlocked).toEqual(["aplazamiento_solicitado", "numeros_rojos_superados"]);

    // Entities + child conciliation + 10k cushion
    const midCareerState: GameState = {
      ...recoveredAndDeferredState,
      indicators: { ...recoveredAndDeferredState.indicators, money: 12_500 },
      gestor: {
        ...month3State.gestor,
        tier: "cheap",
        character_id: "gestor_barato_paco",
        monthly_fee: 65,
      },
      occurrences: { hacienda_carta_certificada: 1 },
      employee: {
        character_id: "empleado_junior_dani",
        role_label: "Asistente júnior",
        monthly_cost: 1450,
        billing_multiplier: 1.35,
        satisfaction: 75,
        months_employed: 1,
      },
      family: {
        ...month3State.family,
        status: "cohabiting",
        partner_character_id: "pareja_alex",
        children_count: 1,
      },
    };
    const syncMid = await storage.syncRunProgress(midCareerState, "2026-11-11T10:08:00.000Z");
    expect(syncMid.newlyUnlocked).toEqual([
      "gestor_contratado",
      "superviviente_hacienda",
      "colchon_10k",
      "primer_empleado",
      "familia_formada",
      "criatura_en_casa",
    ]);

    // Reaching Month 12 during event_resolution (before settling Q4) must NOT prematurely unlock primer_ano
    const month12PreSettlementState: GameState = {
      ...midCareerState,
      month: 12,
      phase: "event_resolution",
    };
    const syncM12Pre = await storage.syncRunProgress(
      month12PreSettlementState,
      "2026-11-11T10:11:30.000Z",
    );
    expect(syncM12Pre.newlyUnlocked).toEqual([]);

    // Surviving Month 12 (entering annual_summary or month > 12) unlocks primer_ano
    const month12State: GameState = {
      ...midCareerState,
      month: 12,
      phase: "annual_summary",
    };
    const syncM12 = await storage.syncRunProgress(month12State, "2026-11-11T10:12:00.000Z");
    expect(syncM12.newlyUnlocked).toEqual(["primer_ano"]);

    // Reaching Month 60 during event_resolution (before settling Q20) must NOT prematurely unlock cinco_anos
    const month60PreSettlementState: GameState = {
      ...month12State,
      month: 60,
      phase: "event_resolution",
    };
    const syncM60Pre = await storage.syncRunProgress(
      month60PreSettlementState,
      "2026-11-11T11:20:00.000Z",
    );
    expect(syncM60Pre.newlyUnlocked).toEqual([]);

    // Reaching start of Month 120 without earned_victories["hero_120m"] must NOT prematurely unlock heroe_120m
    const month120StartState: GameState = {
      ...month12State,
      month: 120,
      phase: "event_resolution",
      earned_victories: [],
    };
    const syncM120Start = await storage.syncRunProgress(
      month120StartState,
      "2026-11-11T11:55:00.000Z",
    );
    expect(syncM120Start.newlyUnlocked).toEqual(["cinco_anos"]);
    expect(syncM120Start.profile.achievements.heroe_120m).toBeUndefined();

    // Late-game & Endless milestones: 100k billed, 120m hero seal, 150k rich, endless_mode
    const endlessVeteranState: GameState = {
      ...month12State,
      month: 121,
      phase: "event_resolution",
      endless_mode: true,
      indicators: { ...baseState.indicators, money: 155_000 },
      finances: { ...month12State.finances, lifetime_billed: 142_000 },
      earned_victories: ["hero_120m", "rich_150k"],
    };
    const syncVet = await storage.syncRunProgress(endlessVeteranState, "2026-11-11T12:00:00.000Z");
    expect(syncVet.newlyUnlocked).toEqual([
      "facturacion_100k",
      "heroe_120m",
      "ricachon_150k",
      "modo_infinito",
    ]);
    expect(Object.keys(syncVet.profile.achievements)).toHaveLength(15);
  });

  it("enforces post-tax wealth deductions during quarterly_tax and requires non-ended run for superviviente_hacienda", async () => {
    const driver = createMemoryStorageDriver();
    const storage = createStorageAdapter(driver);

    const { state: baseState } = startNewRun(compiledCatalog, {
      seed: "TEST-ACH-P36-GUARDS",
      runId: "run_ach_p36_guards",
    });

    // 1. Fatal Hacienda event (game_over / ending !== null or stress >= 100 / moral <= 0) must NOT unlock superviviente_hacienda
    const fatalHaciendaState: GameState = {
      ...baseState,
      month: 6,
      phase: "game_over",
      ending: {
        id: "defeat_burnout_stress",
        month: 6,
        summary_quote: "Demasiados requerimientos.",
      },
      indicators: { ...baseState.indicators, stress: 100 },
      history: [
        ...baseState.history,
        {
          id: "hist_choice_6_hacienda",
          month: 6,
          kind: "event_choice",
          event_id: "hacienda_carta_certificada",
          choice_id: "ignorar_requerimiento",
        },
      ],
      occurrences: { hacienda_carta_certificada: 1 },
    };
    const syncFatalHacienda = await storage.syncRunProgress(
      fatalHaciendaState,
      "2026-11-12T09:00:00.000Z",
    );
    expect(syncFatalHacienda.newlyUnlocked).not.toContain("superviviente_hacienda");

    // Non-ended run with a resolved hacienda_* choice DOES unlock superviviente_hacienda
    const survivedHaciendaState: GameState = {
      ...baseState,
      month: 6,
      phase: "event_resolution",
      ending: null,
      indicators: { ...baseState.indicators, stress: 58, moral: 60 },
      history: [
        ...baseState.history,
        {
          id: "hist_choice_6_hacienda_ok",
          month: 6,
          kind: "event_choice",
          event_id: "hacienda_carta_certificada",
          choice_id: "aportar_documentacion",
        },
      ],
    };
    const syncSurvivedHacienda = await storage.syncRunProgress(
      survivedHaciendaState,
      "2026-11-12T09:05:00.000Z",
    );
    expect(syncSurvivedHacienda.newlyUnlocked).toContain("superviviente_hacienda");

    // 2. During phase: "quarterly_tax", colchon_10k and ricachon_150k deduct accrued_tax_liability + mandatory due deferred_tax
    const preTaxInflated10k: GameState = {
      ...survivedHaciendaState,
      month: 6,
      phase: "quarterly_tax",
      indicators: { ...survivedHaciendaState.indicators, money: 11_200 },
      finances: {
        ...survivedHaciendaState.finances,
        accrued_tax_liability: 900,
        deferred_tax: { principal: 500, surcharge: 50, due_month: 6 }, // effectiveMoney = 11_200 - 900 - 550 = 9_750 < 10_000
      },
    };
    const syncPreTax10k = await storage.syncRunProgress(
      preTaxInflated10k,
      "2026-11-12T09:10:00.000Z",
    );
    expect(syncPreTax10k.newlyUnlocked).not.toContain("colchon_10k");

    const postTaxTrue10k: GameState = {
      ...preTaxInflated10k,
      indicators: { ...preTaxInflated10k.indicators, money: 11_600 }, // 11_600 - 900 - 550 = 10_150 >= 10_000
    };
    const syncPostTax10k = await storage.syncRunProgress(
      postTaxTrue10k,
      "2026-11-12T09:11:00.000Z",
    );
    expect(syncPostTax10k.newlyUnlocked).toContain("colchon_10k");

    const preTaxInflated150k: GameState = {
      ...postTaxTrue10k,
      month: 36,
      phase: "quarterly_tax",
      indicators: { ...postTaxTrue10k.indicators, money: 153_000 },
      finances: {
        ...postTaxTrue10k.finances,
        accrued_tax_liability: 2_800,
        deferred_tax: { principal: 600, surcharge: 60, due_month: 36 }, // effectiveMoney = 153_000 - 2_800 - 660 = 149_540 < 150_000
      },
    };
    const syncPreTax150k = await storage.syncRunProgress(
      preTaxInflated150k,
      "2026-11-12T09:15:00.000Z",
    );
    expect(syncPreTax150k.newlyUnlocked).not.toContain("ricachon_150k");

    const postTaxTrue150k: GameState = {
      ...preTaxInflated150k,
      indicators: { ...preTaxInflated150k.indicators, money: 154_000 }, // 154_000 - 2_800 - 660 = 150_540 >= 150_000
    };
    const syncPostTax150k = await storage.syncRunProgress(
      postTaxTrue150k,
      "2026-11-12T09:16:00.000Z",
    );
    expect(syncPostTax150k.newlyUnlocked).toContain("ricachon_150k");
  });

  it("also unlocks numeros_rojos_superados when consecutive_negative_months > 0 and cash rebounds mid-month, but never on game_over", async () => {
    const driver = createMemoryStorageDriver();
    const storage = createStorageAdapter(driver);

    const { state } = startNewRun(compiledCatalog, {
      seed: "TEST-OVERDRAFT-02",
      runId: "run_overdraft_02",
    });

    // Game-over state must NOT unlock numeros_rojos_superados even if consecutive_negative_months > 0
    const bankruptOrEnded: GameState = {
      ...state,
      phase: "game_over",
      indicators: { ...state.indicators, money: 100 },
      finances: { ...state.finances, consecutive_negative_months: 1 },
      ending: { id: "abandon_oposiciones", month: 4, summary_quote: "Adiós cuotas." },
    };
    const endedSync = await storage.syncRunProgress(bankruptOrEnded, "2026-11-11T10:00:00.000Z");
    expect(endedSync.newlyUnlocked).not.toContain("numeros_rojos_superados");

    // Live mid-month rebound from prior negative month unlocks numeros_rojos_superados
    const liveRebound: GameState = {
      ...state,
      month: 4,
      ending: null,
      indicators: { ...state.indicators, money: 120 },
      finances: { ...state.finances, consecutive_negative_months: 1 },
    };
    const reboundSync = await storage.syncRunProgress(liveRebound, "2026-11-11T10:05:00.000Z");
    expect(reboundSync.newlyUnlocked).toContain("numeros_rojos_superados");
  });

  it("clears autonomo:active_run and archives finished runs into hall_of_fame without duplicates", async () => {
    const driver = createMemoryStorageDriver();
    const storage = createStorageAdapter(driver);

    const { state: initialState } = startNewRun(compiledCatalog, {
      seed: "TEST-END-01",
      runId: "run_end_01",
    });
    await storage.syncRunProgress(initialState, "2026-11-11T10:00:00.000Z");

    const finishedState: GameState = {
      ...initialState,
      month: 128,
      phase: "game_over",
      endless_mode: true,
      earned_victories: ["hero_120m"],
      indicators: { ...initialState.indicators, money: -5400 },
      finances: { ...initialState.finances, lifetime_billed: 248_900 },
      ending: {
        id: "defeat_bankruptcy",
        month: 128,
        summary_quote: "La cuota no perdona.",
      },
    };

    const archived = await storage.syncRunProgress(finishedState, "2026-11-11T11:30:00.000Z");
    expect(archived.archivedSummary).not.toBeNull();
    expect(archived.archivedSummary?.months_survived).toBe(128);
    expect(archived.archivedSummary?.earned_victories).toEqual(["hero_120m"]);

    const afterEndLoad = await storage.loadActiveRun();
    expect(afterEndLoad.envelope).toBeNull();

    await storage.syncRunProgress(finishedState, "2026-11-11T11:31:00.000Z");
    const profile = await storage.loadProfile();
    expect(profile.hall_of_fame).toHaveLength(1);
    expect(profile.hall_of_fame[0]?.run_id).toBe("run_end_01");
    expect(profile.achievements.heroe_120m).toBeDefined();
    expect(profile.achievements.facturacion_100k).toBeDefined();
    expect(profile.achievements.modo_infinito).toBeDefined();
  });

  it("migrates legacy v0 envelope, normalizes legacy achievement keys, and recovers gracefully from corrupt active save", async () => {
    const { state } = startNewRun(compiledCatalog, {
      seed: "LEGACY-SEED",
      runId: "run_legacy_v0",
    });

    const migratedV0 = migrateSaveEnvelope({
      save_version: 0,
      state,
    });
    expect(migratedV0.ok).toBe(true);
    if (migratedV0.ok) {
      expect(migratedV0.envelope.save_version).toBe(1);
      expect(migratedV0.envelope.engine_build).toBe("0.3.0-phase2");
      expect(migratedV0.envelope.state.run_id).toBe("run_legacy_v0");
    }

    const normalizedProfile = migrateProfileEnvelope({
      profile_version: 1,
      achievements: {
        primer_trimestre: "2026-11-10T00:00:00.000Z",
        aplazamiento_Solicitado: "2026-11-10T01:00:00.000Z",
      },
      hall_of_fame: [],
      settings: { reduced_motion: true, locale: "es-ES" },
    });
    expect(normalizedProfile.achievements.aplazamiento_solicitado).toBe("2026-11-10T01:00:00.000Z");

    const driver = createMemoryStorageDriver({
      [ACTIVE_RUN_KEY]: "{not-valid-json",
      [PROFILE_KEY]: {
        profile_version: 1,
        achievements: { primer_trimestre: "2026-11-10T00:00:00.000Z" },
        hall_of_fame: [],
        settings: { reduced_motion: true, locale: "es-ES" },
      },
    });
    const storage = createStorageAdapter(driver);

    const loadResult = await storage.loadActiveRun();
    expect(loadResult.envelope).toBeNull();
    expect(loadResult.corruptedRecovery).not.toBeNull();
    expect(loadResult.corruptedRecovery?.reason).toContain("Invalid JSON");

    const backup = await storage.loadCorruptBackup();
    expect(backup).not.toBeNull();
    expect(backup?.raw).toBe("{not-valid-json");
    expect(await driver.get(CORRUPT_BACKUP_KEY)).toBeDefined();
    expect(await driver.get(ACTIVE_RUN_KEY)).toBeUndefined();

    const preservedProfile = await storage.loadProfile();
    expect(preservedProfile.achievements.primer_trimestre).toBe("2026-11-10T00:00:00.000Z");
    expect(preservedProfile.settings.reduced_motion).toBe(true);
  });

  it("round-trips SaveEnvelope.pending_turn cleanly and safely drops malformed pending_turn payloads", async () => {
    const driver = createMemoryStorageDriver();
    const storage = createStorageAdapter(driver);

    const { state } = startNewRun(compiledCatalog, {
      seed: "PENDING-TURN-01",
      runId: "run_pending_turn_01",
    });
    const sampleEvent = compiledCatalog.events[0]!;
    const sampleChoice = sampleEvent.choices[0]!;

    await storage.saveActiveRun(state, "2026-11-12T10:00:00.000Z", {
      pendingTurn: {
        pending_outcome: {
          event: sampleEvent,
          choiceId: sampleChoice.id,
          choiceLabel: sampleChoice.label,
          outcome: {
            event_id: sampleEvent.id,
            choice_id: sampleChoice.id,
            outcome_id: null,
            result_text: "Resultado pendiente.",
            money_delta: 250,
            moral_delta: 0,
            stress_delta: 4,
            personal_life_delta: 0,
            reputation_delta: 1,
            fiscal_risk_delta: 0,
            scheduled_event_ids: [],
          },
        },
        outcome_preview_state: state,
        queued_final_state: null,
        queued_post_outcome_deltas: { stress: 2 },
        queued_month_start: null,
        last_deltas: { money: 250, stress: 4, reputation: 1 },
        last_month_start: null,
      },
    });

    const loaded = await storage.loadActiveRun();
    expect(loaded.corruptedRecovery).toBeNull();
    expect(loaded.envelope?.pending_turn?.pending_outcome.choiceId).toBe(sampleChoice.id);
    expect(loaded.envelope?.pending_turn?.last_deltas).toEqual({
      money: 250,
      stress: 4,
      reputation: 1,
    });

    // Malformed pending_turn should be stripped without corrupting the valid GameState
    const migratedMalformed = migrateSaveEnvelope({
      save_version: 1,
      state,
      pending_turn: { pending_outcome: "invalid" },
    });
    expect(migratedMalformed.ok).toBe(true);
    if (migratedMalformed.ok) {
      expect(migratedMalformed.envelope.state).toEqual(state);
      expect(migratedMalformed.envelope.pending_turn).toBeUndefined();
    }
  });
});
