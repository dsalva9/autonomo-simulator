import { beforeEach, describe, expect, it } from "vitest";
import { getActiveEvent } from "../../src/engine/index.ts";
import { compiledCatalog } from "../../src/services/content/catalog.ts";
import {
  createMemoryStorageDriver,
  createStorageAdapter,
} from "../../src/services/storage/index.ts";
import { setGameStoreStoragePort, useGameStore } from "../../src/store/gameStore.ts";
import { useUIStore } from "../../src/store/uiStore.ts";

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
      toast: null,
    });
    await useGameStore.getState().hydrate();
  });

  it("captures pendingOutcome on choice, advances to Month 3 Trimestre, settles tax, and unlocks primer_trimestre", async () => {
    await useGameStore.getState().startRun("FASE0-STORE-FLOW");
    expect(useUIStore.getState().screenView).toBe("game");
    expect(useGameStore.getState().activeRun?.month).toBe(1);

    // Step through until phase === 'quarterly_tax' at Month 3
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
});
