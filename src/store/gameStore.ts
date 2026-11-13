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
  createInitialGameState,
  dismissAnnualSummary,
  getActiveEvent,
  resolveEndingQuote,
  resolveVictoryPrompt,
  retireFromRun,
  settleQuarter,
  startNewRun,
} from "../engine/index.ts";
import { compiledCatalog } from "../services/content/catalog.ts";
import {
  type UILocale,
  normalizeLocale,
  resolveChoiceLabel,
} from "../services/i18n/resolveEventText.ts";
import { defaultPlatformAdapter } from "../services/platform/PlatformPort.ts";
import {
  type AchievementId,
  type PastRunSummary,
  type PersistedPendingTurn,
  type ProfileEnvelope,
  type SaveActiveRunOptions,
  type StoragePort,
  type SyncRunProgressResult,
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

export interface AutoSettledQuarterInfo {
  quarter: number;
  month: number;
  paidAmount: number;
}

export type IndicatorDeltas = Partial<Record<keyof Indicators, number>>;

const FAST_PACING_AUTO_SETTLE_MIN_BUFFER = 1200;
const LAST_MONTH_START_STORAGE_KEY = "autonomo:last_month_start";

interface StoredLastMonthStartPayload {
  run_id: string;
  month: number;
  summary: MonthStartSummary;
}

function readStoredLastMonthStart(runId: string, month: number): MonthStartSummary | null {
  try {
    if (typeof globalThis.localStorage === "undefined") {
      return null;
    }
    const raw = globalThis.localStorage.getItem(LAST_MONTH_START_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<StoredLastMonthStartPayload>;
    if (
      parsed &&
      parsed.run_id === runId &&
      parsed.month === month &&
      parsed.summary &&
      typeof parsed.summary === "object" &&
      parsed.summary.month === month
    ) {
      return parsed.summary;
    }
    return null;
  } catch {
    return null;
  }
}

function writeStoredLastMonthStart(
  runId: string | null | undefined,
  summary: MonthStartSummary | null | undefined,
): void {
  try {
    if (typeof globalThis.localStorage === "undefined" || !runId || !summary) {
      return;
    }
    const payload: StoredLastMonthStartPayload = {
      run_id: runId,
      month: summary.month,
      summary,
    };
    globalThis.localStorage.setItem(LAST_MONTH_START_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage quota / private mode / Node SecurityError exceptions
  }
}

function clearStoredLastMonthStart(): void {
  try {
    if (typeof globalThis.localStorage === "undefined") {
      return;
    }
    globalThis.localStorage.removeItem(LAST_MONTH_START_STORAGE_KEY);
  } catch {
    // Ignore storage exceptions
  }
}

function shouldRetainAutoSettledQuarter(
  info: AutoSettledQuarterInfo | null,
  nextState: GameState,
): AutoSettledQuarterInfo | null {
  if (!info || nextState.ending !== null) {
    return null;
  }
  if (info.month === nextState.month || info.month === nextState.month - 1) {
    return info;
  }
  return null;
}

function buildPastRunCertificateState(entry: PastRunSummary): GameState {
  const base = createInitialGameState(compiledCatalog, {
    seed: entry.seed,
    runId: entry.run_id,
  });
  return {
    ...base,
    month: entry.months_survived,
    phase: "game_over",
    indicators: {
      ...base.indicators,
      money: entry.final_money,
    },
    finances: {
      ...base.finances,
      lifetime_billed: entry.lifetime_billed,
    },
    earned_victories: [...entry.earned_victories],
    endless_mode: entry.endless_mode,
    ending: {
      id: entry.ending_id,
      month: entry.months_survived,
      summary_quote: entry.summary_quote,
    },
  };
}

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
let storageQueue: Promise<unknown> = Promise.resolve();

function enqueueStorage<T>(task: () => Promise<T>): Promise<T> {
  const next = storageQueue.then(task, task);
  storageQueue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

export function setGameStoreStoragePort(port: StoragePort): void {
  activeStoragePort = port;
  storageQueue = Promise.resolve();
}

export function canRetireHonorably(state: GameState | null): boolean {
  return Boolean(
    state &&
      state.phase !== "game_over" &&
      (state.endless_mode || state.earned_victories.length > 0),
  );
}

function tryAutoSettleQuarterlyTax(state: GameState): {
  state: GameState;
  autoSettled: AutoSettledQuarterInfo | null;
  monthStart: MonthStartSummary | null;
} {
  if (state.phase !== "quarterly_tax" || !state.quarterly_report) {
    return { state, autoSettled: null, monthStart: null };
  }

  const report = state.quarterly_report;
  const totalDue =
    (report.accrued_tax_due ?? 0) +
    (report.deferred_tax_due ?? 0) +
    (report.gestor_error_surcharge ?? 0) +
    (report.inspection_fallback_fine ?? 0);

  if (
    !report.inspection_triggered &&
    state.indicators.money - totalDue >= FAST_PACING_AUTO_SETTLE_MIN_BUFFER
  ) {
    const settled = settleQuarter(state, compiledCatalog, "pay");
    const paidAmount =
      settled.resolution.quarterlySettlement?.paid_amount ??
      (report.accrued_tax_due ?? 0) + (report.deferred_tax_due ?? 0);
    return {
      state: settled.state,
      autoSettled: {
        quarter: report.quarter,
        month: report.month,
        paidAmount,
      },
      monthStart: settled.resolution.monthStart ?? null,
    };
  }

  return { state, autoSettled: null, monthStart: null };
}

function buildRetiredRunState(current: GameState): GameState {
  return retireFromRun(current, compiledCatalog).state;
}

export interface GameStoreState {
  hydrated: boolean;
  hydrating: boolean;
  activeRun: GameState | null;
  outcomePreviewState: GameState | null;
  viewingCertificateRun: GameState | null;
  queuedFinalState: GameState | null;
  queuedPostOutcomeDeltas: IndicatorDeltas | null;
  queuedMonthStart: MonthStartSummary | null;
  profile: ProfileEnvelope;
  corruptedSaveNotice: string | null;
  pendingOutcome: PendingOutcomeView | null;
  lastMonthStart: MonthStartSummary | null;
  lastDeltas: IndicatorDeltas;
  lastChoiceImmediateDeltas: IndicatorDeltas;
  lastAutoSettledQuarter: AutoSettledQuarterInfo | null;
  newlyUnlockedAchievements: AchievementId[];
  hydrate: () => Promise<void>;
  startRun: (seed?: string) => Promise<void>;
  continueRun: () => void;
  openPastRunCertificate: (entry: PastRunSummary) => void;
  chooseOption: (choiceId: string) => Promise<void>;
  acknowledgeOutcome: () => void;
  settleQuarterlyTax: (mode: QuarterlySettlementMode) => Promise<void>;
  decideVictory: (decision: VictoryDecision) => Promise<void>;
  closeAnnualSummary: () => Promise<void>;
  abandonActiveRun: (endingId?: AbandonEndingId) => Promise<void>;
  retireActiveRun: () => Promise<void>;
  returnToTitle: () => void;
  dismissCorruptNotice: () => void;
  clearUnlockedToastQueue: () => void;
  setReducedMotionPreference: (value: boolean | null) => Promise<void>;
  setLocalePreference: (locale: UILocale) => Promise<void>;
  toggleLocalePreference: () => Promise<void>;
}

export function getVisibleGameState(store: {
  activeRun: GameState | null;
  outcomePreviewState: GameState | null;
  viewingCertificateRun?: GameState | null;
}): GameState | null {
  return store.viewingCertificateRun ?? store.outcomePreviewState ?? store.activeRun;
}

export const useGameStore = create<GameStoreState>((set, get) => {
  const applySyncedResult = (synced: SyncRunProgressResult) => {
    set((curr) => ({
      profile: synced.profile,
      newlyUnlockedAchievements:
        synced.newlyUnlocked.length > 0
          ? [...curr.newlyUnlockedAchievements, ...synced.newlyUnlocked]
          : curr.newlyUnlockedAchievements,
    }));
  };

  const syncStateProgress = async (
    state: GameState,
    options?: SaveActiveRunOptions,
  ): Promise<void> => {
    const synced = await enqueueStorage(() =>
      activeStoragePort.syncRunProgress(state, undefined, options),
    );
    applySyncedResult(synced);
  };

  return {
    hydrated: false,
    hydrating: false,
    activeRun: null,
    outcomePreviewState: null,
    viewingCertificateRun: null,
    queuedFinalState: null,
    queuedPostOutcomeDeltas: null,
    queuedMonthStart: null,
    profile: createDefaultProfileEnvelope(),
    corruptedSaveNotice: null,
    pendingOutcome: null,
    lastMonthStart: null,
    lastDeltas: {},
    lastChoiceImmediateDeltas: {},
    lastAutoSettledQuarter: null,
    newlyUnlockedAchievements: [],

    hydrate: async () => {
      if (get().hydrating) {
        return;
      }
      set({ hydrating: true });

      void defaultPlatformAdapter.requestPersistentStorage();

      const [loadedProfile, loadedRun] = await enqueueStorage(() =>
        Promise.all([activeStoragePort.loadProfile(), activeStoragePort.loadActiveRun()]),
      );

      let resolvedProfile = loadedProfile;
      let extraUnlocked: AchievementId[] = [];
      const hydratedRun = loadedRun.envelope?.state ?? null;
      const hydratedPendingTurn = loadedRun.envelope?.pending_turn ?? null;

      useUIStore.getState().setReducedMotionOverride(resolvedProfile.settings.reduced_motion);

      if (
        hydratedRun &&
        !hydratedPendingTurn &&
        (hydratedRun.phase === "game_over" || hydratedRun.ending !== null)
      ) {
        clearStoredLastMonthStart();
        const synced = await enqueueStorage(() => activeStoragePort.syncRunProgress(hydratedRun));
        resolvedProfile = synced.profile;
        extraUnlocked = synced.newlyUnlocked;
        useUIStore.getState().resetForRunEntry();
      }

      let restoredPendingOutcome: PendingOutcomeView | null = null;
      if (hydratedRun && hydratedPendingTurn) {
        const rawPending = hydratedPendingTurn.pending_outcome;
        const catalogEvent =
          compiledCatalog.events.find((ev) => ev.id === rawPending.event.id) ?? rawPending.event;
        const matchedChoiceObj = catalogEvent.choices.find((c) => c.id === rawPending.choiceId);
        restoredPendingOutcome = {
          event: catalogEvent,
          choiceId: rawPending.choiceId,
          choiceLabel: matchedChoiceObj
            ? resolveChoiceLabel(catalogEvent.id, matchedChoiceObj, resolvedProfile.settings.locale)
            : rawPending.choiceLabel,
          outcome: rawPending.outcome,
        };
      }

      const restoredLastMonthStart =
        hydratedPendingTurn?.last_month_start ??
        (hydratedRun ? readStoredLastMonthStart(hydratedRun.run_id, hydratedRun.month) : null);

      set((curr) => ({
        hydrated: true,
        hydrating: false,
        profile: resolvedProfile,
        activeRun: hydratedRun,
        outcomePreviewState: hydratedPendingTurn?.outcome_preview_state ?? null,
        viewingCertificateRun: null,
        queuedFinalState: hydratedPendingTurn?.queued_final_state ?? null,
        queuedPostOutcomeDeltas: hydratedPendingTurn?.queued_post_outcome_deltas ?? null,
        queuedMonthStart: hydratedPendingTurn?.queued_month_start ?? null,
        corruptedSaveNotice: loadedRun.corruptedRecovery?.reason ?? null,
        pendingOutcome: restoredPendingOutcome,
        lastMonthStart: restoredLastMonthStart,
        lastDeltas: hydratedPendingTurn?.last_deltas ?? {},
        lastChoiceImmediateDeltas: hydratedPendingTurn?.last_deltas ?? {},
        lastAutoSettledQuarter: null,
        newlyUnlockedAchievements:
          extraUnlocked.length > 0
            ? [...curr.newlyUnlockedAchievements, ...extraUnlocked]
            : curr.newlyUnlockedAchievements,
      }));
    },

    startRun: async (seed?: string) => {
      const pendingFatal = get().queuedFinalState;
      const cleanSeed = seed?.trim() ? seed.trim() : undefined;
      const { state, resolution } = startNewRun(compiledCatalog, { seed: cleanSeed });

      useUIStore.getState().resetForRunEntry();
      writeStoredLastMonthStart(state.run_id, resolution.monthStart ?? null);

      set({
        activeRun: state,
        outcomePreviewState: null,
        viewingCertificateRun: null,
        queuedFinalState: null,
        queuedPostOutcomeDeltas: null,
        queuedMonthStart: null,
        pendingOutcome: null,
        lastMonthStart: resolution.monthStart ?? null,
        lastDeltas: {},
        lastChoiceImmediateDeltas: {},
        lastAutoSettledQuarter: null,
      });

      if (pendingFatal !== null) {
        await syncStateProgress(pendingFatal);
      }
      await syncStateProgress(state);
    },

    continueRun: () => {
      const current = get().activeRun;
      if (!current) {
        return;
      }
      set({ viewingCertificateRun: null });
      useUIStore.getState().resetForRunEntry();
    },

    openPastRunCertificate: (entry: PastRunSummary) => {
      const certState = buildPastRunCertificateState(entry);
      set({ viewingCertificateRun: certState });
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
      const { state: nextState, resolution } = applyPlayerChoice(
        current,
        compiledCatalog,
        choiceId,
      );
      const rawPostChoice = resolution.postChoiceState ?? nextState;
      const previewState: GameState =
        nextState.month === rawPostChoice.month
          ? {
              ...rawPostChoice,
              phase: nextState.phase,
              ending: nextState.ending ?? rawPostChoice.ending,
            }
          : rawPostChoice;

      const choiceDeltas = diffIndicators(prevIndicators, rawPostChoice.indicators);
      const postOutcomeDeltas = diffIndicators(rawPostChoice.indicators, nextState.indicators);

      const isWeightedChoice = Boolean(
        matchedChoice.choice.outcomes && matchedChoice.choice.outcomes.length > 1,
      );
      const fastPacing = useUIStore.getState().fastPacing;
      const autoAcknowledge = fastPacing && !isWeightedChoice && nextState.ending === null;

      const pendingOutcome: PendingOutcomeView | null =
        !autoAcknowledge && resolution.choiceOutcome
          ? {
              event: activeView.event,
              choiceId,
              choiceLabel: resolveChoiceLabel(activeView.event.id, matchedChoice.choice, locale),
              outcome: resolution.choiceOutcome,
            }
          : null;

      if (pendingOutcome) {
        const isFatalOutcome = nextState.phase === "game_over" || nextState.ending !== null;
        const persistedState: GameState = isFatalOutcome
          ? {
              ...rawPostChoice,
              phase: "event_resolution",
              ending: null,
            }
          : nextState;
        const queuedFinalState: GameState | null = isFatalOutcome ? nextState : null;
        const priorLastMonthStart = get().lastMonthStart;
        const pendingTurnPayload: PersistedPendingTurn = {
          pending_outcome: pendingOutcome,
          outcome_preview_state: previewState,
          queued_final_state: queuedFinalState,
          queued_post_outcome_deltas: postOutcomeDeltas,
          queued_month_start: resolution.monthStart ?? null,
          last_deltas: choiceDeltas,
          last_month_start: priorLastMonthStart,
        };

        set((curr) => ({
          activeRun: persistedState,
          pendingOutcome,
          outcomePreviewState: previewState,
          queuedFinalState,
          queuedPostOutcomeDeltas: postOutcomeDeltas,
          queuedMonthStart: resolution.monthStart ?? null,
          lastMonthStart: curr.lastMonthStart,
          lastDeltas: choiceDeltas,
          lastChoiceImmediateDeltas: choiceDeltas,
          lastAutoSettledQuarter: null,
        }));

        if (isFatalOutcome) {
          await enqueueStorage(() =>
            activeStoragePort.saveActiveRun(persistedState, undefined, {
              pendingTurn: pendingTurnPayload,
            }),
          );
        } else {
          await syncStateProgress(persistedState, { pendingTurn: pendingTurnPayload });
        }
        return;
      }

      const autoQ =
        fastPacing && nextState.phase === "quarterly_tax"
          ? tryAutoSettleQuarterlyTax(nextState)
          : { state: nextState, autoSettled: null, monthStart: null };

      const finalState = autoQ.state;
      const totalDeltas = diffIndicators(prevIndicators, finalState.indicators);
      const visibleDeltas: IndicatorDeltas =
        Object.keys(choiceDeltas).length > 0
          ? autoQ.autoSettled !== null &&
            totalDeltas.money !== undefined &&
            choiceDeltas.money === undefined
            ? { ...choiceDeltas, money: totalDeltas.money }
            : choiceDeltas
          : totalDeltas;
      const resolvedMonthStart = autoQ.monthStart ?? resolution.monthStart ?? get().lastMonthStart;

      if (finalState.ending !== null) {
        clearStoredLastMonthStart();
      } else {
        writeStoredLastMonthStart(finalState.run_id, resolvedMonthStart);
      }

      set({
        activeRun: finalState,
        pendingOutcome: null,
        outcomePreviewState: null,
        queuedFinalState: null,
        queuedPostOutcomeDeltas: null,
        queuedMonthStart: null,
        lastMonthStart: resolvedMonthStart,
        lastDeltas: visibleDeltas,
        lastChoiceImmediateDeltas: choiceDeltas,
        lastAutoSettledQuarter: autoQ.autoSettled,
      });

      await syncStateProgress(finalState);
    },

    acknowledgeOutcome: () => {
      const snapshot = get();
      const activeRun = snapshot.activeRun;
      if (!activeRun) {
        return;
      }

      const finalEndedState =
        snapshot.queuedFinalState ??
        (activeRun.phase === "game_over" || activeRun.ending !== null ? activeRun : null);

      if (finalEndedState !== null) {
        clearStoredLastMonthStart();
        set((curr) => ({
          activeRun: finalEndedState,
          pendingOutcome: null,
          outcomePreviewState: null,
          queuedFinalState: null,
          queuedPostOutcomeDeltas: null,
          queuedMonthStart: null,
          lastDeltas: curr.lastDeltas,
          lastAutoSettledQuarter: null,
        }));
        void syncStateProgress(finalEndedState);
        return;
      }

      if (useUIStore.getState().fastPacing && activeRun.phase === "quarterly_tax") {
        const autoQ = tryAutoSettleQuarterlyTax(activeRun);
        if (autoQ.autoSettled !== null) {
          const deltas = diffIndicators(activeRun.indicators, autoQ.state.indicators);
          const nextMonthStart =
            autoQ.monthStart ?? snapshot.queuedMonthStart ?? snapshot.lastMonthStart;
          writeStoredLastMonthStart(autoQ.state.run_id, nextMonthStart);
          set({
            activeRun: autoQ.state,
            pendingOutcome: null,
            outcomePreviewState: null,
            queuedFinalState: null,
            queuedPostOutcomeDeltas: null,
            queuedMonthStart: null,
            lastMonthStart: nextMonthStart,
            lastDeltas: deltas,
            lastAutoSettledQuarter: autoQ.autoSettled,
          });
          void syncStateProgress(autoQ.state);
          return;
        }
      }

      set((curr) => {
        const monthAdvanced =
          curr.activeRun !== null &&
          curr.outcomePreviewState !== null &&
          curr.activeRun.month !== curr.outcomePreviewState.month;
        const hasSameMonthPostDeltas =
          curr.queuedPostOutcomeDeltas !== null &&
          Object.keys(curr.queuedPostOutcomeDeltas).length > 0;
        const nextMonthStart = monthAdvanced
          ? (curr.queuedMonthStart ?? curr.lastMonthStart)
          : curr.lastMonthStart;
        writeStoredLastMonthStart(curr.activeRun?.run_id, nextMonthStart);

        return {
          pendingOutcome: null,
          outcomePreviewState: null,
          queuedFinalState: null,
          queuedPostOutcomeDeltas: null,
          queuedMonthStart: null,
          lastAutoSettledQuarter: null,
          lastDeltas: monthAdvanced
            ? (curr.queuedPostOutcomeDeltas ?? {})
            : hasSameMonthPostDeltas
              ? (curr.queuedPostOutcomeDeltas ?? curr.lastDeltas)
              : curr.lastDeltas,
          lastMonthStart: nextMonthStart,
        };
      });
      void syncStateProgress(activeRun);
    },

    settleQuarterlyTax: async (mode: QuarterlySettlementMode) => {
      const current = get().activeRun;
      if (!current || current.phase !== "quarterly_tax") {
        return;
      }

      const prevIndicators = current.indicators;
      const { state: nextState, resolution } = settleQuarter(current, compiledCatalog, mode);
      const deltas = diffIndicators(prevIndicators, nextState.indicators);
      const nextMonthStart = resolution.monthStart ?? get().lastMonthStart;
      if (nextState.ending !== null) {
        clearStoredLastMonthStart();
      } else {
        writeStoredLastMonthStart(nextState.run_id, nextMonthStart);
      }

      set({
        activeRun: nextState,
        outcomePreviewState: null,
        queuedFinalState: null,
        queuedPostOutcomeDeltas: null,
        queuedMonthStart: null,
        pendingOutcome: null,
        lastMonthStart: nextMonthStart,
        lastDeltas: deltas,
        lastChoiceImmediateDeltas: {},
        lastAutoSettledQuarter: null,
      });

      await syncStateProgress(nextState);
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
      const nextMonthStart = resolution.monthStart ?? get().lastMonthStart;
      if (nextState.ending !== null) {
        clearStoredLastMonthStart();
      } else {
        writeStoredLastMonthStart(nextState.run_id, nextMonthStart);
      }

      set((curr) => ({
        activeRun: nextState,
        outcomePreviewState: null,
        queuedFinalState: null,
        queuedPostOutcomeDeltas: null,
        queuedMonthStart: null,
        pendingOutcome: null,
        lastMonthStart: nextMonthStart,
        lastDeltas: deltas,
        lastChoiceImmediateDeltas: {},
        lastAutoSettledQuarter: shouldRetainAutoSettledQuarter(
          curr.lastAutoSettledQuarter,
          nextState,
        ),
      }));

      await syncStateProgress(nextState);
    },

    closeAnnualSummary: async () => {
      const current = get().activeRun;
      if (!current || current.phase !== "annual_summary") {
        return;
      }

      const prevIndicators = current.indicators;
      const { state: nextState, resolution } = dismissAnnualSummary(current, compiledCatalog);
      const deltas = diffIndicators(prevIndicators, nextState.indicators);
      const nextMonthStart = resolution.monthStart ?? get().lastMonthStart;
      if (nextState.ending !== null) {
        clearStoredLastMonthStart();
      } else {
        writeStoredLastMonthStart(nextState.run_id, nextMonthStart);
      }

      set((curr) => ({
        activeRun: nextState,
        outcomePreviewState: null,
        queuedFinalState: null,
        queuedPostOutcomeDeltas: null,
        queuedMonthStart: null,
        pendingOutcome: null,
        lastMonthStart: nextMonthStart,
        lastDeltas: deltas,
        lastChoiceImmediateDeltas: {},
        lastAutoSettledQuarter: shouldRetainAutoSettledQuarter(
          curr.lastAutoSettledQuarter,
          nextState,
        ),
      }));

      await syncStateProgress(nextState);
    },

    abandonActiveRun: async (endingId: AbandonEndingId = "abandon_oposiciones") => {
      const current = get().activeRun;
      if (!current || current.ending !== null || get().queuedFinalState !== null) {
        useUIStore.getState().setAbandonModalOpen(false);
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

      clearStoredLastMonthStart();
      useUIStore.getState().setAbandonModalOpen(false);
      useUIStore.getState().setScreenView("game");

      set({
        activeRun: endedState,
        outcomePreviewState: null,
        viewingCertificateRun: null,
        queuedFinalState: null,
        queuedPostOutcomeDeltas: null,
        queuedMonthStart: null,
        pendingOutcome: null,
        lastDeltas: {},
        lastChoiceImmediateDeltas: {},
        lastAutoSettledQuarter: null,
      });

      await syncStateProgress(endedState);
    },

    retireActiveRun: async () => {
      const current = get().activeRun;
      if (!current || !canRetireHonorably(current) || get().queuedFinalState !== null) {
        useUIStore.getState().setAbandonModalOpen(false);
        return;
      }

      const retiredState = buildRetiredRunState(current);

      clearStoredLastMonthStart();
      useUIStore.getState().setAbandonModalOpen(false);
      useUIStore.getState().setScreenView("game");

      set({
        activeRun: retiredState,
        outcomePreviewState: null,
        viewingCertificateRun: null,
        queuedFinalState: null,
        queuedPostOutcomeDeltas: null,
        queuedMonthStart: null,
        pendingOutcome: null,
        lastDeltas: {},
        lastChoiceImmediateDeltas: {},
        lastAutoSettledQuarter: null,
      });

      await syncStateProgress(retiredState);
    },

    returnToTitle: () => {
      const viewingCert = get().viewingCertificateRun;
      const current = get().activeRun;
      const hasPendingOutcome = get().pendingOutcome !== null;
      useUIStore.getState().setAbandonModalOpen(false);
      useUIStore.getState().setScreenView("title");

      if (viewingCert !== null) {
        set({
          viewingCertificateRun: null,
        });
        return;
      }

      if (current && current.ending !== null && !hasPendingOutcome) {
        clearStoredLastMonthStart();
        set({
          activeRun: null,
          outcomePreviewState: null,
          viewingCertificateRun: null,
          queuedFinalState: null,
          queuedPostOutcomeDeltas: null,
          queuedMonthStart: null,
          pendingOutcome: null,
          lastDeltas: {},
          lastChoiceImmediateDeltas: {},
          lastAutoSettledQuarter: null,
        });
        void syncStateProgress(current);
      } else if (hasPendingOutcome) {
        set({
          viewingCertificateRun: null,
          lastAutoSettledQuarter: null,
        });
      } else {
        set({
          outcomePreviewState: null,
          viewingCertificateRun: null,
          queuedFinalState: null,
          queuedPostOutcomeDeltas: null,
          queuedMonthStart: null,
          pendingOutcome: null,
          lastAutoSettledQuarter: null,
        });
      }
    },

    dismissCorruptNotice: () => set({ corruptedSaveNotice: null }),

    clearUnlockedToastQueue: () => set({ newlyUnlockedAchievements: [] }),

    setReducedMotionPreference: async (value: boolean | null) => {
      useUIStore.getState().setReducedMotionOverride(value);
      set((curr) => ({
        profile: {
          ...curr.profile,
          settings: {
            ...curr.profile.settings,
            reduced_motion: value,
          },
        },
      }));
      await enqueueStorage(async () => {
        const stored = await activeStoragePort.loadProfile();
        const merged: ProfileEnvelope = {
          ...stored,
          settings: {
            ...stored.settings,
            reduced_motion: value,
          },
        };
        await activeStoragePort.saveProfile(merged);
        set({ profile: merged });
      });
    },

    setLocalePreference: async (locale: UILocale) => {
      const normalized = normalizeLocale(locale);
      set((curr) => ({
        profile: {
          ...curr.profile,
          settings: {
            ...curr.profile.settings,
            locale: normalized,
          },
        },
      }));
      await enqueueStorage(async () => {
        const stored = await activeStoragePort.loadProfile();
        const merged: ProfileEnvelope = {
          ...stored,
          settings: {
            ...stored.settings,
            locale: normalized,
          },
        };
        await activeStoragePort.saveProfile(merged);
        set({ profile: merged });
      });
    },

    toggleLocalePreference: async () => {
      const current = normalizeLocale(get().profile.settings.locale);
      const next: UILocale = current === "en" ? "es-ES" : "en";
      await get().setLocalePreference(next);
    },
  };
});
