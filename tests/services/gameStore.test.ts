import { beforeEach, describe, expect, it } from "vitest";
import { getActiveEvent } from "../../src/engine/index.ts";
import { compiledCatalog } from "../../src/services/content/catalog.ts";
import {
  createMemoryStorageDriver,
  createStorageAdapter,
} from "../../src/services/storage/index.ts";
import {
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
    expect(useGameStore.getState().profile.achievements.primer_trimestre).toBeDefined();

    await useGameStore.getState().settleQuarterlyTax("defer");
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
      const eligible = view.choices.find((c) => c.eligible)!;

      await useGameStore.getState().chooseOption(eligible.choice.id);
      expect(useGameStore.getState().pendingOutcome).toBeNull();
      expect(useGameStore.getState().outcomePreviewState).toBeNull();
      expect(getVisibleGameState(useGameStore.getState())?.month).toBe(2);

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
});
