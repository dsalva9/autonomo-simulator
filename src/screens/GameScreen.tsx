import { BookOpen, Briefcase, History, Users } from "lucide-react";
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
import { type GameState, getActiveEvent } from "../engine/index.ts";
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

  const activeEventView = getActiveEvent(state, compiledCatalog);
  const sceneEvent = pendingOutcome?.event ?? activeEventView?.event ?? null;

  const showQuarterlyModal = pendingOutcome === null && state.phase === "quarterly_tax";
  const showVictoryModal = pendingOutcome === null && state.phase === "victory_prompt";
  const showAnnualModal = pendingOutcome === null && state.phase === "annual_summary";
  const anyModalOpen =
    showQuarterlyModal || showVictoryModal || showAnnualModal || abandonModalOpen;

  return (
    <div data-testid="game-screen" className="min-h-screen flex flex-col">
      {/* Top Sticky 5-Indicator Bar */}
      <IndicatorBar
        state={state}
        lastDeltas={lastDeltas}
        onReturnToTitle={returnToTitle}
        onOpenAbandon={() => setAbandonModalOpen(true)}
      />

      {/* Adaptive Workspace: Tabbed on Mobile (<1024px), True 3-Column Desk on Desktop (>=1024px) */}
      <main className="flex-1 w-full max-w-[1440px] mx-auto px-3 sm:px-5 pt-3.5 pb-24 lg:pb-8">
        <div className="lg:grid lg:grid-cols-[320px_minmax(0,1fr)_350px] lg:gap-5 lg:items-start">
          {/* Left Column: Live Office Scene + Entorno Cards */}
          <aside className="space-y-4">
            <div
              className={
                activeMobileTab === "despacho" || activeMobileTab === "entorno"
                  ? "block mb-3.5 lg:mb-0"
                  : "hidden lg:block"
              }
            >
              <SceneRenderer state={state} activeEvent={sceneEvent} />
            </div>

            <div className={activeMobileTab === "entorno" ? "block" : "hidden lg:block"}>
              <EntornoPanel state={state} />
            </div>
          </aside>

          {/* Center Stage: Narrative Event Card, Choices & Outcome Resolution */}
          <section
            aria-label="Mesa de decisiones"
            className={activeMobileTab === "despacho" ? "block" : "hidden lg:block"}
          >
            <EventStage
              state={state}
              activeEventView={activeEventView}
              pendingOutcome={pendingOutcome}
              lastMonthStart={lastMonthStart}
              locale={profile.settings.locale}
              keyboardEnabled={!anyModalOpen}
              onSelectChoice={(choiceId) => void chooseOption(choiceId)}
              onContinueOutcome={acknowledgeOutcome}
            />
          </section>

          {/* Right Column: Cuaderno de Cuentas & Historial */}
          <aside className="space-y-4">
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
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t-2 border-[#1f2421] bg-[#fffdf8] pb-[env(safe-area-inset-bottom)]"
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
                className={`min-h-14 py-2 px-1 flex flex-col items-center justify-center gap-1 text-xs font-bold transition-colors cursor-pointer ${
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
        <QuarterlyTaxModal state={state} onSettle={(mode) => void settleQuarterlyTax(mode)} />
      )}

      {showVictoryModal && (
        <VictoryModal state={state} onDecide={(decision) => void decideVictory(decision)} />
      )}

      {showAnnualModal && (
        <AnnualSummaryModal state={state} onClose={() => void closeAnnualSummary()} />
      )}

      {abandonModalOpen && (
        <AbandonRunModal
          onConfirmAbandon={(endingId) => void abandonActiveRun(endingId)}
          onCancel={() => setAbandonModalOpen(false)}
        />
      )}
    </div>
  );
}
