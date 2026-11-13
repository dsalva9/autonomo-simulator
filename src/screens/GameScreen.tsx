import { BookOpen, Briefcase, History, Users } from "lucide-react";
import { type KeyboardEvent as ReactKeyboardEvent, useEffect, useRef, useState } from "react";
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
import { normalizeLocale } from "../services/i18n/resolveEventText.ts";
import { getUiStrings } from "../services/i18n/uiStrings.ts";
import { useGameStore } from "../store/gameStore.ts";
import { type MobileWorkspaceTab, useUIStore } from "../store/uiStore.ts";

export interface GameScreenProps {
  state: GameState;
}

type DesktopRightFolderTab = "entorno" | "cuentas" | "historial";

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
  const queuedFinalState = useGameStore((s) => s.queuedFinalState);
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

  const [viewport, setViewport] = useState<{ width: number; height: number }>(() =>
    typeof window !== "undefined"
      ? { width: window.innerWidth, height: window.innerHeight }
      : { width: 1440, height: 900 },
  );
  const [desktopRightTab, setDesktopRightTab] = useState<DesktopRightFolderTab>("cuentas");

  const gameScreenRef = useRef<HTMLDivElement | null>(null);
  const hudHeaderRef = useRef<HTMLElement | null>(null);
  const mobileTabRefs = useRef<Partial<Record<MobileWorkspaceTab, HTMLButtonElement | null>>>({});
  const desktopFolderTabRefs = useRef<
    Partial<Record<DesktopRightFolderTab, HTMLButtonElement | null>>
  >({});

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const syncViewport = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };
    syncViewport();
    window.addEventListener("resize", syncViewport);
    return () => window.removeEventListener("resize", syncViewport);
  }, []);

  const locale = profile.settings.locale;
  const isEn = normalizeLocale(locale) === "en";
  const ui = getUiStrings(locale);

  const activeEventView = getActiveEvent(state, compiledCatalog);
  const sceneEvent = pendingOutcome?.event ?? activeEventView?.event ?? null;

  // Disable voluntary abandonment once a run-ending outcome has already been sealed (M2-09)
  const abandonDisabled = Boolean(state.ending || queuedFinalState);

  useEffect(() => {
    if (abandonDisabled && abandonModalOpen) {
      setAbandonModalOpen(false);
    }
  }, [abandonDisabled, abandonModalOpen, setAbandonModalOpen]);

  const showQuarterlyModal = pendingOutcome === null && state.phase === "quarterly_tax";
  const showVictoryModal = pendingOutcome === null && state.phase === "victory_prompt";
  const showAnnualModal = pendingOutcome === null && state.phase === "annual_summary";
  const anyModalOpen =
    showQuarterlyModal || showVictoryModal || showAnnualModal || abandonModalOpen;

  // Dynamically measure IndicatorBar height into --hud-height so sticky elements & mobile toasts
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
    abandonDisabled,
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
    abandonDisabled,
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
        if (!actions.abandonDisabled) {
          event.preventDefault();
          actions.openAbandon();
        }
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
  const prevTurnViewSignatureRef = useRef<string>("");
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
      event.key !== "ArrowUp" &&
      event.key !== "ArrowDown" &&
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
    } else if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIdx = (currentIdx + 1) % order.length;
    } else {
      nextIdx = (currentIdx - 1 + order.length) % order.length;
    }
    const nextTab = order[nextIdx] ?? "despacho";
    setActiveMobileTab(nextTab);
    mobileTabRefs.current[nextTab]?.focus({ preventScroll: true });
  };

  const isDesktop = viewport.width >= 1024;
  const isTwoColDesktop = isDesktop && viewport.width < 1120;
  const isShortThreeColDesktop = viewport.width >= 1120 && viewport.height < 740;
  const effectiveRightTab: DesktopRightFolderTab =
    !isTwoColDesktop && desktopRightTab === "entorno" ? "cuentas" : desktopRightTab;

  const handleDesktopFolderKeyDown = (
    event: ReactKeyboardEvent<HTMLDivElement>,
    availableTabs: DesktopRightFolderTab[],
  ) => {
    if (
      event.key !== "ArrowLeft" &&
      event.key !== "ArrowRight" &&
      event.key !== "Home" &&
      event.key !== "End"
    ) {
      return;
    }
    event.preventDefault();
    const currentIdx = Math.max(0, availableTabs.indexOf(effectiveRightTab));
    let nextIdx = 0;
    if (event.key === "Home") {
      nextIdx = 0;
    } else if (event.key === "End") {
      nextIdx = availableTabs.length - 1;
    } else if (event.key === "ArrowRight") {
      nextIdx = (currentIdx + 1) % availableTabs.length;
    } else {
      nextIdx = (currentIdx - 1 + availableTabs.length) % availableTabs.length;
    }
    const nextTab = availableTabs[nextIdx] ?? "cuentas";
    setDesktopRightTab(nextTab);
    desktopFolderTabRefs.current[nextTab]?.focus({ preventScroll: true });
  };

  // Ambient mobile tab status dots (< 1024px)
  const hasEntornoAlert =
    state.indicators.stress >= 70 || (state.employee !== null && state.employee.satisfaction < 45);
  const hasCuentasAlert = Boolean(state.finances.deferred_tax) || state.month % 3 === 0;
  const hasHistorialAlert = newlyUnlockedAchievements.length > 0;

  const renderEventStage = () => (
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
  );

  return (
    <div
      ref={gameScreenRef}
      data-testid="game-screen"
      data-mobile-tab={activeMobileTab}
      className="game-screen-root min-h-dvh flex flex-col"
    >
      {/* Background workspace shell marked inert whenever a phase/session modal is open (M2-06) */}
      <div inert={anyModalOpen} className="game-workspace-shell flex-1 min-h-0 flex flex-col">
        {/* Top Sticky Command Bar */}
        <IndicatorBar
          headerRef={hudHeaderRef}
          state={state}
          lastDeltas={lastDeltas}
          locale={locale}
          abandonDisabled={abandonDisabled}
          onReturnToTitle={returnToTitle}
          onOpenAbandon={() => {
            if (!abandonDisabled) {
              setAbandonModalOpen(true);
            }
          }}
        />

        {/* Adaptive Workspace:
            - < 1024px: Focused Tabbed Workspace (pure card stage on Despacho; diorama showcase in Entorno)
            - 1024px–1119px: 2-Column Symmetric Desk (Stage + [Despacho | Cuentas | Diario] folder)
            - >= 1120px: 3-Column Symmetric Desk (Left: Scene+Entorno | Center: Stage | Right: Cuentas+Diario) */}
        <main className="game-main flex-1 min-h-0 w-full max-w-3xl lg:max-w-none xl:max-w-[1440px] 2xl:max-w-[1600px] mx-auto px-3 sm:px-5 lg:px-3 xl:px-4 2xl:px-5 pt-2 pb-[calc(4.75rem+env(safe-area-inset-bottom))] lg:py-2 lg:flex lg:flex-col">
          {!isDesktop ? (
            <div className="w-full">
              {/* Mobile Tab 1: Pure, distraction-free Decision Stage (no SceneRenderer above card!) */}
              <section
                id="mobile-tabpanel-despacho"
                aria-label={ui.game.decisionDeskAria}
                className={activeMobileTab === "despacho" ? "block" : "hidden"}
              >
                {renderEventStage()}
              </section>

              {/* Mobile Tab 2: Cuentas Ledger */}
              <div
                id="mobile-tabpanel-cuentas"
                className={activeMobileTab === "cuentas" ? "block" : "hidden"}
              >
                <CuentasPanel state={state} locale={locale} />
              </div>

              {/* Mobile Tab 3: Entorno Desk Showcase (Panoramic Diorama + Prop Chips + Support Network) */}
              <div
                id="mobile-tabpanel-entorno"
                className={activeMobileTab === "entorno" ? "block space-y-2.5" : "hidden"}
              >
                <SceneRenderer state={state} activeEvent={sceneEvent} locale={locale} />
                <EntornoPanel state={state} locale={locale} />
              </div>

              {/* Mobile Tab 4: Historial & Career Seals */}
              <div
                id="mobile-tabpanel-historial"
                className={activeMobileTab === "historial" ? "block" : "hidden"}
              >
                <HistorialPanel
                  state={state}
                  unlockedAchievements={profile.achievements}
                  locale={locale}
                />
              </div>
            </div>
          ) : isTwoColDesktop ? (
            /* 1024px–1119px (1024×768, 1093×614 1366@125% DPI): 2-Column Symmetric Desk */
            <div className="game-desk-grid flex-1 h-full min-h-0 grid grid-cols-[minmax(0,1fr)_308px] gap-3 items-stretch">
              <section
                id="mobile-tabpanel-despacho"
                aria-label={ui.game.decisionDeskAria}
                className="h-full min-h-0 flex flex-col"
              >
                {renderEventStage()}
              </section>

              <aside className="h-full min-h-0 flex flex-col">
                <div className="paper-dossier rounded-xl overflow-hidden bg-[#fffdf8] flex-1 min-h-0 flex flex-col">
                  <div
                    role="tablist"
                    aria-label={isEn ? "Side dossier folders" : "Carpetas auxiliares"}
                    onKeyDown={(ev) =>
                      handleDesktopFolderKeyDown(ev, ["entorno", "cuentas", "historial"])
                    }
                    className="shrink-0 grid grid-cols-3 border-b-2 border-[#1f2421]/18 bg-[#f6efe0]"
                  >
                    {(
                      [
                        {
                          id: "entorno",
                          label: isEn ? "Desk" : "Despacho",
                          testId: "desktop-right-tab-entorno",
                        },
                        {
                          id: "cuentas",
                          label: ui.game.tabs.cuentas,
                          testId: "desktop-right-tab-cuentas",
                        },
                        {
                          id: "historial",
                          label: isEn
                            ? `Log (${state.history.length})`
                            : `Diario (${state.history.length})`,
                          testId: "desktop-right-tab-historial",
                        },
                      ] as const
                    ).map((tab) => {
                      const active = effectiveRightTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          ref={(el) => {
                            desktopFolderTabRefs.current[tab.id] = el;
                          }}
                          type="button"
                          role="tab"
                          tabIndex={active ? 0 : -1}
                          aria-selected={active}
                          data-testid={tab.testId}
                          onClick={() => setDesktopRightTab(tab.id)}
                          className={`min-h-9 px-2 py-1 text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap truncate ${
                            active
                              ? "bg-[#fffdf8] text-[#1f5c53] border-b-2 border-[#1f5c53]"
                              : "text-[#373f3a] hover:bg-[#efe4ce]"
                          }`}
                        >
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>

                  {effectiveRightTab === "entorno" ? (
                    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                      <SceneRenderer
                        state={state}
                        activeEvent={sceneEvent}
                        locale={locale}
                        embeddedInFolder={true}
                      />
                      <EntornoPanel state={state} locale={locale} embeddedInFolder={true} />
                    </div>
                  ) : effectiveRightTab === "cuentas" ? (
                    <CuentasPanel state={state} locale={locale} embeddedInFolder={true} />
                  ) : (
                    <HistorialPanel
                      state={state}
                      unlockedAchievements={profile.achievements}
                      locale={locale}
                      embeddedInFolder={true}
                    />
                  )}
                </div>
              </aside>
            </div>
          ) : (
            /* >= 1120px: 3-Column Symmetric Desk (1120-1279 compact | 1280-1535 standard | >=1536 wide) */
            <div className="game-desk-grid flex-1 h-full min-h-0 grid min-[1120px]:grid-cols-[256px_minmax(0,1fr)_276px] xl:grid-cols-[296px_minmax(0,1fr)_320px] 2xl:grid-cols-[328px_minmax(0,1fr)_352px] gap-3 xl:gap-4 2xl:gap-5 items-stretch">
              {/* Left Column: Live Office Diorama + Red de Apoyo stretched to bottom baseline */}
              <aside className="h-full min-h-0 flex flex-col gap-2.5">
                <SceneRenderer state={state} activeEvent={sceneEvent} locale={locale} />
                <EntornoPanel state={state} locale={locale} className="flex-1 min-h-0" />
              </aside>

              {/* Center Stage: Decision Dossier with Docked Economy Strip */}
              <section
                id="mobile-tabpanel-despacho"
                aria-label={ui.game.decisionDeskAria}
                className="h-full min-h-0 flex flex-col"
              >
                {renderEventStage()}
              </section>

              {/* Right Column: Stacked Cuentas + Diario (>=740px tall) OR 2-Tab Folder (<740px short) */}
              <aside className="h-full min-h-0 flex flex-col gap-2.5">
                {isShortThreeColDesktop ? (
                  <div className="paper-dossier rounded-xl overflow-hidden bg-[#fffdf8] flex-1 min-h-0 flex flex-col">
                    <div
                      role="tablist"
                      aria-label={isEn ? "Ledger and logbook tabs" : "Pestañas de cuentas y diario"}
                      onKeyDown={(ev) => handleDesktopFolderKeyDown(ev, ["cuentas", "historial"])}
                      className="shrink-0 grid grid-cols-2 border-b-2 border-[#1f2421]/18 bg-[#f6efe0]"
                    >
                      <button
                        ref={(el) => {
                          desktopFolderTabRefs.current.cuentas = el;
                        }}
                        type="button"
                        role="tab"
                        tabIndex={effectiveRightTab === "cuentas" ? 0 : -1}
                        aria-selected={effectiveRightTab === "cuentas"}
                        data-testid="desktop-right-tab-cuentas"
                        onClick={() => setDesktopRightTab("cuentas")}
                        className={`min-h-8 px-2.5 py-1 inline-flex items-center justify-center gap-1.5 text-xs font-bold transition-colors cursor-pointer ${
                          effectiveRightTab === "cuentas"
                            ? "bg-[#fffdf8] text-[#1f5c53] border-b-2 border-[#1f5c53]"
                            : "text-[#373f3a] hover:bg-[#efe4ce]"
                        }`}
                      >
                        <BookOpen className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>{ui.game.tabs.cuentas}</span>
                      </button>

                      <button
                        ref={(el) => {
                          desktopFolderTabRefs.current.historial = el;
                        }}
                        type="button"
                        role="tab"
                        tabIndex={effectiveRightTab === "historial" ? 0 : -1}
                        aria-selected={effectiveRightTab === "historial"}
                        data-testid="desktop-right-tab-historial"
                        onClick={() => setDesktopRightTab("historial")}
                        className={`min-h-8 px-2.5 py-1 inline-flex items-center justify-center gap-1.5 text-xs font-bold transition-colors cursor-pointer ${
                          effectiveRightTab === "historial"
                            ? "bg-[#fffdf8] text-[#7a4308] border-b-2 border-[#7a4308]"
                            : "text-[#373f3a] hover:bg-[#efe4ce]"
                        }`}
                      >
                        <History className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>
                          {isEn
                            ? `Log (${state.history.length})`
                            : `Diario (${state.history.length})`}
                        </span>
                      </button>
                    </div>

                    {effectiveRightTab === "cuentas" ? (
                      <CuentasPanel state={state} locale={locale} embeddedInFolder={true} />
                    ) : (
                      <HistorialPanel
                        state={state}
                        unlockedAchievements={profile.achievements}
                        locale={locale}
                        embeddedInFolder={true}
                      />
                    )}
                  </div>
                ) : (
                  <>
                    <CuentasPanel state={state} locale={locale} className="shrink-0 max-h-[50%]" />
                    <HistorialPanel
                      state={state}
                      unlockedAchievements={profile.achievements}
                      locale={locale}
                      className="flex-1 min-h-[200px]"
                    />
                  </>
                )}
              </aside>
            </div>
          )}
        </main>

        {/* Mobile & Portrait-Tablet Navigation (< 1024px; docks as left vertical rail in phone landscape) */}
        <nav
          aria-label={ui.game.mobileNavAria}
          className="mobile-desk-nav lg:hidden fixed bottom-0 inset-x-0 z-30 border-t-2 border-[#1f2421] bg-[#fffdf8]/98 backdrop-blur-xs pb-[env(safe-area-inset-bottom)]"
        >
          <div role="tablist" onKeyDown={handleMobileTabKeyDown} className="grid grid-cols-4">
            {MOBILE_TAB_ICONS.map(({ id, Icon }) => {
              const isActive = activeMobileTab === id;
              const label = ui.game.tabs[id];
              const dotTone =
                id === "entorno" && hasEntornoAlert
                  ? "bg-[#c97a16]"
                  : id === "cuentas" && hasCuentasAlert
                    ? "bg-[#c97a16]"
                    : id === "historial" && hasHistorialAlert
                      ? "bg-[#d4a017]"
                      : null;

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
                  className={`mobile-desk-tab-btn relative min-h-12 sm:min-h-13 py-1 px-1 flex flex-col items-center justify-center gap-0.5 text-xs font-bold transition-colors cursor-pointer ${
                    isActive
                      ? "bg-[#fcf4df] text-[#7a4308] border-t-2 border-[#7a4308]"
                      : "text-[#373f3a] hover:bg-[#f6efe0]"
                  }`}
                >
                  <span className="relative inline-flex items-center justify-center pointer-events-none">
                    <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                    {dotTone && (
                      <span
                        data-testid={`mobile-tab-dot-${id}`}
                        aria-hidden="true"
                        className={`absolute -top-0.5 -right-1.5 w-2 h-2 rounded-full border border-[#1f2421] ${dotTone}`}
                      />
                    )}
                  </span>
                  <span className="pointer-events-none">{label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>

      {/* Phase Modals (outside inert workspace shell) */}
      {showQuarterlyModal && (
        <QuarterlyTaxModal state={state} locale={locale} onSettle={handleSettleQuarterlyTax} />
      )}

      {showVictoryModal && (
        <VictoryModal state={state} locale={locale} onDecide={handleDecideVictory} />
      )}

      {showAnnualModal && (
        <AnnualSummaryModal state={state} locale={locale} onClose={handleCloseAnnualSummary} />
      )}

      {abandonModalOpen && !abandonDisabled && (
        <AbandonRunModal
          locale={locale}
          onConfirmAbandon={(endingId) => void abandonActiveRun(endingId)}
          onCancel={() => setAbandonModalOpen(false)}
        />
      )}
    </div>
  );
}
