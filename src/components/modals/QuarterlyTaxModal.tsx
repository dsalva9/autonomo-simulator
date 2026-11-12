import { AlertOctagon, CalendarClock, Landmark, ShieldAlert } from "lucide-react";
import { useRef } from "react";
import {
  type GameState,
  type QuarterlySettlementMode,
  canDeferQuarterlyTax,
} from "../../engine/index.ts";
import { compiledCatalog } from "../../services/content/catalog.ts";
import { formatEuros } from "../../services/i18n/resolveEventText.ts";
import { getUiStrings } from "../../services/i18n/uiStrings.ts";
import { useGameStore } from "../../store/gameStore.ts";
import { useModalKeyboard } from "./useModalKeyboard.ts";

export interface QuarterlyTaxModalProps {
  state: GameState;
  locale?: string;
  onSettle: (mode: QuarterlySettlementMode) => void;
}

export function QuarterlyTaxModal({ state, locale: localeProp, onSettle }: QuarterlyTaxModalProps) {
  const storeLocale = useGameStore((s) => s.profile.settings.locale);
  const locale = localeProp ?? storeLocale;
  const ui = getUiStrings(locale);
  const q = ui.modals.quarterly;

  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const { balance } = compiledCatalog;
  const report = state.quarterly_report;
  const canDefer = canDeferQuarterlyTax(state);

  const accruedDue = report?.accrued_tax_due ?? state.finances.accrued_tax_liability;
  const deferredDue = report?.deferred_tax_due ?? 0;
  const totalPayNow = accruedDue + deferredDue;
  const cashAfterFullPay = state.indicators.money - totalPayNow;
  const deferralSurcharge = Math.round(accruedDue * balance.deferral_surcharge_pct);

  let deferDisabledReason: string | null = null;
  if (!canDefer) {
    if (state.finances.deferred_tax !== null) {
      deferDisabledReason = q.deferDisabledExisting;
    } else if (accruedDue <= 0) {
      deferDisabledReason = q.deferDisabledNonPositive;
    }
  }

  useModalKeyboard(dialogRef, {
    onDefaultEnter: () => onSettle("pay"),
    shortcuts: {
      "1": () => onSettle("pay"),
      "2": canDefer ? () => onSettle("defer") : undefined,
    },
  });

  return (
    <dialog
      ref={dialogRef}
      open
      aria-modal="true"
      aria-labelledby="trimestre-modal-title"
      data-testid="trimestre-modal"
      className="fixed inset-0 z-50 m-0 h-dvh w-full max-h-none max-w-none border-0 bg-[#1f2421]/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4"
    >
      <div className="paper-dossier animate-dossier w-full max-w-xl max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] flex flex-col rounded-xl overflow-hidden">
        {/* Official Red Header */}
        <div className="bg-[#b42b24] text-[#fffdf8] px-3.5 sm:px-5 py-2 sm:py-2.5 border-b-2 border-[#1f2421] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <Landmark className="w-5 h-5 shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <p className="stamp-badge text-[10px] sm:text-xs text-[#fce592] truncate">
                {q.formBadge}
              </p>
              <h2
                id="trimestre-modal-title"
                className="font-editorial text-base sm:text-lg font-bold"
              >
                {q.heading(state.month, report?.quarter ?? 1)}
              </h2>
            </div>
          </div>
          <span className="stamp-badge text-[10px] sm:text-xs px-2 py-0.5 rounded bg-[#1f2421] text-[#fffdf8] shrink-0">
            {q.mandatoryBadge}
          </span>
        </div>

        {/* Scrollable Breakdown Body */}
        <div className="flex-1 min-h-0 p-3 sm:p-4 space-y-2 text-sm overflow-y-auto dossier-scroll">
          <p className="text-xs sm:text-sm text-[#373f3a] leading-snug">{q.intro}</p>

          {/* Breakdown Ledger */}
          <div className="rounded-lg border border-[#1f2421]/40 bg-[#f6efe0] p-3 space-y-1.5 text-xs sm:text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#373f3a]">{q.quarterBilled}</span>
              <span className="font-bureau font-bold text-[#1f2421] tabular-nums whitespace-nowrap shrink-0">
                {formatEuros(
                  report?.quarter_billed ?? state.finances.current_quarter_billed,
                  locale,
                )}
              </span>
            </div>

            {report && report.gestor_error_surcharge > 0 && (
              <div className="flex items-center justify-between gap-2 text-[#b42b24] font-semibold">
                <span>{q.gestorErrorSurcharge}</span>
                <span className="font-bureau tabular-nums whitespace-nowrap shrink-0">
                  +{formatEuros(report.gestor_error_surcharge, locale)}
                </span>
              </div>
            )}

            {report && report.inspection_fallback_fine > 0 && (
              <div className="flex items-center justify-between gap-2 text-[#b42b24] font-semibold">
                <span>{q.directAuditFine}</span>
                <span className="font-bureau tabular-nums whitespace-nowrap shrink-0">
                  +{formatEuros(report.inspection_fallback_fine, locale)}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between gap-2 font-semibold">
              <span className="text-[#1f2421]">{q.currentQuarterDue}</span>
              <span
                data-testid="trimestre-accrued-due"
                className="font-bureau font-bold text-[#b42b24] tabular-nums whitespace-nowrap shrink-0"
              >
                {formatEuros(accruedDue, locale)}
              </span>
            </div>

            {deferredDue > 0 && (
              <div className="flex items-center justify-between gap-2 font-semibold text-[#b42b24] border-t border-[#1f2421]/18 pt-1.5">
                <span>{q.priorDeferralDue}</span>
                <span className="font-bureau font-bold tabular-nums whitespace-nowrap shrink-0">
                  {formatEuros(deferredDue, locale)}
                </span>
              </div>
            )}

            <div className="border-t-2 border-[#1f2421] pt-1.5 flex items-center justify-between gap-2 text-sm sm:text-base font-bold">
              <span>{q.totalDueToday}</span>
              <span
                data-testid="trimestre-total-due"
                className="font-bureau text-[#b42b24] tabular-nums whitespace-nowrap shrink-0"
              >
                {formatEuros(totalPayNow, locale)}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2 text-xs text-[#4a524e]">
              <span>{q.cashBeforePay}</span>
              <span className="font-bureau font-bold tabular-nums whitespace-nowrap shrink-0">
                {formatEuros(state.indicators.money, locale)}
              </span>
            </div>
          </div>

          {/* Inspection Trigger Notice */}
          {report?.inspection_triggered && (
            <div className="rounded-lg border border-[#b42b24] bg-[#fdf0ef] p-2.5 flex items-start gap-2 text-xs text-[#b42b24]">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-bold uppercase font-bureau">{q.auditDetectedHeading}</p>
                <p className="mt-0.5 text-[#373f3a]">
                  {report.inspection_scheduled_event_id
                    ? q.auditScheduledBody
                    : q.auditImmediateBody}
                </p>
              </div>
            </div>
          )}

          {/* Negative Balance Warning */}
          {cashAfterFullPay < 0 && (
            <div className="rounded-lg border border-[#8f510d] bg-[#fcf4df] p-2.5 flex items-start gap-2 text-xs text-[#8f510d]">
              <AlertOctagon className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                {q.overdraftWarningBefore}
                <strong className="font-bureau tabular-nums whitespace-nowrap">
                  {formatEuros(cashAfterFullPay, locale)}
                </strong>{" "}
                {q.overdraftLabel}{" "}
                {cashAfterFullPay < balance.hard_debt_floor
                  ? q.overdraftImmediateBankruptcy
                  : q.overdraftThreeMonthRule}
              </span>
            </div>
          )}
        </div>

        {/* Pinned Settlement Footer CTAs */}
        <div className="shrink-0 border-t border-[#1f2421]/18 bg-[#fffdf8] px-3 sm:px-4 py-2 sm:py-2.5 space-y-2">
          <button
            type="button"
            data-testid="trimestre-pay-btn"
            data-autofocus="true"
            data-modal-option="true"
            onClick={() => onSettle("pay")}
            className="w-full min-h-12 rounded-lg border-2 border-[#1f2421] bg-[#1f5c53] hover:bg-[#174740] text-[#fffdf8] px-3.5 sm:px-4 py-2 font-bold text-left flex items-center justify-between gap-3 cursor-pointer transition-colors"
          >
            <span className="inline-flex items-center gap-2 min-w-0">
              <span className="font-bureau text-xs px-1.5 py-0.5 rounded bg-[#fffdf8]/20 shrink-0 tabular-nums">
                1
              </span>
              <span className="text-xs sm:text-sm">{q.payFullBtn}</span>
            </span>
            <span className="font-bureau text-xs sm:text-sm shrink-0 tabular-nums whitespace-nowrap">
              -{formatEuros(totalPayNow, locale)}
            </span>
          </button>

          <button
            type="button"
            data-testid="trimestre-defer-btn"
            data-modal-option="true"
            disabled={!canDefer}
            onClick={() => onSettle("defer")}
            className={`w-full min-h-12 rounded-lg border-2 px-3.5 sm:px-4 py-2 text-left transition-colors ${
              canDefer
                ? "border-[#1f2421] bg-[#fffdf8] hover:bg-[#fcf4df] text-[#1f2421] cursor-pointer"
                : "border-[#1f2421]/30 bg-[#efe4ce]/70 text-[#4a524e] cursor-not-allowed"
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 sm:gap-2 font-bold">
              <span className="inline-flex items-center gap-2">
                <span className="font-bureau text-xs px-1.5 py-0.5 rounded bg-[#1f2421] text-[#fffdf8] shrink-0 tabular-nums">
                  2
                </span>
                <CalendarClock className="w-4 h-4 shrink-0 text-[#8f510d]" aria-hidden="true" />
                <span className="text-xs sm:text-sm">{q.requestDeferralBtn}</span>
              </span>
              <span className="font-bureau text-[11px] sm:text-xs text-[#8f510d] sm:shrink-0 pl-7 sm:pl-0 tabular-nums">
                +{Math.round(balance.deferral_surcharge_pct * 100)}% (+
                {formatEuros(deferralSurcharge, locale)}) · +{balance.deferral_stress_penalty}{" "}
                {q.stressWord}
              </span>
            </div>
            {deferDisabledReason ? (
              <p className="mt-0.5 text-[11px] sm:text-xs font-semibold text-[#b42b24] pl-7 sm:pl-0">
                {q.lockedPrefix} {deferDisabledReason}
              </p>
            ) : (
              <p className="mt-0.5 text-[11px] sm:text-xs text-[#4a524e] pl-7 sm:pl-0">
                {q.deferSummary(
                  formatEuros(accruedDue, locale),
                  state.month + 3,
                  deferredDue > 0 ? formatEuros(deferredDue, locale) : undefined,
                )}
              </p>
            )}
          </button>
        </div>
      </div>
    </dialog>
  );
}
