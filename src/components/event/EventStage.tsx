import { ArrowRight, CheckCircle2, Dices, Lock, Receipt } from "lucide-react";
import { useEffect, useRef } from "react";
import type {
  ActiveEventView,
  GameState,
  MonthStartSummary,
  RenderMode,
} from "../../engine/index.ts";
import {
  compiledCatalog,
  resolveCharacterPortraitAsset,
  resolveEventBannerAsset,
} from "../../services/content/catalog.ts";
import {
  explainChoiceLockReasons,
  formatEuros,
  formatSignedEuros,
  formatSignedInt,
  resolveChoiceLabel,
  resolveChoiceResultText,
  resolveEventBody,
  resolveEventTitle,
  translateCategoryLabel,
} from "../../services/i18n/resolveEventText.ts";
import type { PendingOutcomeView } from "../../store/gameStore.ts";

export interface EventStageProps {
  state: GameState;
  activeEventView: ActiveEventView | null;
  pendingOutcome: PendingOutcomeView | null;
  lastMonthStart: MonthStartSummary | null;
  locale: string;
  keyboardEnabled: boolean;
  onSelectChoice: (choiceId: string) => void;
  onContinueOutcome: () => void;
}

interface DeltaPillProps {
  label: string;
  formatted: string;
  favorable: boolean;
}

function renderModeClass(mode: RenderMode): string {
  return mode === "pixel_art" ? "render-pixel-art" : "render-vector-hd";
}

function DeltaPill({ label, formatted, favorable }: DeltaPillProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-bureau text-xs font-bold tabular-nums whitespace-nowrap ${
        favorable
          ? "bg-[#e8f5f1] text-[#1f5c53] border-[#1f5c53]/50"
          : "bg-[#fdf0ef] text-[#b42b24] border-[#b42b24]/50"
      }`}
    >
      <span>{label}:</span>
      <span>{formatted}</span>
    </span>
  );
}

export function EventStage({
  state,
  activeEventView,
  pendingOutcome,
  lastMonthStart,
  locale,
  keyboardEnabled,
  onSelectChoice,
  onContinueOutcome,
}: EventStageProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!keyboardEnabled) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) {
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

      if (pendingOutcome) {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          if (target?.closest('[data-keyboard-scroll="true"]')) {
            return;
          }
          event.preventDefault();
          stageRef.current
            ?.querySelector<HTMLButtonElement>('[data-testid="outcome-continue-btn"]')
            ?.focus({ preventScroll: window.innerWidth >= 1024 });
          return;
        }
        if (event.key === "1") {
          event.preventDefault();
          onContinueOutcome();
          return;
        }
        if (event.key === "Enter" || event.key === " ") {
          // If focus is already on a button, native click handles Enter/Space; avoid double fire
          if (target?.tagName === "BUTTON") {
            return;
          }
          event.preventDefault();
          onContinueOutcome();
        }
        return;
      }

      if (!activeEventView) {
        return;
      }

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        if (target?.closest('[data-keyboard-scroll="true"]')) {
          return;
        }
        const enabledButtons = Array.from(
          stageRef.current?.querySelectorAll<HTMLButtonElement>(
            '[data-testid^="choice-btn-"]:not(:disabled)',
          ) ?? [],
        );
        if (enabledButtons.length > 0) {
          event.preventDefault();
          const active = document.activeElement as HTMLButtonElement | null;
          const currentIndex = active ? enabledButtons.indexOf(active) : -1;
          const nextIndex =
            event.key === "ArrowDown"
              ? currentIndex < 0
                ? 0
                : (currentIndex + 1) % enabledButtons.length
              : currentIndex <= 0
                ? enabledButtons.length - 1
                : currentIndex - 1;
          enabledButtons[nextIndex]?.focus({ preventScroll: window.innerWidth >= 1024 });
        }
        return;
      }

      if (/^[1-9]$/.test(event.key)) {
        const index = Number(event.key) - 1;
        const entry = activeEventView.choices[index];
        if (entry?.eligible) {
          event.preventDefault();
          onSelectChoice(entry.choice.id);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [keyboardEnabled, pendingOutcome, activeEventView, onSelectChoice, onContinueOutcome]);

  const activeCharacter = activeEventView?.event.character_id
    ? compiledCatalog.characters[activeEventView.event.character_id]
    : undefined;
  const activeCharacterExpression = activeEventView?.event.character_expression ?? "neutral";
  const activeCharacterPortrait = activeEventView
    ? resolveCharacterPortraitAsset(
        compiledCatalog.manifest,
        activeCharacter,
        activeCharacterExpression,
      )
    : null;
  const bannerResolution = activeEventView
    ? resolveEventBannerAsset(compiledCatalog.manifest, activeEventView.event, state)
    : null;

  return (
    <div ref={stageRef} data-testid="event-stage" className="space-y-2.5">
      {/* Monthly Recurring Economy Strip: Single-Line Desktop Ticker / 2-Band Mobile Ledger */}
      {lastMonthStart && lastMonthStart.month === state.month && !pendingOutcome && (
        <div
          data-testid="month-economy-strip"
          className="paper-dossier-warm rounded-xl overflow-hidden text-xs"
        >
          <div className="px-3 sm:px-3.5 py-1.5 bg-[#efe4ce]/65 flex flex-wrap items-center justify-between gap-x-2 xl:gap-x-3 gap-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-[#1f2421] min-w-0">
              <Receipt className="w-3.5 h-3.5 text-[#1f5c53] shrink-0" aria-hidden="true" />
              <span className="truncate">
                <span className="hidden xl:inline">Liquidación fija · </span>
                <span className="xl:hidden">Liq. </span>
                Mes {lastMonthStart.month}
              </span>
            </div>

            <span
              className={`font-bureau text-[11px] font-bold tabular-nums whitespace-nowrap shrink-0 sm:order-3 ${
                lastMonthStart.net_recurring_cash >= 0 ? "text-[#1f5c53]" : "text-[#b42b24]"
              }`}
            >
              Caja fija: {formatSignedEuros(lastMonthStart.net_recurring_cash)}
            </span>

            <div className="w-full sm:w-auto sm:order-2 flex items-center justify-between sm:justify-start gap-x-2 xl:gap-x-3 pt-1 sm:pt-0 border-t sm:border-t-0 border-[#1f2421]/14 font-bureau text-[11px] tabular-nums">
              <span>
                <span className="text-[#4a524e]">Fact.: </span>
                <strong className="font-bold text-[#1f5c53] whitespace-nowrap">
                  +{formatEuros(lastMonthStart.gross_billing)}
                </strong>
              </span>
              <span>
                <span className="text-[#4a524e]">Fijos: </span>
                <strong className="font-bold text-[#b42b24] whitespace-nowrap">
                  -{formatEuros(lastMonthStart.total_expenses)}
                </strong>
              </span>
              <span>
                <span className="text-[#4a524e]">IVA/IRPF: </span>
                <strong className="font-bold text-[#264e7a] whitespace-nowrap">
                  +{formatEuros(lastMonthStart.tax_accrued_on_billing)}
                </strong>
              </span>
            </div>
          </div>

          {lastMonthStart.invoices_settled.length > 0 && (
            <div className="px-3 sm:px-3.5 py-1 border-t border-[#1f2421]/14 bg-[#fffdf8]/90 flex flex-wrap gap-x-3 gap-y-0.5 font-bureau text-[11px] font-bold tabular-nums">
              {lastMonthStart.invoices_settled.map((inv) => (
                <span
                  key={inv.invoice_id}
                  className={inv.paid ? "text-[#1f5c53]" : "text-[#b42b24]"}
                >
                  {inv.paid
                    ? `✓ Factura cobrada: +${formatEuros(inv.amount)}`
                    : `✗ Factura impagada (${formatEuros(inv.amount)})`}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Outcome Resolution View */}
      {pendingOutcome ? (
        <article
          data-testid="outcome-panel"
          aria-live="polite"
          className="paper-dossier animate-dossier rounded-xl overflow-hidden"
        >
          <div className="dossier-header">
            <span className="stamp-badge text-[11px] px-2 py-0.5 rounded bg-[#e8f5f1] text-[#1f5c53] border border-[#1f5c53]/45 shrink-0">
              {state.ending ? "Expediente cerrado" : "Resolución registrada"}
            </span>
            <span className="font-bureau text-xs font-bold text-[#4a524e] truncate">
              {resolveEventTitle(pendingOutcome.event, locale)}
            </span>
          </div>

          <div className="p-3.5 sm:p-4 space-y-3">
            <div className="rounded-lg bg-[#f6efe0] border border-[#1f2421]/20 px-3 py-2 text-xs text-[#373f3a]">
              <span className="font-bold text-[#1f2421]">Decisión tomada: </span>
              <span>{pendingOutcome.choiceLabel}</span>
            </div>

            <p
              data-testid="outcome-result-text"
              className="text-sm sm:text-base leading-relaxed text-[#1f2421] font-medium"
            >
              {resolveChoiceResultText(
                pendingOutcome.event.id,
                pendingOutcome.choiceId,
                pendingOutcome.outcome.outcome_id,
                pendingOutcome.outcome.result_text,
                locale,
              ) ?? "La decisión queda anotada en tu libro de contabilidad y el mes sigue su curso."}
            </p>

            {/* Applied Deltas Breakdown */}
            <div data-testid="outcome-deltas" className="flex flex-wrap gap-1.5 pt-0.5">
              {pendingOutcome.outcome.money_delta !== 0 && (
                <DeltaPill
                  label="Caja"
                  formatted={formatSignedEuros(pendingOutcome.outcome.money_delta)}
                  favorable={pendingOutcome.outcome.money_delta > 0}
                />
              )}
              {pendingOutcome.outcome.moral_delta !== 0 && (
                <DeltaPill
                  label="Moral"
                  formatted={formatSignedInt(pendingOutcome.outcome.moral_delta)}
                  favorable={pendingOutcome.outcome.moral_delta > 0}
                />
              )}
              {pendingOutcome.outcome.stress_delta !== 0 && (
                <DeltaPill
                  label="Estrés"
                  formatted={formatSignedInt(pendingOutcome.outcome.stress_delta)}
                  favorable={pendingOutcome.outcome.stress_delta < 0}
                />
              )}
              {pendingOutcome.outcome.personal_life_delta !== 0 && (
                <DeltaPill
                  label="Vida personal"
                  formatted={formatSignedInt(pendingOutcome.outcome.personal_life_delta)}
                  favorable={pendingOutcome.outcome.personal_life_delta > 0}
                />
              )}
              {pendingOutcome.outcome.reputation_delta !== 0 && (
                <DeltaPill
                  label="Reputación"
                  formatted={formatSignedInt(pendingOutcome.outcome.reputation_delta)}
                  favorable={pendingOutcome.outcome.reputation_delta > 0}
                />
              )}
              {pendingOutcome.outcome.fiscal_risk_delta !== 0 && (
                <DeltaPill
                  label="Tensión Hacienda"
                  formatted={
                    pendingOutcome.outcome.fiscal_risk_delta > 0 ? "Aumenta ▲" : "Se relaja ▼"
                  }
                  favorable={pendingOutcome.outcome.fiscal_risk_delta < 0}
                />
              )}
              {pendingOutcome.outcome.scheduled_event_ids.length > 0 && (
                <span className="inline-flex items-center gap-1 rounded-md border border-[#8f510d]/50 bg-[#fcf4df] px-2.5 py-1 font-bureau text-xs font-bold text-[#8f510d]">
                  ⏳ Tendrá consecuencias más adelante
                </span>
              )}
            </div>

            <div className="pt-0.5">
              <button
                type="button"
                data-testid="outcome-continue-btn"
                onClick={onContinueOutcome}
                className="w-full min-h-12 rounded-lg border-2 border-[#1f2421] bg-[#1f5c53] hover:bg-[#174740] text-[#fffdf8] font-bold text-base px-5 py-2.5 flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
              >
                <CheckCircle2 className="w-5 h-5 shrink-0" aria-hidden="true" />
                <span>
                  {state.ending
                    ? "Ver certificado final del expediente"
                    : state.phase === "quarterly_tax"
                      ? "Continuar al cierre trimestral"
                      : "Continuar"}
                </span>
                <span className="hidden sm:inline-block ml-1 font-bureau text-xs px-1.5 py-0.5 rounded bg-[#fffdf8]/20">
                  Intro
                </span>
                <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
              </button>
            </div>
          </div>
        </article>
      ) : activeEventView ? (
        <article
          data-testid="event-card"
          data-event-id={activeEventView.event.id}
          className="paper-dossier animate-dossier rounded-xl overflow-hidden"
        >
          {/* Standardized Bureaucratic Dossier Header */}
          <div className="dossier-header">
            <span className="stamp-badge text-[11px] px-2 py-0.5 rounded bg-[#fcf4df] text-[#8f510d] border border-[#8f510d]/45 truncate">
              EXP. {translateCategoryLabel(activeEventView.event.category)}
            </span>

            {state.current_turn_events.length > 1 ? (
              <span className="font-bureau text-[11px] font-bold px-2 py-0.5 rounded bg-[#efe4ce] text-[#1f2421] shrink-0 tabular-nums">
                +{state.current_turn_events.length - 1} pendiente
                {state.current_turn_events.length - 1 > 1 ? "s" : ""}
              </span>
            ) : (
              <span className="font-bureau text-[11px] font-bold text-[#4a524e] shrink-0 tabular-nums">
                Mes {state.month}
              </span>
            )}
          </div>

          <div className="event-card-body p-3.5 sm:p-4 space-y-2.5 sm:space-y-3">
            {/* Visual Comic Header Banner + Pinned Multi-Expression Polaroid */}
            {bannerResolution && (
              <div
                className={`relative ${activeCharacter && activeCharacterPortrait ? "sm:pb-2.5" : ""}`}
              >
                <img
                  data-testid="event-banner-art"
                  data-banner-kind={bannerResolution.kind}
                  data-asset-id={bannerResolution.asset.id}
                  src={bannerResolution.asset.url}
                  alt={`Escena de ${translateCategoryLabel(activeEventView.event.category)}`}
                  width={bannerResolution.asset.width}
                  height={bannerResolution.asset.height}
                  decoding="async"
                  className={`event-banner-img w-full ${
                    bannerResolution.kind === "milestone"
                      ? "aspect-video sm:aspect-auto sm:h-40"
                      : "aspect-[8/3] sm:aspect-auto sm:h-36"
                  } object-cover rounded-lg border-2 border-[#1f2421] bg-[#f6efe0] shadow-[2px_2px_0px_0px_rgba(31,36,33,0.85)] ${renderModeClass(
                    bannerResolution.asset.render_mode,
                  )}`}
                />

                {activeCharacter && activeCharacterPortrait && (
                  <figure
                    data-testid="event-character-polaroid"
                    data-expression={activeCharacterExpression}
                    data-asset-id={activeCharacterPortrait.id}
                    className="event-polaroid-desktop polaroid-card rounded-[3px] flex sm:block items-center gap-2.5 mx-1 sm:mx-0 mb-0 mt-2.5 sm:mt-0 p-1 sm:pb-1.5 w-fit max-w-[calc(100%-0.5rem)] sm:w-24 sm:absolute sm:right-3 sm:bottom-0 z-10"
                  >
                    <span className="polaroid-pin" aria-hidden="true" />
                    <img
                      data-testid="event-character-polaroid-img"
                      src={activeCharacterPortrait.url}
                      alt={activeCharacter.name}
                      width={activeCharacterPortrait.width}
                      height={activeCharacterPortrait.height}
                      decoding="async"
                      className={`w-10 h-10 sm:w-full aspect-square object-cover shrink-0 border border-[#1f2421]/35 bg-[#f6efe0] ${renderModeClass(
                        activeCharacterPortrait.render_mode,
                      )}`}
                    />
                    <figcaption className="min-w-0 pr-1 sm:pr-0 sm:mt-1 px-0.5 sm:text-center font-bureau text-[10px] font-bold text-[#1f2421] leading-tight line-clamp-2">
                      {activeCharacter.name}
                    </figcaption>
                  </figure>
                )}
              </div>
            )}

            {/* Title & Body — never truncated */}
            <div className="space-y-1.5">
              <h2
                data-testid="event-title"
                className="font-editorial text-lg sm:text-xl font-bold text-[#1f2421] leading-snug"
              >
                {resolveEventTitle(activeEventView.event, locale)}
              </h2>
              <p
                data-testid="event-body"
                className="text-sm sm:text-[14.5px] text-[#373f3a] leading-relaxed lg:leading-snug"
              >
                {resolveEventBody(activeEventView.event, locale)}
              </p>
            </div>

            {/* Choice Buttons (min-height >= 48px on touch & desktop, >= 8px vertical separation) */}
            <fieldset
              className="space-y-2 pt-0.5 border-0 p-0 m-0 min-w-0"
              aria-label="Opciones de decisión"
            >
              {activeEventView.choices.map((entry, index) => {
                const { choice, eligible } = entry;
                const lockReasons = eligible
                  ? []
                  : explainChoiceLockReasons(state, choice.requirements);
                const hasWeightedOutcomes = Boolean(choice.outcomes && choice.outcomes.length > 0);

                return (
                  <button
                    key={choice.id}
                    type="button"
                    data-testid={`choice-btn-${index}`}
                    data-choice-id={choice.id}
                    disabled={!eligible}
                    onClick={() => onSelectChoice(choice.id)}
                    className={`w-full min-h-12 text-left rounded-lg border-2 px-3 sm:px-3.5 py-2 transition-all flex items-start gap-2.5 ${
                      eligible
                        ? "border-[#1f2421] bg-[#fffdf8] hover:bg-[#fcf4df] active:translate-y-px shadow-[2px_2px_0px_0px_rgba(31,36,33,0.85)] cursor-pointer"
                        : "border-[#1f2421]/35 bg-[#efe4ce]/65 text-[#4a524e] cursor-not-allowed opacity-85"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`font-bureau text-xs font-bold w-6 h-6 rounded flex items-center justify-center shrink-0 mt-0.5 border tabular-nums ${
                        eligible
                          ? "bg-[#1f2421] text-[#fffdf8] border-[#1f2421]"
                          : "bg-[#d8cbb5] text-[#4a524e] border-[#4a524e]/40"
                      }`}
                    >
                      {index + 1}
                    </span>

                    <span className="flex-1 min-w-0 space-y-0.5 self-center">
                      <span className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
                        <span className="font-semibold text-sm sm:text-[14.5px] leading-snug text-[#1f2421]">
                          {resolveChoiceLabel(activeEventView.event.id, choice, locale)}
                        </span>

                        {hasWeightedOutcomes && eligible && (
                          <span className="inline-flex items-center gap-1 font-bureau text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#fcf4df] text-[#8f510d] border border-[#8f510d]/30 shrink-0 w-fit">
                            <Dices className="w-3 h-3 shrink-0" aria-hidden="true" />
                            <span>Incertidumbre</span>
                          </span>
                        )}
                      </span>

                      {!eligible && (
                        <span
                          data-testid={`choice-lock-reason-${index}`}
                          className="flex items-center gap-1.5 text-xs font-semibold text-[#b42b24]"
                        >
                          <Lock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          <span>
                            Bloqueado:{" "}
                            {lockReasons.length > 0
                              ? lockReasons.join(" · ")
                              : "No cumples los requisitos actuales"}
                          </span>
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </fieldset>
          </div>
        </article>
      ) : (
        <div className="paper-dossier rounded-xl p-6 text-center text-sm text-[#4a524e]">
          Procesando trámite administrativo del mes {state.month}...
        </div>
      )}
    </div>
  );
}
