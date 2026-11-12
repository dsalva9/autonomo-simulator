import { AlertOctagon, CalendarClock, Landmark, ShieldAlert } from "lucide-react";
import { useRef } from "react";
import {
  type GameState,
  type QuarterlySettlementMode,
  canDeferQuarterlyTax,
} from "../../engine/index.ts";
import { compiledCatalog } from "../../services/content/catalog.ts";
import { formatEuros } from "../../services/i18n/resolveEventText.ts";
import { useModalKeyboard } from "./useModalKeyboard.ts";

export interface QuarterlyTaxModalProps {
  state: GameState;
  onSettle: (mode: QuarterlySettlementMode) => void;
}

export function QuarterlyTaxModal({ state, onSettle }: QuarterlyTaxModalProps) {
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
      deferDisabledReason = "Ya tienes un aplazamiento pendiente de liquidar.";
    } else if (accruedDue <= 0) {
      deferDisabledReason = "No hay cuota devengada positiva que aplazar este trimestre.";
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
      className="fixed inset-0 z-50 m-0 h-dvh w-full max-h-none max-w-none border-0 bg-[#1f2421]/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
    >
      <div className="paper-dossier animate-dossier w-full max-w-xl max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2.5rem)] flex flex-col rounded-xl overflow-hidden">
        {/* Official Red Header */}
        <div className="bg-[#b42b24] text-[#fffdf8] px-4 sm:px-5 py-2.5 border-b-2 border-[#1f2421] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <Landmark className="w-5 h-5 shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <p className="stamp-badge text-[10px] sm:text-xs text-[#fce592] truncate">
                MODELO 303 / 130 · AUTOLIQUIDACIÓN
              </p>
              <h2
                id="trimestre-modal-title"
                className="font-editorial text-base sm:text-lg font-bold"
              >
                El Trimestre · Mes {state.month} (T{report?.quarter ?? 1})
              </h2>
            </div>
          </div>
          <span className="stamp-badge text-[10px] sm:text-xs px-2 py-0.5 rounded bg-[#1f2421] text-[#fffdf8] shrink-0">
            OBLIGATORIO
          </span>
        </div>

        <div className="p-3.5 sm:p-4 space-y-2.5 text-sm overflow-y-auto dossier-scroll">
          <p className="text-xs sm:text-sm text-[#373f3a] leading-relaxed">
            Llega el día 20 y toca ajustar cuentas con la Agencia Tributaria por lo facturado en los
            últimos tres meses.
          </p>

          {/* Breakdown Ledger */}
          <div className="rounded-lg border border-[#1f2421]/40 bg-[#f6efe0] p-3.5 space-y-1.5 text-xs sm:text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#373f3a]">Facturación oficial del trimestre:</span>
              <span className="font-bureau font-bold text-[#1f2421] tabular-nums whitespace-nowrap shrink-0">
                {formatEuros(report?.quarter_billed ?? state.finances.current_quarter_billed)}
              </span>
            </div>

            {report && report.gestor_error_surcharge > 0 && (
              <div className="flex items-center justify-between gap-2 text-[#b42b24] font-semibold">
                <span>Recargo por error al rellenar casillas:</span>
                <span className="font-bureau tabular-nums whitespace-nowrap shrink-0">
                  +{formatEuros(report.gestor_error_surcharge)}
                </span>
              </div>
            )}

            {report && report.inspection_fallback_fine > 0 && (
              <div className="flex items-center justify-between gap-2 text-[#b42b24] font-semibold">
                <span>Sanción directa de comprobación tributaria:</span>
                <span className="font-bureau tabular-nums whitespace-nowrap shrink-0">
                  +{formatEuros(report.inspection_fallback_fine)}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between gap-2 font-semibold">
              <span className="text-[#1f2421]">Cuota del trimestre actual:</span>
              <span
                data-testid="trimestre-accrued-due"
                className="font-bureau font-bold text-[#b42b24] tabular-nums whitespace-nowrap shrink-0"
              >
                {formatEuros(accruedDue)}
              </span>
            </div>

            {deferredDue > 0 && (
              <div className="flex items-center justify-between gap-2 font-semibold text-[#b42b24] border-t border-[#1f2421]/18 pt-1.5">
                <span>Aplazamiento anterior vencido (inaplazable):</span>
                <span className="font-bureau font-bold tabular-nums whitespace-nowrap shrink-0">
                  {formatEuros(deferredDue)}
                </span>
              </div>
            )}

            <div className="border-t-2 border-[#1f2421] pt-2 flex items-center justify-between gap-2 text-sm sm:text-base font-bold">
              <span>Total a ingresar hoy:</span>
              <span
                data-testid="trimestre-total-due"
                className="font-bureau text-[#b42b24] tabular-nums whitespace-nowrap shrink-0"
              >
                {formatEuros(totalPayNow)}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2 text-xs text-[#4a524e]">
              <span>Caja disponible antes del pago:</span>
              <span className="font-bureau font-bold tabular-nums whitespace-nowrap shrink-0">
                {formatEuros(state.indicators.money)}
              </span>
            </div>
          </div>

          {/* Inspection Trigger Notice */}
          {report?.inspection_triggered && (
            <div className="rounded-lg border border-[#b42b24] bg-[#fdf0ef] p-3 flex items-start gap-2.5 text-xs text-[#b42b24]">
              <ShieldAlert className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-bold uppercase font-bureau">Actuación de Hacienda detectada</p>
                <p className="mt-0.5 text-[#373f3a]">
                  {report.inspection_scheduled_event_id
                    ? "Un inspector ha abierto expediente sobre tus cuentas: recibirás notificación certificada el próximo mes."
                    : "Se ha girado liquidación sancionadora inmediata sobre este cierre trimestral."}
                </p>
              </div>
            </div>
          )}

          {/* Negative Balance Warning */}
          {cashAfterFullPay < 0 && (
            <div className="rounded-lg border border-[#8f510d] bg-[#fcf4df] p-3 flex items-start gap-2 text-xs text-[#8f510d]">
              <AlertOctagon className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                Pagar al contado dejará tu cuenta en{" "}
                <strong className="font-bureau tabular-nums whitespace-nowrap">
                  {formatEuros(cashAfterFullPay)}
                </strong>{" "}
                (Números rojos).{" "}
                {cashAfterFullPay < balance.hard_debt_floor
                  ? "¡Supera el descubierto máximo permitido y provocará bancarrota inmediata!"
                  : "Recuerda que encadenar 3 meses en negativo provoca insolvencia."}
              </span>
            </div>
          )}

          {/* Settlement Choices */}
          <div className="space-y-2 pt-0.5">
            <button
              type="button"
              data-testid="trimestre-pay-btn"
              data-autofocus="true"
              data-modal-option="true"
              onClick={() => onSettle("pay")}
              className="w-full min-h-12 rounded-lg border-2 border-[#1f2421] bg-[#1f5c53] hover:bg-[#174740] text-[#fffdf8] px-3.5 sm:px-4 py-2.5 font-bold text-left flex items-center justify-between gap-3 cursor-pointer transition-colors"
            >
              <span className="inline-flex items-center gap-2 min-w-0">
                <span className="font-bureau text-xs px-1.5 py-0.5 rounded bg-[#fffdf8]/20 shrink-0 tabular-nums">
                  1
                </span>
                <span className="text-xs sm:text-sm">Pagar liquidación íntegra al contado</span>
              </span>
              <span className="font-bureau text-xs sm:text-sm shrink-0 tabular-nums whitespace-nowrap">
                -{formatEuros(totalPayNow)}
              </span>
            </button>

            <button
              type="button"
              data-testid="trimestre-defer-btn"
              data-modal-option="true"
              disabled={!canDefer}
              onClick={() => onSettle("defer")}
              className={`w-full min-h-12 rounded-lg border-2 px-3.5 sm:px-4 py-2.5 text-left transition-colors ${
                canDefer
                  ? "border-[#1f2421] bg-[#fffdf8] hover:bg-[#fcf4df] text-[#1f2421] cursor-pointer"
                  : "border-[#1f2421]/30 bg-[#efe4ce]/70 text-[#4a524e] cursor-not-allowed"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 font-bold">
                <span className="inline-flex items-center gap-2">
                  <span className="font-bureau text-xs px-1.5 py-0.5 rounded bg-[#1f2421] text-[#fffdf8] shrink-0 tabular-nums">
                    2
                  </span>
                  <CalendarClock className="w-4 h-4 shrink-0 text-[#8f510d]" aria-hidden="true" />
                  <span className="text-xs sm:text-sm">
                    Solicitar aplazamiento al próximo trimestre
                  </span>
                </span>
                <span className="font-bureau text-[11px] sm:text-xs text-[#8f510d] sm:shrink-0 pl-7 sm:pl-0 tabular-nums">
                  +{Math.round(balance.deferral_surcharge_pct * 100)}% (+
                  {formatEuros(deferralSurcharge)}) · +{balance.deferral_stress_penalty} Estrés
                </span>
              </div>
              {deferDisabledReason ? (
                <p className="mt-1 text-xs font-semibold text-[#b42b24] pl-7 sm:pl-0">
                  Bloqueado: {deferDisabledReason}
                </p>
              ) : (
                <p className="mt-1 text-xs text-[#4a524e] pl-7 sm:pl-0">
                  Pospone {formatEuros(accruedDue)} hasta el mes {state.month + 3}
                  {deferredDue > 0
                    ? ` (se cobrará hoy el aplazamiento vencido de ${formatEuros(deferredDue)})`
                    : "."}
                </p>
              )}
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
