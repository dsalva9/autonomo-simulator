import { BookOpen, Briefcase, History, Users } from "lucide-react";
import { type KeyboardEvent as ReactKeyboardEvent, useEffect, useRef } from "react";
import { EventStage } from "../components/event/EventStage.tsx";
import { IndicatorBar } from "../components/hud/IndicatorBar.tsx";
import { AbandonRunModal } from "../components/modals/AbandonRunModal.tsx";
import { AnnualSummaryModal } from "../components/modals/AnnualSummaryModal.tsx";
import { QuarterlyTaxModal } from "../components/modals/QuarterlyTaxModal.tsx";
import { VictoryModal } from "../components/modals/VictoryModal.tsx";
import { CuentasPanel } from "../components/panels/CuentasPanel.tsx";
import { EntornoPanel } from "../components/panels/EntornoPanel.tsx";
import { HistorialPanel } from "../components/panels/HistorialPanel.tsx";
import { SceneRenderer } from "../components/scene/SceneRenderer.tsx";
import {
  type GameState,
  type QuarterlySettlementMode,
  type VictoryDecision,
  getActiveEvent,
} from "../engine/index.ts";
import { playUiSound } from "../services/audio/soundEffects.ts";
import { compiledCatalog } from "../services/content/catalog.ts";
import { getUiStrings } from "../services/i18n/uiStrings.ts";
import { useGameStore } from "../store/gameStore.ts";
import { type MobileWorkspaceTab, useUIStore } from "../store/uiStore.ts";

export interface GameScreenProps {
  state: GameState;
}

const MOBILE_TAB_ICONS: {
  id: MobileWorkspaceTab;
  Icon: typeof Briefcase;
}[] = [
  { id: "despacho", Icon: Briefcase },
  { id: "cuentas", Icon: BookOpen },
  { id: "entorno", Icon: Users },
  { id: "historial", Icon: History },
];

export function GameScreen({ state }: GameScreenProps) {
  const pendingOutcome = useGameStore((s) => s.pendingOutcome);
  const lastMonthStart = useGameStore((s) => s.lastMonthStart);
  const lastDeltas = useGameStore((s) => s.lastDeltas);
  const profile = useGameStore((s) => s.profile);

  const chooseOption = useGameStore((s) => s.chooseOption);
  const acknowledgeOutcome = useGameStore((s) => s.acknowledgeOutcome);
  const settleQuarterlyTax = useGameStore((s) => s.settleQuarterlyTax);
  const decideVictory = useGameStore((s) => s.decideVictory);
  const closeAnnualSummary = useGameStore((s) => s.closeAnnualSummary);
  const abandonActiveRun = useGameStore((s) => s.abandonActiveRun);
  const returnToTitle = useGameStore((s) => s.returnToTitle);
  const newlyUnlockedAchievements = useGameStore((s) => s.newlyUnlockedAchievements);
  const clearUnlockedToastQueue = useGameStore((s) => s.clearUnlockedToastQueue);
  const toggleLocalePreference = useGameStore((s) => s.toggleLocalePreference);

  const activeMobileTab = useUIStore((s) => s.activeMobileTab);
  const setActiveMobileTab = useUIStore((s) => s.setActiveMobileTab);
  const abandonModalOpen = useUIStore((s) => s.abandonModalOpen);
  const setAbandonModalOpen = useUIStore((s) => s.setAbandonModalOpen);
  const sfxMuted = useUIStore((s) => s.sfxMuted);
  const toggleSfxMuted = useUIStore((s) => s.toggleSfxMuted);
  const toggleFastPacing = useUIStore((s) => s.toggleFastPacing);

  const gameScreenRef = useRef<HTMLDivElement | null>(null);
  const hudHeaderRef = useRef<HTMLElement | null>(null);
  const mobileTabRefs = useRef<Partial<Record<MobileWorkspaceTab, HTMLButtonElement | null>>>({});

  const locale = profile.settings.locale;
  const ui = getUiStrings(locale);

  const activeEventView = getActiveEvent(state, compiledCatalog);
  const sceneEvent = pendingOutcome?.event ?? activeEventView?.event ?? null;

  const showQuarterlyModal = pendingOutcome === null && state.phase === "quarterly_tax";
  const showVictoryModal = pendingOutcome === null && state.phase === "victory_prompt";
  const showAnnualModal = pendingOutcome === null && state.phase === "annual_summary";
  const anyModalOpen =
    showQuarterlyModal || showVictoryModal || showAnnualModal || abandonModalOpen;

  // Dynamically measure IndicatorBar height into --hud-height so sticky sidebars & mobile toasts
  // never overflow 100dvh or overlap expanded delta/overdraft strips.
  useEffect(() => {
    const headerEl = hudHeaderRef.current;
    const screenEl = gameScreenRef.current;
    if (!headerEl || !screenEl) {
      return;
    }

    const syncHudHeight = () => {
      const measured = Math.ceil(headerEl.getBoundingClientRect().height);
      if (measured > 0) {
        screenEl.style.setProperty("--hud-height", `${measured}px`);
        document.documentElement.style.setProperty("--hud-height", `${measured}px`);
      }
    };

    syncHudHeight();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => {
      syncHudHeight();
    });
    observer.observe(headerEl);
    return () => observer.disconnect();
  }, []);

  const deskHotkeysRef = useRef({
    sfxMuted,
    hasToast: newlyUnlockedAchievements.length > 0,
    toggleSfxMuted,
    toggleFastPacing,
    toggleLocalePreference,
    returnToTitle,
    openAbandon: () => setAbandonModalOpen(true),
    clearUnlockedToastQueue,
  });
  deskHotkeysRef.current = {
    sfxMuted,
    hasToast: newlyUnlockedAchievements.length > 0,
    toggleSfxMuted,
    toggleFastPacing,
    toggleLocalePreference,
    returnToTitle,
    openAbandon: () => setAbandonModalOpen(true),
    clearUnlockedToastQueue,
  };

  useEffect(() => {
    if (anyModalOpen) {
      return;
    }

    const handleDeskKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      const actions = deskHotkeysRef.current;

      if (event.key === "Escape") {
        if (actions.hasToast) {
          event.preventDefault();
          actions.clearUnlockedToastQueue();
        } else if (
          document.activeElement instanceof HTMLElement &&
          document.activeElement !== document.body
        ) {
          document.activeElement.blur();
        }
        return;
      }

      const key = event.key.toLowerCase();
      if (key === "m") {
        event.preventDefault();
        const willBeUnmuted = actions.sfxMuted;
        actions.toggleSfxMuted();
        if (willBeUnmuted) {
          playUiSound("paper_choice", { muted: false });
        }
      } else if (key === "f") {
        event.preventDefault();
        actions.toggleFastPacing();
        playUiSound("paper_choice", { muted: actions.sfxMuted });
      } else if (key === "l") {
        event.preventDefault();
        playUiSound("paper_choice", { muted: actions.sfxMuted });
        void actions.toggleLocalePreference();
      } else if (key === "i") {
        event.preventDefault();
        actions.returnToTitle();
      } else if (key === "b") {
        event.preventDefault();
        actions.openAbandon();
      }
    };

    window.addEventListener("keydown", handleDeskKeyDown);
    return () => window.removeEventListener("keydown", handleDeskKeyDown);
  }, [anyModalOpen]);

  // Chime counter desk-bell once whenever entering a quarterly tax settlement
  const lastTrimestreBellKeyRef = useRef<string>("");
  useEffect(() => {
    if (!showQuarterlyModal) {
      return;
    }
    const bellKey = `${state.run_id}:${state.month}`;
    if (lastTrimestreBellKeyRef.current !== bellKey) {
      lastTrimestreBellKeyRef.current = bellKey;
      playUiSound("trimestre_bell", { muted: sfxMuted });
    }
  }, [showQuarterlyModal, state.run_id, state.month, sfxMuted]);

  // Prevent yo-yo scrolling: whenever a choice resolves to outcome or advances to the next card,
  // reset vertical scroll if the user had scrolled down (e.g. on compact mobile or zoomed viewports).
  const turnViewSignature = `${state.run_id}:${state.month}:${activeEventView?.event.id ?? "none"}:${
    pendingOutcome ? `${pendingOutcome.choiceId}:${pendingOutcome.outcome.outcome_id}` : "event"
  }`;
  const prevTurnViewSignatureRef = useRef<string>(turnViewSignature);
  useEffect(() => {
    if (prevTurnViewSignatureRef.current !== turnViewSignature) {
      prevTurnViewSignatureRef.current = turnViewSignature;
      if (typeof window !== "undefined" && window.scrollY > 0) {
        window.scrollTo({ top: 0, behavior: "auto" });
      }
    }
  }, [turnViewSignature]);

  const handleSelectChoice = (choiceId: string) => {
    const beforeHistoryLen = useGameStore.getState().activeRun?.history.length ?? 0;
    void chooseOption(choiceId);

    // Inspect synchronous store update to select appropriate financial/paper SFX
    const afterStore = useGameStore.getState();
    let moneyDelta = 0;
    if (afterStore.pendingOutcome) {
      moneyDelta = afterStore.pendingOutcome.outcome.money_delta;
    } else if (afterStore.activeRun) {
      const addedEntries = afterStore.activeRun.history.slice(beforeHistoryLen);
      const choiceEntry = addedEntries.find((entry) => entry.kind === "event_choice");
      moneyDelta = choiceEntry?.money_delta ?? 0;
    }

    if (moneyDelta > 0) {
      playUiSound("coin_gain", { muted: sfxMuted });
    } else if (moneyDelta < 0) {
      playUiSound("cash_loss", { muted: sfxMuted });
    } else {
      playUiSound("paper_choice", { muted: sfxMuted });
    }
  };

  const handleContinueOutcome = () => {
    playUiSound("stamp_thud", { muted: sfxMuted });
    acknowledgeOutcome();
  };

  const handleSettleQuarterlyTax = (mode: QuarterlySettlementMode) => {
    playUiSound("stamp_thud", { muted: sfxMuted });
    void settleQuarterlyTax(mode);
  };

  const handleDecideVictory = (decision: VictoryDecision) => {
    playUiSound("stamp_thud", { muted: sfxMuted });
    void decideVictory(decision);
  };

  const handleCloseAnnualSummary = () => {
    playUiSound("stamp_thud", { muted: sfxMuted });
    void closeAnnualSummary();
  };

  const handleMobileTabKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (
      event.key !== "ArrowLeft" &&
      event.key !== "ArrowRight" &&
      event.key !== "Home" &&
      event.key !== "End"
    ) {
      return;
    }
    event.preventDefault();
    const order = MOBILE_TAB_ICONS.map((t) => t.id);
    const currentIdx = order.indexOf(activeMobileTab);
    let nextIdx = 0;
    if (event.key === "Home") {
      nextIdx = 0;
    } else if (event.key === "End") {
      nextIdx = order.length - 1;
    } else if (event.key === "ArrowRight") {
      nextIdx = (currentIdx + 1) % order.length;
    } else {
      nextIdx = (currentIdx - 1 + order.length) % order.length;
    }
    const nextTab = order[nextIdx] ?? "despacho";
    setActiveMobileTab(nextTab);
    mobileTabRefs.current[nextTab]?.focus({ preventScroll: true });
  };

  return (
    <div
      ref={gameScreenRef}
      data-testid="game-screen"
      data-mobile-tab={activeMobileTab}
      className="min-h-screen flex flex-col"
    >
      {/* Top Sticky Command Bar */}
      <IndicatorBar
        headerRef={hudHeaderRef}
        state={state}
        lastDeltas={lastDeltas}
        locale={locale}
        onReturnToTitle={returnToTitle}
        onOpenAbandon={() => setAbandonModalOpen(true)}
      />

      {/* Adaptive Workspace: Centered Tabbed Workspace (<1280px) | Aligned 3-Column Desk (>=1280px) */}
      <main className="game-main flex-1 w-full max-w-3xl xl:max-w-[1420px] mx-auto px-3 sm:px-5 pt-2 pb-[calc(4.75rem+env(safe-area-inset-bottom))] xl:pb-2.5">
        <div className="xl:grid xl:grid-cols-[316px_minmax(0,1fr)_336px] 2xl:grid-cols-[332px_minmax(0,1fr)_352px] xl:gap-4 2xl:gap-5 xl:items-start">
          {/* Left Column: Live Office Scene + Entorno Support Cards */}
          <aside className="space-y-2.5 xl:sticky xl:top-[calc(var(--hud-height,88px)+8px)] xl:max-h-[calc(100dvh-var(--hud-height,88px)-18px)] xl:overflow-y-auto xl:pr-1 xl:pb-1 dossier-scroll">
            <div
              className={
                activeMobileTab === "despacho" || activeMobileTab === "entorno"
                  ? "block"
                  : "hidden xl:block"
              }
            >
              <SceneRenderer state={state} activeEvent={sceneEvent} locale={locale} />
            </div>

            <div
              id="mobile-tabpanel-entorno"
              className={activeMobileTab === "entorno" ? "block" : "hidden xl:block"}
            >
              <EntornoPanel state={state} locale={locale} />
            </div>
          </aside>

          {/* Center Stage: Monthly Economy Strip, Event Card, Choices & Outcome Resolution */}
          <section
            id="mobile-tabpanel-despacho"
            aria-label={ui.game.decisionDeskAria}
            className={activeMobileTab === "despacho" ? "block mt-2 xl:mt-0" : "hidden xl:block"}
          >
            <EventStage
              state={state}
              activeEventView={activeEventView}
              pendingOutcome={pendingOutcome}
              lastMonthStart={lastMonthStart}
              locale={locale}
              keyboardEnabled={!anyModalOpen}
              onSelectChoice={handleSelectChoice}
              onContinueOutcome={handleContinueOutcome}
            />
          </section>

          {/* Right Column: Cuaderno de Cuentas & Historial */}
          <aside className="space-y-2.5 xl:sticky xl:top-[calc(var(--hud-height,88px)+8px)] xl:max-h-[calc(100dvh-var(--hud-height,88px)-18px)] xl:overflow-y-auto xl:pr-1 xl:pb-1 dossier-scroll">
            <div
              id="mobile-tabpanel-cuentas"
              className={activeMobileTab === "cuentas" ? "block" : "hidden xl:block"}
            >
              <CuentasPanel state={state} locale={locale} />
            </div>

            <div
              id="mobile-tabpanel-historial"
              className={activeMobileTab === "historial" ? "block" : "hidden xl:block"}
            >
              <HistorialPanel
                state={state}
                unlockedAchievements={profile.achievements}
                locale={locale}
              />
            </div>
          </aside>
        </div>
      </main>

      {/* Mobile & Tablet Bottom Navigation Bar (< 1280px) */}
      <nav
        aria-label={ui.game.mobileNavAria}
        className="xl:hidden fixed bottom-0 inset-x-0 z-30 border-t-2 border-[#1f2421] bg-[#fffdf8]/98 backdrop-blur-xs pb-[env(safe-area-inset-bottom)]"
      >
        <div role="tablist" onKeyDown={handleMobileTabKeyDown} className="grid grid-cols-4">
          {MOBILE_TAB_ICONS.map(({ id, Icon }) => {
            const isActive = activeMobileTab === id;
            const label = ui.game.tabs[id];
            return (
              <button
                key={id}
                ref={(el) => {
                  mobileTabRefs.current[id] = el;
                }}
                id={`mobile-tab-btn-${id}`}
                type="button"
                role="tab"
                tabIndex={isActive ? 0 : -1}
                aria-selected={isActive}
                aria-controls={`mobile-tabpanel-${id}`}
                data-testid={`mobile-tab-${id}`}
                onClick={() => setActiveMobileTab(id)}
                className={`min-h-12 sm:min-h-13 py-1 px-1 flex flex-col items-center justify-center gap-0.5 text-xs font-bold transition-colors cursor-pointer ${
                  isActive
                    ? "bg-[#fcf4df] text-[#7a4308] border-t-2 border-[#7a4308]"
                    : "text-[#373f3a] hover:bg-[#f6efe0]"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Phase Modals */}
      {showQuarterlyModal && (
        <QuarterlyTaxModal state={state} locale={locale} onSettle={handleSettleQuarterlyTax} />
      )}

      {showVictoryModal && (
        <VictoryModal state={state} locale={locale} onDecide={handleDecideVictory} />
      )}

      {showAnnualModal && (
        <AnnualSummaryModal state={state} locale={locale} onClose={handleCloseAnnualSummary} />
      )}

      {abandonModalOpen && (
        <AbandonRunModal
          locale={locale}
          onConfirmAbandon={(endingId) => void abandonActiveRun(endingId)}
          onCancel={() => setAbandonModalOpen(false)}
        />
      )}
    </div>
  );
}
