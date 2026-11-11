import { describe, expect, it } from "vitest";
import { type GameState, startNewRun } from "../../src/engine/index.ts";
import { compiledCatalog } from "../../src/services/content/catalog.ts";
import {
  ACHIEVEMENT_CATALOG,
  ACTIVE_RUN_KEY,
  CORRUPT_BACKUP_KEY,
  CURRENT_SAVE_VERSION,
  ENGINE_BUILD,
  PROFILE_KEY,
  createMemoryStorageDriver,
  createStorageAdapter,
  migrateSaveEnvelope,
} from "../../src/services/storage/index.ts";

describe("StoragePort & Save Migrations", () => {
  it("saves and reloads an active run with exact GameState fidelity", async () => {
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
    expect(loaded.envelope?.engine_build).toBe("0.2.0-phase1");
    expect(ENGINE_BUILD).toBe("0.2.0-phase1");
    expect(loaded.envelope?.state).toEqual(state);
  });

  it("unlocks Phase 0 and Phase 1 milestone achievements progressively across months, entities, and Hacienda", async () => {
    const driver = createMemoryStorageDriver();
    const storage = createStorageAdapter(driver);

    expect(ACHIEVEMENT_CATALOG).toHaveLength(9);

    const { state: baseState } = startNewRun(compiledCatalog, {
      seed: "TEST-ACH-01",
      runId: "run_ach_01",
    });

    const month3State: GameState = { ...baseState, month: 3 };
    const syncM3 = await storage.syncRunProgress(month3State, "2026-11-11T10:03:00.000Z");
    expect(syncM3.newlyUnlocked).toEqual(["primer_trimestre"]);
    expect(syncM3.profile.achievements.primer_trimestre).toBe("2026-11-11T10:03:00.000Z");

    // Non-hacienda occurrences or count 0 do not unlock superviviente_hacienda
    const nonHaciendaState: GameState = {
      ...month3State,
      occurrences: { cliente_pago_sin_factura: 2, hacienda_carta_certificada: 0 },
    };
    const syncNoHac = await storage.syncRunProgress(nonHaciendaState, "2026-11-11T10:04:00.000Z");
    expect(syncNoHac.newlyUnlocked).toEqual([]);

    // Phase 1 intermediate milestones: gestor, Hacienda survival, employee, family household
    const phase1EntitiesState: GameState = {
      ...month3State,
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
      },
    };
    const syncP1 = await storage.syncRunProgress(phase1EntitiesState, "2026-11-11T10:08:00.000Z");
    expect(syncP1.newlyUnlocked).toEqual([
      "gestor_contratado",
      "superviviente_hacienda",
      "primer_empleado",
      "familia_formada",
    ]);

    const month12State: GameState = { ...phase1EntitiesState, month: 12 };
    const syncM12 = await storage.syncRunProgress(month12State, "2026-11-11T10:12:00.000Z");
    expect(syncM12.newlyUnlocked).toEqual(["primer_ano"]);

    const heroRichState: GameState = {
      ...phase1EntitiesState,
      month: 120,
      indicators: { ...baseState.indicators, money: 155_000 },
      earned_victories: ["hero_120m", "rich_150k"],
    };
    const syncHero = await storage.syncRunProgress(heroRichState, "2026-11-11T12:00:00.000Z");
    expect(syncHero.newlyUnlocked).toEqual(["cinco_anos", "heroe_120m", "ricachon_150k"]);
    expect(Object.keys(syncHero.profile.achievements)).toHaveLength(9);
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

    // Active run slot must be wiped on game over
    const afterEndLoad = await storage.loadActiveRun();
    expect(afterEndLoad.envelope).toBeNull();

    // Calling syncRunProgress a second time with same run_id must not duplicate hall_of_fame
    await storage.syncRunProgress(finishedState, "2026-11-11T11:31:00.000Z");
    const profile = await storage.loadProfile();
    expect(profile.hall_of_fame).toHaveLength(1);
    expect(profile.hall_of_fame[0]?.run_id).toBe("run_end_01");
    expect(profile.achievements.heroe_120m).toBeDefined();
  });

  it("migrates legacy v0 envelope and recovers gracefully from corrupt active save while preserving profile", async () => {
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
      expect(migratedV0.envelope.state.run_id).toBe("run_legacy_v0");
    }

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

    // Corrupt blob backed up and active slot cleared
    const backup = await storage.loadCorruptBackup();
    expect(backup).not.toBeNull();
    expect(backup?.raw).toBe("{not-valid-json");
    expect(await driver.get(CORRUPT_BACKUP_KEY)).toBeDefined();
    expect(await driver.get(ACTIVE_RUN_KEY)).toBeUndefined();

    // Profile remains 100% intact
    const preservedProfile = await storage.loadProfile();
    expect(preservedProfile.achievements.primer_trimestre).toBe("2026-11-10T00:00:00.000Z");
    expect(preservedProfile.settings.reduced_motion).toBe(true);
  });
});
