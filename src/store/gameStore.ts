import { create } from "zustand";
import {
  type AbandonEndingId,
  type ChoiceOutcomeSummary,
  type EventDef,
  type GameState,
  type Indicators,
  type MonthStartSummary,
  type QuarterlySettlementMode,
  type VictoryDecision,
  appendHistory,
  applyPlayerChoice,
  dismissAnnualSummary,
  getActiveEvent,
  resolveEndingQuote,
  resolveVictoryPrompt,
  settleQuarter,
  startNewRun,
} from "../engine/index.ts";
import { compiledCatalog } from "../services/content/catalog.ts";
import { resolveChoiceLabel } from "../services/i18n/resolveEventText.ts";
import { defaultPlatformAdapter } from "../services/platform/PlatformPort.ts";
import {
  type AchievementId,
  type ProfileEnvelope,
  type StoragePort,
  createDefaultProfileEnvelope,
  defaultStorageAdapter,
} from "../services/storage/index.ts";
import { useUIStore } from "./uiStore.ts";

export interface PendingOutcomeView {
  event: EventDef;
  choiceId: string;
  choiceLabel: string;
  outcome: ChoiceOutcomeSummary;
}

export type IndicatorDeltas = Partial<Record<keyof Indicators, number>>;

function diffIndicators(prev: Indicators, next: Indicators): IndicatorDeltas {
  const deltas: IndicatorDeltas = {};
  const keys: (keyof Indicators)[] = ["money", "moral", "stress", "personal_life", "reputation"];
  for (const key of keys) {
    const diff = next[key] - prev[key];
    if (diff !== 0) {
      deltas[key] = diff;
    }
  }
  return deltas;
}

let activeStoragePort: StoragePort = defaultStorageAdapter;

export function setGameStoreStoragePort(port: StoragePort): void {
  activeStoragePort = port;
}

export interface GameStoreState {
  hydrated: boolean;
  hydrating: boolean;
  activeRun: GameState | null;
  profile: ProfileEnvelope;
  corruptedSaveNotice: string | null;
  pendingOutcome: PendingOutcomeView | null;
  lastMonthStart: MonthStartSummary | null;
  lastDeltas: IndicatorDeltas;
  newlyUnlockedAchievements: AchievementId[];
  hydrate: () => Promise<void>;
  startRun: (seed?: string) => Promise<void>;
  continueRun: () => void;
  chooseOption: (choiceId: string) => Promise<void>;
  acknowledgeOutcome: () => void;
  settleQuarterlyTax: (mode: QuarterlySettlementMode) => Promise<void>;
  decideVictory: (decision: VictoryDecision) => Promise<void>;
  closeAnnualSummary: () => Promise<void>;
  abandonActiveRun: (endingId?: AbandonEndingId) => Promise<void>;
  returnToTitle: () => void;
  dismissCorruptNotice: () => void;
  clearUnlockedToastQueue: () => void;
  setReducedMotionPreference: (value: boolean | null) => Promise<void>;
}

export const useGameStore = create<GameStoreState>((set, get) => ({
  hydrated: false,
  hydrating: false,
  activeRun: null,
  profile: createDefaultProfileEnvelope(),
  corruptedSaveNotice: null,
  pendingOutcome: null,
  lastMonthStart: null,
  lastDeltas: {},
  newlyUnlockedAchievements: [],

  hydrate: async () => {
    if (get().hydrating) {
      return;
    }
    set({ hydrating: true });

    void defaultPlatformAdapter.requestPersistentStorage();

    const [profile, loadedRun] = await Promise.all([
      activeStoragePort.loadProfile(),
      activeStoragePort.loadActiveRun(),
    ]);

    useUIStore.getState().setReducedMotionOverride(profile.settings.reduced_motion);

    set({
      hydrated: true,
      hydrating: false,
      profile,
      activeRun: loadedRun.envelope?.state ?? null,
      corruptedSaveNotice: loadedRun.corruptedRecovery?.reason ?? null,
      pendingOutcome: null,
      lastMonthStart: null,
      lastDeltas: {},
    });
  },

  startRun: async (seed?: string) => {
    const cleanSeed = seed?.trim() ? seed.trim() : undefined;
    const { state, resolution } = startNewRun(compiledCatalog, { seed: cleanSeed });

    useUIStore.getState().resetForRunEntry();

    set({
      activeRun: state,
      pendingOutcome: null,
      lastMonthStart: resolution.monthStart ?? null,
      lastDeltas: {},
    });

    const synced = await activeStoragePort.syncRunProgress(state);
    set((curr) => ({
      profile: synced.profile,
      newlyUnlockedAchievements:
        synced.newlyUnlocked.length > 0
          ? [...curr.newlyUnlockedAchievements, ...synced.newlyUnlocked]
          : curr.newlyUnlockedAchievements,
    }));
  },

  continueRun: () => {
    const current = get().activeRun;
    if (!current || current.ending !== null) {
      return;
    }
    useUIStore.getState().resetForRunEntry();
  },

  chooseOption: async (choiceId: string) => {
    const current = get().activeRun;
    if (!current || current.phase !== "event_resolution" || get().pendingOutcome !== null) {
      return;
    }

    const activeView = getActiveEvent(current, compiledCatalog);
    if (!activeView) {
      return;
    }

    const matchedChoice = activeView.choices.find((entry) => entry.choice.id === choiceId);
    if (!matchedChoice || !matchedChoice.eligible) {
      return;
    }

    const locale = get().profile.settings.locale;
    const prevIndicators = current.indicators;
    const { state: nextState, resolution } = applyPlayerChoice(current, compiledCatalog, choiceId);
    const deltas = diffIndicators(prevIndicators, nextState.indicators);

    const pendingOutcome: PendingOutcomeView | null = resolution.choiceOutcome
      ? {
          event: activeView.event,
          choiceId,
          choiceLabel: resolveChoiceLabel(activeView.event.id, matchedChoice.choice, locale),
          outcome: resolution.choiceOutcome,
        }
      : null;

    set((curr) => ({
      activeRun: nextState,
      pendingOutcome,
      lastMonthStart: resolution.monthStart ?? curr.lastMonthStart,
      lastDeltas: deltas,
    }));

    const synced = await activeStoragePort.syncRunProgress(nextState);
    set((curr) => ({
      profile: synced.profile,
      newlyUnlockedAchievements:
        synced.newlyUnlocked.length > 0
          ? [...curr.newlyUnlockedAchievements, ...synced.newlyUnlocked]
          : curr.newlyUnlockedAchievements,
    }));
  },

  acknowledgeOutcome: () => {
    set({ pendingOutcome: null });
  },

  settleQuarterlyTax: async (mode: QuarterlySettlementMode) => {
    const current = get().activeRun;
    if (!current || current.phase !== "quarterly_tax") {
      return;
    }

    const prevIndicators = current.indicators;
    const { state: nextState, resolution } = settleQuarter(current, compiledCatalog, mode);
    const deltas = diffIndicators(prevIndicators, nextState.indicators);

    set((curr) => ({
      activeRun: nextState,
      pendingOutcome: null,
      lastMonthStart: resolution.monthStart ?? curr.lastMonthStart,
      lastDeltas: deltas,
    }));

    const synced = await activeStoragePort.syncRunProgress(nextState);
    set((curr) => ({
      profile: synced.profile,
      newlyUnlockedAchievements:
        synced.newlyUnlocked.length > 0
          ? [...curr.newlyUnlockedAchievements, ...synced.newlyUnlocked]
          : curr.newlyUnlockedAchievements,
    }));
  },

  decideVictory: async (decision: VictoryDecision) => {
    const current = get().activeRun;
    if (!current || current.phase !== "victory_prompt") {
      return;
    }

    const prevIndicators = current.indicators;
    const { state: nextState, resolution } = resolveVictoryPrompt(
      current,
      compiledCatalog,
      decision,
    );
    const deltas = diffIndicators(prevIndicators, nextState.indicators);

    set((curr) => ({
      activeRun: nextState,
      pendingOutcome: null,
      lastMonthStart: resolution.monthStart ?? curr.lastMonthStart,
      lastDeltas: deltas,
    }));

    const synced = await activeStoragePort.syncRunProgress(nextState);
    set((curr) => ({
      profile: synced.profile,
      newlyUnlockedAchievements:
        synced.newlyUnlocked.length > 0
          ? [...curr.newlyUnlockedAchievements, ...synced.newlyUnlocked]
          : curr.newlyUnlockedAchievements,
    }));
  },

  closeAnnualSummary: async () => {
    const current = get().activeRun;
    if (!current || current.phase !== "annual_summary") {
      return;
    }

    const prevIndicators = current.indicators;
    const { state: nextState, resolution } = dismissAnnualSummary(current, compiledCatalog);
    const deltas = diffIndicators(prevIndicators, nextState.indicators);

    set((curr) => ({
      activeRun: nextState,
      pendingOutcome: null,
      lastMonthStart: resolution.monthStart ?? curr.lastMonthStart,
      lastDeltas: deltas,
    }));

    const synced = await activeStoragePort.syncRunProgress(nextState);
    set((curr) => ({
      profile: synced.profile,
      newlyUnlockedAchievements:
        synced.newlyUnlocked.length > 0
          ? [...curr.newlyUnlockedAchievements, ...synced.newlyUnlocked]
          : curr.newlyUnlockedAchievements,
    }));
  },

  abandonActiveRun: async (endingId: AbandonEndingId = "abandon_oposiciones") => {
    const current = get().activeRun;
    if (!current || current.ending !== null) {
      return;
    }

    const quote = resolveEndingQuote(compiledCatalog, endingId);
    const endedState: GameState = {
      ...current,
      phase: "game_over",
      ending: {
        id: endingId,
        month: current.month,
        summary_quote: quote,
      },
      history: appendHistory(
        current.history,
        {
          id: `hist_abandon_${current.month}_${endingId}`,
          month: current.month,
          kind: "game_over",
          summary: quote,
        },
        compiledCatalog.balance.max_history_entries,
      ),
    };

    useUIStore.getState().setAbandonModalOpen(false);
    useUIStore.getState().setScreenView("game");

    set({
      activeRun: endedState,
      pendingOutcome: null,
      lastDeltas: {},
    });

    const synced = await activeStoragePort.syncRunProgress(endedState);
    set((curr) => ({
      profile: synced.profile,
      newlyUnlockedAchievements:
        synced.newlyUnlocked.length > 0
          ? [...curr.newlyUnlockedAchievements, ...synced.newlyUnlocked]
          : curr.newlyUnlockedAchievements,
    }));
  },

  returnToTitle: () => {
    const current = get().activeRun;
    useUIStore.getState().setAbandonModalOpen(false);
    useUIStore.getState().setScreenView("title");

    if (current && current.ending !== null) {
      set({
        activeRun: null,
        pendingOutcome: null,
        lastDeltas: {},
      });
    } else {
      set({
        pendingOutcome: null,
      });
    }
  },

  dismissCorruptNotice: () => set({ corruptedSaveNotice: null }),

  clearUnlockedToastQueue: () => set({ newlyUnlockedAchievements: [] }),

  setReducedMotionPreference: async (value: boolean | null) => {
    useUIStore.getState().setReducedMotionOverride(value);
    const nextProfile: ProfileEnvelope = {
      ...get().profile,
      settings: {
        ...get().profile.settings,
        reduced_motion: value,
      },
    };
    set({ profile: nextProfile });
    await activeStoragePort.saveProfile(nextProfile);
  },
}));
