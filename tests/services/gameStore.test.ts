import { beforeEach, describe, expect, it } from "vitest";
import { getActiveEvent } from "../../src/engine/index.ts";
import { compiledCatalog } from "../../src/services/content/catalog.ts";
import {
  createMemoryStorageDriver,
  createStorageAdapter,
} from "../../src/services/storage/index.ts";
import {
  canRetireHonorably,
  getVisibleGameState,
  setGameStoreStoragePort,
  useGameStore,
} from "../../src/store/gameStore.ts";
import {
  FAST_PACING_STORAGE_KEY,
  SFX_MUTED_STORAGE_KEY,
  useUIStore,
} from "../../src/store/uiStore.ts";

describe("useGameStore & useUIStore Integration", () => {
  beforeEach(async () => {
    const storage = createStorageAdapter(createMemoryStorageDriver());
    setGameStoreStoragePort(storage);
    useUIStore.setState({
      screenView: "title",
      activeMobileTab: "despacho",
      activeTitleTab: "hall_of_fame",
      abandonModalOpen: false,
      reducedMotionOverride: null,
      sfxMuted: false,
      fastPacing: false,
      toast: null,
    });
    await useGameStore.getState().hydrate();
  });

  it("captures pendingOutcome & outcomePreviewState at Month N before transitioning to Month N+1 on acknowledgeOutcome", async () => {
    await useGameStore.getState().startRun("FASE0-STORE-FLOW");
    expect(useUIStore.getState().screenView).toBe("game");
    expect(useGameStore.getState().activeRun?.month).toBe(1);
    expect(getVisibleGameState(useGameStore.getState())?.month).toBe(1);

    const month1Before = structuredClone(useGameStore.getState().activeRun!);
    const m1View = getActiveEvent(month1Before, compiledCatalog)!;
    const m1Choice = m1View.choices.find((c) => c.eligible)!;

    await useGameStore.getState().chooseOption(m1Choice.choice.id);

    // During outcome review: visible state stays on Month 1 with exact choice delta
    const midStore = useGameStore.getState();
    expect(midStore.pendingOutcome).not.toBeNull();
    expect(midStore.outcomePreviewState).not.toBeNull();
    expect(getVisibleGameState(midStore)?.month).toBe(1);
    expect(getVisibleGameState(midStore)?.indicators.money).toBe(
      month1Before.indicators.money + midStore.pendingOutcome!.outcome.money_delta,
    );
    if (midStore.pendingOutcome!.outcome.money_delta !== 0) {
      expect(midStore.lastDeltas.money).toBe(midStore.pendingOutcome!.outcome.money_delta);
    } else {
      expect(midStore.lastDeltas.money).toBeUndefined();
    }

    // Canonical persisted state already advanced to Month 2
    expect(midStore.activeRun?.month).toBe(2);

    // Acknowledge outcome -> transitions visible state & deltas cleanly to Month 2
    useGameStore.getState().acknowledgeOutcome();
    const afterAck = useGameStore.getState();
    expect(afterAck.pendingOutcome).toBeNull();
    expect(afterAck.outcomePreviewState).toBeNull();
    expect(getVisibleGameState(afterAck)?.month).toBe(2);
    expect(afterAck.lastMonthStart?.month).toBe(2);

    // Continue stepping through until phase === 'quarterly_tax' at Month 3
    for (let guard = 0; guard < 8; guard += 1) {
      const run = useGameStore.getState().activeRun!;
      if (run.phase === "quarterly_tax" && useGameStore.getState().pendingOutcome === null) {
        break;
      }
      const view = getActiveEvent(run, compiledCatalog);
      expect(view).not.toBeNull();
      const eligibleChoice = view!.choices.find((c) => c.eligible);
      expect(eligibleChoice).toBeDefined();

      await useGameStore.getState().chooseOption(eligibleChoice!.choice.id);
      expect(useGameStore.getState().pendingOutcome).not.toBeNull();
      useGameStore.getState().acknowledgeOutcome();
      expect(useGameStore.getState().pendingOutcome).toBeNull();
    }

    expect(useGameStore.getState().activeRun?.month).toBe(3);
    expect(useGameStore.getState().activeRun?.phase).toBe("quarterly_tax");
    expect(useGameStore.getState().profile.achievements.primer_trimestre).toBeUndefined();

    await useGameStore.getState().settleQuarterlyTax("defer");
    expect(useGameStore.getState().profile.achievements.primer_trimestre).toBeDefined();
    const m4 = useGameStore.getState().activeRun!;
    expect(m4.month).toBe(4);
    expect(m4.finances.deferred_tax).not.toBeNull();
    expect(m4.finances.deferred_tax?.due_month).toBe(6);
  });

  it("restores exact GameState on re-hydration and clears active slot upon voluntary abandonment", async () => {
    const sharedStorage = createStorageAdapter(createMemoryStorageDriver());
    setGameStoreStoragePort(sharedStorage);

    await useGameStore.getState().startRun("FASE0-PERSIST-CHECK");
    const view = getActiveEvent(useGameStore.getState().activeRun!, compiledCatalog)!;
    await useGameStore.getState().chooseOption(view.choices[0]!.choice.id);
    useGameStore.getState().acknowledgeOutcome();

    const snapshotBeforeReload = structuredClone(useGameStore.getState().activeRun);
    expect(snapshotBeforeReload?.month).toBe(2);

    // Simulate fresh page boot against same storage driver
    useGameStore.setState({ activeRun: null, hydrated: false });
    await useGameStore.getState().hydrate();
    expect(useGameStore.getState().activeRun).toEqual(snapshotBeforeReload);

    // Abandon run -> archives to Hall of Fame and clears active slot
    await useGameStore.getState().abandonActiveRun("abandon_salaried");
    expect(useGameStore.getState().activeRun?.ending?.id).toBe("abandon_salaried");
    expect(useGameStore.getState().profile.hall_of_fame).toHaveLength(1);

    const diskSlot = await sharedStorage.loadActiveRun();
    expect(diskSlot.envelope).toBeNull();

    useGameStore.getState().returnToTitle();
    expect(useGameStore.getState().activeRun).toBeNull();
    expect(useUIStore.getState().screenView).toBe("title");
  });

  it("manages sfxMuted & fastPacing preferences safely and auto-acknowledges non-lethal outcomes in fastPacing", async () => {
    const mockBacking = new Map<string, string>();
    const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (k: string) => mockBacking.get(k) ?? null,
        setItem: (k: string, v: string) => {
          mockBacking.set(k, v);
        },
        removeItem: (k: string) => {
          mockBacking.delete(k);
        },
      },
    });

    try {
      expect(useUIStore.getState().sfxMuted).toBe(false);
      expect(useUIStore.getState().fastPacing).toBe(false);

      useUIStore.getState().toggleSfxMuted();
      expect(useUIStore.getState().sfxMuted).toBe(true);
      expect(mockBacking.get(SFX_MUTED_STORAGE_KEY)).toBe("true");

      useUIStore.getState().setSfxMuted(false);
      expect(useUIStore.getState().sfxMuted).toBe(false);
      expect(mockBacking.get(SFX_MUTED_STORAGE_KEY)).toBe("false");

      useUIStore.getState().toggleFastPacing();
      expect(useUIStore.getState().fastPacing).toBe(true);
      expect(mockBacking.get(FAST_PACING_STORAGE_KEY)).toBe("true");

      await useGameStore.getState().startRun("FASE2-FAST-PACING");
      const view = getActiveEvent(useGameStore.getState().activeRun!, compiledCatalog)!;
      const weighted = view.choices.find(
        (c) => c.eligible && c.choice.outcomes && c.choice.outcomes.length > 1,
      );
      if (weighted) {
        // Modo ágil 2.0 NEVER skips weighted RNG (Dices) gambles
        await useGameStore.getState().chooseOption(weighted.choice.id);
        expect(useGameStore.getState().pendingOutcome).not.toBeNull();
        useGameStore.getState().acknowledgeOutcome();
        expect(useGameStore.getState().pendingOutcome).toBeNull();
        expect(getVisibleGameState(useGameStore.getState())?.month).toBe(2);
      }

      // Deterministic eligible choices auto-acknowledge in Modo ágil 2.0
      const nextView = getActiveEvent(useGameStore.getState().activeRun!, compiledCatalog)!;
      const deterministic = nextView.choices.find(
        (c) => c.eligible && (!c.choice.outcomes || c.choice.outcomes.length <= 1),
      );
      expect(deterministic).toBeDefined();
      const monthBeforeDet = useGameStore.getState().activeRun!.month;
      await useGameStore.getState().chooseOption(deterministic!.choice.id);
      expect(useGameStore.getState().pendingOutcome).toBeNull();
      expect(useGameStore.getState().outcomePreviewState).toBeNull();
      expect(getVisibleGameState(useGameStore.getState())?.month).toBe(monthBeforeDet + 1);

      useUIStore.getState().setFastPacing(false);
      expect(useUIStore.getState().fastPacing).toBe(false);
      expect(mockBacking.get(FAST_PACING_STORAGE_KEY)).toBe("false");
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(globalThis, "localStorage", originalDescriptor);
      } else {
        Reflect.deleteProperty(globalThis, "localStorage");
      }
    }
  });

  it("auto-settles safe quarterly tax in Modo ágil 2.0, preserves fatal outcome saves across reload, and supports honorable retirement", async () => {
    const sharedStorage = createStorageAdapter(createMemoryStorageDriver());
    setGameStoreStoragePort(sharedStorage);
    useUIStore.getState().setFastPacing(true);

    await useGameStore.getState().startRun("FASE35-AUTO-QUARTER");
    // Boost cash so Month 3 Q1 has comfortable >= 1,200 € post-tax buffer
    useGameStore.setState((curr) => ({
      activeRun: curr.activeRun
        ? {
            ...curr.activeRun,
            indicators: { ...curr.activeRun.indicators, money: 9500 },
            fiscal_risk: 0,
          }
        : null,
    }));

    for (let guard = 0; guard < 8; guard += 1) {
      const run = useGameStore.getState().activeRun!;
      if (run.month >= 4) {
        break;
      }
      const view = getActiveEvent(run, compiledCatalog)!;
      const detChoice =
        view.choices.find(
          (c) => c.eligible && (!c.choice.outcomes || c.choice.outcomes.length <= 1),
        ) ?? view.choices.find((c) => c.eligible)!;
      await useGameStore.getState().chooseOption(detChoice.choice.id);
      if (useGameStore.getState().pendingOutcome) {
        useGameStore.getState().acknowledgeOutcome();
      }
    }

    expect(useGameStore.getState().activeRun?.month).toBe(4);
    expect(useGameStore.getState().lastAutoSettledQuarter?.quarter).toBe(1);
    expect(useGameStore.getState().lastAutoSettledQuarter?.month).toBe(3);

    // Pre-M120 run without victory seals cannot retire honorably
    expect(canRetireHonorably(useGameStore.getState().activeRun)).toBe(false);

    // Endless / M120+ run CAN retire honorably
    useGameStore.setState((curr) => ({
      activeRun: curr.activeRun
        ? {
            ...curr.activeRun,
            month: 124,
            endless_mode: true,
            earned_victories: ["hero_120m"],
          }
        : null,
    }));
    expect(canRetireHonorably(useGameStore.getState().activeRun)).toBe(true);
    await useGameStore.getState().retireActiveRun();
    expect(useGameStore.getState().activeRun?.phase).toBe("game_over");
    expect(useGameStore.getState().activeRun?.ending?.id).toBe("retired_hero");
    expect(useGameStore.getState().profile.hall_of_fame).toHaveLength(1);

    // Fatal outcome-panel persistence before acknowledgeOutcome, reload hydration -> continueRun -> acknowledgeOutcome -> EndRunScreen
    useUIStore.getState().setFastPacing(false);
    await useGameStore.getState().startRun("FASE35-FATAL-SAVE");
    useGameStore.setState((curr) => ({
      activeRun: curr.activeRun
        ? {
            ...curr.activeRun,
            indicators: { ...curr.activeRun.indicators, stress: 98 },
            current_turn_events: ["clientes_encargo_urgente"],
          }
        : null,
    }));
    const fatalRunId = useGameStore.getState().activeRun!.run_id;
    await useGameStore.getState().chooseOption("entrega_express_contado");

    const fatalBeforeReload = useGameStore.getState();
    expect(fatalBeforeReload.pendingOutcome).not.toBeNull();
    expect(fatalBeforeReload.pendingOutcome?.choiceId).toBe("entrega_express_contado");
    const expectedResultText = fatalBeforeReload.pendingOutcome?.outcome.result_text;
    expect(expectedResultText).toBeTruthy();

    // Visible GameScreen state reflects Month 1 fatal preview so outcome-continue-btn shows "Ver certificado final",
    // while activeRun stays resumable (phase !== 'game_over' && ending === null) for TitleScreen continue-run-btn!
    expect(getVisibleGameState(fatalBeforeReload)?.month).toBe(1);
    expect(getVisibleGameState(fatalBeforeReload)?.ending?.id).toBe("defeat_burnout_stress");
    expect(fatalBeforeReload.activeRun?.month).toBe(1);
    expect(fatalBeforeReload.activeRun?.phase).toBe("event_resolution");
    expect(fatalBeforeReload.activeRun?.ending).toBeNull();
    expect(
      fatalBeforeReload.profile.hall_of_fame.filter((h) => h.run_id === fatalRunId),
    ).toHaveLength(0);

    // Active run + pending_turn MUST still be persisted in IndexedDB BEFORE user clicks "Ver certificado final"
    const savedBeforeAck = await sharedStorage.loadActiveRun();
    expect(savedBeforeAck.envelope).not.toBeNull();
    expect(savedBeforeAck.envelope?.state.ending).toBeNull();
    expect(savedBeforeAck.envelope?.pending_turn?.pending_outcome.choiceId).toBe(
      "entrega_express_contado",
    );
    expect(savedBeforeAck.envelope?.pending_turn?.queued_final_state?.ending?.id).toBe(
      "defeat_burnout_stress",
    );

    // Returning to TitleScreen and clicking continueRun preserves the exact fatal outcome-panel
    useGameStore.getState().returnToTitle();
    expect(useUIStore.getState().screenView).toBe("title");
    expect(useGameStore.getState().pendingOutcome).not.toBeNull();
    useGameStore.getState().continueRun();
    expect(useUIStore.getState().screenView).toBe("game");
    expect(useGameStore.getState().pendingOutcome?.outcome.result_text).toBe(expectedResultText);

    // Simulate browser page.reload() during fatal outcome-panel -> TitleScreen -> continue-run-btn
    useGameStore.setState({
      activeRun: null,
      outcomePreviewState: null,
      queuedFinalState: null,
      pendingOutcome: null,
      hydrated: false,
    });
    useUIStore.setState({ screenView: "title" });
    await useGameStore.getState().hydrate();

    const afterHydrate = useGameStore.getState();
    expect(useUIStore.getState().screenView).toBe("title");
    expect(afterHydrate.activeRun?.month).toBe(1);
    expect(afterHydrate.activeRun?.phase).toBe("event_resolution");
    expect(afterHydrate.activeRun?.ending).toBeNull();
    expect(afterHydrate.pendingOutcome?.choiceId).toBe("entrega_express_contado");
    expect(afterHydrate.pendingOutcome?.outcome.result_text).toBe(expectedResultText);

    // Clicking continue-run-btn restores the exact pending fatal outcome-panel at Month 1
    useGameStore.getState().continueRun();
    expect(useUIStore.getState().screenView).toBe("game");
    expect(useGameStore.getState().pendingOutcome).not.toBeNull();
    expect(getVisibleGameState(useGameStore.getState())?.month).toBe(1);
    expect(getVisibleGameState(useGameStore.getState())?.ending?.id).toBe("defeat_burnout_stress");

    // Clicking outcome-continue-btn (acknowledgeOutcome) finalizes to EndRunScreen, clears active_run & archives once
    useGameStore.getState().acknowledgeOutcome();
    expect(useGameStore.getState().pendingOutcome).toBeNull();
    expect(useGameStore.getState().outcomePreviewState).toBeNull();
    expect(useGameStore.getState().queuedFinalState).toBeNull();
    expect(useGameStore.getState().activeRun?.phase).toBe("game_over");
    expect(useGameStore.getState().activeRun?.ending?.id).toBe("defeat_burnout_stress");

    // Flush queued async storage write by awaiting a serialized hydrate-safe storage check
    await new Promise((resolve) => setTimeout(resolve, 20));
    const savedAfterAck = await sharedStorage.loadActiveRun();
    expect(savedAfterAck.envelope).toBeNull();
    expect(
      useGameStore.getState().profile.hall_of_fame.filter((h) => h.run_id === fatalRunId),
    ).toHaveLength(1);
  });
});
