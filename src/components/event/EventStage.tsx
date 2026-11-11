import { ArrowRight, CheckCircle2, Dices, Lock, Receipt } from "lucide-react";
import { useEffect } from "react";
import type { ActiveEventView, GameState, MonthStartSummary } from "../../engine/index.ts";
import { compiledCatalog } from "../../services/content/catalog.ts";
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

function DeltaPill({ label, formatted, favorable }: DeltaPillProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-bureau text-xs font-bold ${
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

      if (activeEventView && /^[1-9]$/.test(event.key)) {
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

  return (
    <div className="space-y-3.5">
      {/* Monthly Recurring Economy Strip */}
      {lastMonthStart && lastMonthStart.month === state.month && !pendingOutcome && (
        <div
          data-testid="month-economy-strip"
          className="paper-dossier-warm rounded-xl px-3.5 py-2.5 text-xs flex flex-wrap items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2 font-semibold text-[#1f2421]">
            <Receipt className="w-4 h-4 text-[#1f5c53] shrink-0" aria-hidden="true" />
            <span>Liquidación fija del mes {lastMonthStart.month}:</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 font-bureau font-bold">
            <span className="text-[#1f5c53]">
              Facturación +{formatEuros(lastMonthStart.gross_billing)}
            </span>
            <span className="text-[#b42b24]">
              Gastos -{formatEuros(lastMonthStart.total_expenses)}
            </span>
            <span className="text-[#264e7a]">
              Reserva IVA/IRPF +{formatEuros(lastMonthStart.tax_accrued_on_billing)}
            </span>
          </div>
          {lastMonthStart.invoices_settled.length > 0 && (
            <div className="w-full pt-1 border-t border-[#1f2421]/15 flex flex-wrap gap-2 font-bureau font-bold">
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

      {/* Outcome Resolution View / Banner */}
      {pendingOutcome ? (
        <article
          data-testid="outcome-panel"
          aria-live="polite"
          className="paper-dossier animate-dossier rounded-xl p-5 sm:p-6 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-dashed border-[#1f2421]/25 pb-3">
            <span className="stamp-badge text-xs px-2.5 py-1 rounded bg-[#e8f5f1] text-[#1f5c53] border border-[#1f5c53]">
              {state.ending ? "Expediente cerrado" : "Resolución registrada"}
            </span>
            <span className="font-bureau text-xs font-bold text-[#4a524e]">
              {resolveEventTitle(pendingOutcome.event, locale)}
            </span>
          </div>

          <div className="rounded-lg bg-[#f6efe0] border border-[#1f2421]/30 px-3.5 py-2.5 text-xs text-[#373f3a]">
            <span className="font-bold text-[#1f2421]">Decisión tomada: </span>
            <span>{pendingOutcome.choiceLabel}</span>
          </div>

          <p
            data-testid="outcome-result-text"
            className="text-base sm:text-lg leading-relaxed text-[#1f2421] font-medium"
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
          <div data-testid="outcome-deltas" className="flex flex-wrap gap-2 pt-1">
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

          <div className="pt-2">
            <button
              type="button"
              data-testid="outcome-continue-btn"
              onClick={onContinueOutcome}
              className="w-full min-h-12 rounded-lg border-2 border-[#1f2421] bg-[#1f5c53] hover:bg-[#174740] text-[#fffdf8] font-bold text-base px-5 py-3 flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
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
        </article>
      ) : activeEventView ? (
        <article
          data-testid="event-card"
          data-event-id={activeEventView.event.id}
          className="paper-dossier animate-dossier rounded-xl p-5 sm:p-6 space-y-5"
        >
          {/* Bureaucratic Dossier Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-[#1f2421]/20 pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="stamp-badge text-xs px-2.5 py-1 rounded bg-[#fcf4df] text-[#8f510d] border border-[#8f510d]/50">
                EXP. {translateCategoryLabel(activeEventView.event.category)}
              </span>
              {activeEventView.event.character_id &&
                compiledCatalog.characters[activeEventView.event.character_id] && (
                  <span className="text-xs font-semibold text-[#264e7a] bg-[#ebf2fa] border border-[#264e7a]/30 rounded px-2 py-0.5">
                    {compiledCatalog.characters[activeEventView.event.character_id]?.name}
                  </span>
                )}
            </div>
            {state.current_turn_events.length > 1 && (
              <span className="font-bureau text-xs font-bold px-2 py-0.5 rounded bg-[#efe4ce] text-[#1f2421]">
                Asunto pendiente (+{state.current_turn_events.length - 1} más este mes)
              </span>
            )}
          </div>

          {/* Title & Body */}
          <div className="space-y-2.5">
            <h2
              data-testid="event-title"
              className="font-editorial text-xl sm:text-2xl font-bold text-[#1f2421] leading-snug"
            >
              {resolveEventTitle(activeEventView.event, locale)}
            </h2>
            <p
              data-testid="event-body"
              className="text-sm sm:text-base text-[#373f3a] leading-relaxed"
            >
              {resolveEventBody(activeEventView.event, locale)}
            </p>
          </div>

          {/* Choice Buttons (min-height >= 48px on touch & desktop) */}
          <fieldset
            className="space-y-2.5 pt-1 border-0 p-0 m-0 min-w-0"
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
                  className={`w-full min-h-12 text-left rounded-lg border-2 px-4 py-3.5 transition-all flex items-start gap-3 ${
                    eligible
                      ? "border-[#1f2421] bg-[#fffdf8] hover:bg-[#fcf4df] active:translate-y-px shadow-[2px_2px_0px_0px_rgba(31,36,33,0.85)] cursor-pointer"
                      : "border-[#1f2421]/35 bg-[#efe4ce]/65 text-[#4a524e] cursor-not-allowed opacity-85"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`font-bureau text-xs font-bold w-6 h-6 rounded flex items-center justify-center shrink-0 mt-0.5 border ${
                      eligible
                        ? "bg-[#1f2421] text-[#fffdf8] border-[#1f2421]"
                        : "bg-[#d8cbb5] text-[#4a524e] border-[#4a524e]/40"
                    }`}
                  >
                    {index + 1}
                  </span>

                  <span className="flex-1 space-y-1">
                    <span className="block font-semibold text-sm sm:text-base leading-snug">
                      {resolveChoiceLabel(activeEventView.event.id, choice, locale)}
                    </span>

                    {hasWeightedOutcomes && eligible && (
                      <span className="inline-flex items-center gap-1 font-bureau text-[11px] font-bold text-[#8f510d]">
                        <Dices className="w-3.5 h-3.5" aria-hidden="true" />
                        Desenlace con incertidumbre
                      </span>
                    )}

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
        </article>
      ) : (
        <div className="paper-dossier rounded-xl p-6 text-center text-sm text-[#4a524e]">
          Procesando trámite administrativo del mes {state.month}...
        </div>
      )}
    </div>
  );
}
