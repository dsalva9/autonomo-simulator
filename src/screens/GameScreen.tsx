import { BookOpen, Briefcase, History, Users } from "lucide-react";
import { useEffect, useRef } from "react";
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
import { useGameStore } from "../store/gameStore.ts";
import { type MobileWorkspaceTab, useUIStore } from "../store/uiStore.ts";

export interface GameScreenProps {
  state: GameState;
}

const MOBILE_TABS: {
  id: MobileWorkspaceTab;
  label: string;
  Icon: typeof Briefcase;
}[] = [
  { id: "despacho", label: "Despacho", Icon: Briefcase },
  { id: "cuentas", label: "Cuentas", Icon: BookOpen },
  { id: "entorno", label: "Entorno", Icon: Users },
  { id: "historial", label: "Historial", Icon: History },
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

  const activeMobileTab = useUIStore((s) => s.activeMobileTab);
  const setActiveMobileTab = useUIStore((s) => s.setActiveMobileTab);
  const abandonModalOpen = useUIStore((s) => s.abandonModalOpen);
  const setAbandonModalOpen = useUIStore((s) => s.setAbandonModalOpen);
  const sfxMuted = useUIStore((s) => s.sfxMuted);

  const activeEventView = getActiveEvent(state, compiledCatalog);
  const sceneEvent = pendingOutcome?.event ?? activeEventView?.event ?? null;

  const showQuarterlyModal = pendingOutcome === null && state.phase === "quarterly_tax";
  const showVictoryModal = pendingOutcome === null && state.phase === "victory_prompt";
  const showAnnualModal = pendingOutcome === null && state.phase === "annual_summary";
  const anyModalOpen =
    showQuarterlyModal || showVictoryModal || showAnnualModal || abandonModalOpen;

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

  return (
    <div data-testid="game-screen" className="min-h-screen flex flex-col">
      {/* Top Sticky Command Bar */}
      <IndicatorBar
        state={state}
        lastDeltas={lastDeltas}
        onReturnToTitle={returnToTitle}
        onOpenAbandon={() => setAbandonModalOpen(true)}
      />

      {/* Adaptive Workspace: Tabbed on Mobile (<1024px), Aligned 3-Column Desk on Desktop (>=1024px) */}
      <main className="flex-1 w-full max-w-[1400px] mx-auto px-3 sm:px-5 pt-2 pb-[calc(5.25rem+env(safe-area-inset-bottom))] lg:pb-2.5">
        <div className="lg:grid lg:grid-cols-[296px_minmax(0,1fr)_312px] xl:grid-cols-[324px_minmax(0,1fr)_344px] lg:gap-4 xl:gap-5 lg:items-start">
          {/* Left Column: Live Office Scene + Entorno Support Cards */}
          <aside className="space-y-2.5 lg:space-y-2.5 lg:sticky lg:top-[88px] lg:max-h-[calc(100vh-98px)] lg:overflow-y-auto lg:pr-1 lg:pb-1 dossier-scroll">
            <div
              className={
                activeMobileTab === "despacho" || activeMobileTab === "entorno"
                  ? "block"
                  : "hidden lg:block"
              }
            >
              <SceneRenderer state={state} activeEvent={sceneEvent} />
            </div>

            <div className={activeMobileTab === "entorno" ? "block" : "hidden lg:block"}>
              <EntornoPanel state={state} />
            </div>
          </aside>

          {/* Center Stage: Monthly Economy Strip, Event Card, Choices & Outcome Resolution */}
          <section
            aria-label="Mesa de decisiones"
            className={activeMobileTab === "despacho" ? "block mt-2 lg:mt-0" : "hidden lg:block"}
          >
            <EventStage
              state={state}
              activeEventView={activeEventView}
              pendingOutcome={pendingOutcome}
              lastMonthStart={lastMonthStart}
              locale={profile.settings.locale}
              keyboardEnabled={!anyModalOpen}
              onSelectChoice={handleSelectChoice}
              onContinueOutcome={handleContinueOutcome}
            />
          </section>

          {/* Right Column: Cuaderno de Cuentas & Historial */}
          <aside className="space-y-2.5 lg:space-y-2.5 lg:sticky lg:top-[88px] lg:max-h-[calc(100vh-98px)] lg:overflow-y-auto lg:pr-1 lg:pb-1 dossier-scroll">
            <div className={activeMobileTab === "cuentas" ? "block" : "hidden lg:block"}>
              <CuentasPanel state={state} />
            </div>

            <div className={activeMobileTab === "historial" ? "block" : "hidden lg:block"}>
              <HistorialPanel state={state} unlockedAchievements={profile.achievements} />
            </div>
          </aside>
        </div>
      </main>

      {/* Mobile Bottom Navigation Bar (< 1024px) */}
      <nav
        aria-label="Secciones del despacho"
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t-2 border-[#1f2421] bg-[#fffdf8]/98 backdrop-blur-xs pb-[env(safe-area-inset-bottom)]"
      >
        <div role="tablist" className="grid grid-cols-4">
          {MOBILE_TABS.map(({ id, label, Icon }) => {
            const isActive = activeMobileTab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={isActive}
                data-testid={`mobile-tab-${id}`}
                onClick={() => setActiveMobileTab(id)}
                className={`min-h-14 py-1.5 px-1 flex flex-col items-center justify-center gap-0.5 text-xs font-bold transition-colors cursor-pointer ${
                  isActive
                    ? "bg-[#fcf4df] text-[#8f510d] border-t-2 border-[#8f510d]"
                    : "text-[#4a524e] hover:bg-[#f6efe0]"
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
        <QuarterlyTaxModal state={state} onSettle={handleSettleQuarterlyTax} />
      )}

      {showVictoryModal && <VictoryModal state={state} onDecide={handleDecideVictory} />}

      {showAnnualModal && <AnnualSummaryModal state={state} onClose={handleCloseAnnualSummary} />}

      {abandonModalOpen && (
        <AbandonRunModal
          onConfirmAbandon={(endingId) => void abandonActiveRun(endingId)}
          onCancel={() => setAbandonModalOpen(false)}
        />
      )}
    </div>
  );
}
