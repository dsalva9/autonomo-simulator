import { AlertOctagon, CalendarClock, Landmark, ShieldAlert } from "lucide-react";
import { useEffect } from "react";
import {
  type GameState,
  type QuarterlySettlementMode,
  canDeferQuarterlyTax,
} from "../../engine/index.ts";
import { compiledCatalog } from "../../services/content/catalog.ts";
import { formatEuros } from "../../services/i18n/resolveEventText.ts";

export interface QuarterlyTaxModalProps {
  state: GameState;
  onSettle: (mode: QuarterlySettlementMode) => void;
}

export function QuarterlyTaxModal({ state, onSettle }: QuarterlyTaxModalProps) {
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

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "BUTTON") return;

      if (event.key === "1") {
        event.preventDefault();
        onSettle("pay");
      } else if (event.key === "2" && canDefer) {
        event.preventDefault();
        onSettle("defer");
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [canDefer, onSettle]);

  return (
    <dialog
      open
      aria-modal="true"
      aria-labelledby="trimestre-modal-title"
      data-testid="trimestre-modal"
      className="fixed inset-0 z-50 m-0 h-full w-full max-h-none max-w-none border-0 bg-[#1f2421]/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
    >
      <div className="paper-dossier animate-dossier w-full max-w-xl rounded-xl overflow-hidden my-auto">
        {/* Official Red Header */}
        <div className="bg-[#b42b24] text-[#fffdf8] px-5 py-4 border-b-2 border-[#1f2421] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Landmark className="w-6 h-6 shrink-0" aria-hidden="true" />
            <div>
              <p className="stamp-badge text-xs text-[#fce592]">
                MODELO 303 / 130 · AUTOLIQUIDACIÓN SIMPLIFICADA
              </p>
              <h2 id="trimestre-modal-title" className="font-editorial text-xl font-bold">
                El Trimestre · Mes {state.month} (T{report?.quarter ?? 1})
              </h2>
            </div>
          </div>
          <span className="stamp-badge text-xs px-2.5 py-1 rounded bg-[#1f2421] text-[#fffdf8] shrink-0">
            OBLIGATORIO
          </span>
        </div>

        <div className="p-5 sm:p-6 space-y-4 text-sm">
          <p className="text-[#373f3a] leading-relaxed">
            Llega el día 20 y toca ajustar cuentas con la Agencia Tributaria por lo facturado en los
            últimos tres meses.
          </p>

          {/* Breakdown Ledger */}
          <div className="rounded-lg border-2 border-[#1f2421] bg-[#f6efe0] p-4 space-y-2 text-xs sm:text-sm">
            <div className="flex justify-between">
              <span className="text-[#373f3a]">Facturación oficial del trimestre:</span>
              <span className="font-bureau font-bold text-[#1f2421]">
                {formatEuros(report?.quarter_billed ?? state.finances.current_quarter_billed)}
              </span>
            </div>

            {report && report.gestor_error_surcharge > 0 && (
              <div className="flex justify-between text-[#b42b24] font-semibold">
                <span>Recargo por error al rellenar casillas:</span>
                <span className="font-bureau">+{formatEuros(report.gestor_error_surcharge)}</span>
              </div>
            )}

            {report && report.inspection_fallback_fine > 0 && (
              <div className="flex justify-between text-[#b42b24] font-semibold">
                <span>Sanción directa de comprobación tributaria:</span>
                <span className="font-bureau">+{formatEuros(report.inspection_fallback_fine)}</span>
              </div>
            )}

            <div className="flex justify-between font-semibold">
              <span className="text-[#1f2421]">Cuota del trimestre actual:</span>
              <span
                data-testid="trimestre-accrued-due"
                className="font-bureau font-bold text-[#b42b24]"
              >
                {formatEuros(accruedDue)}
              </span>
            </div>

            {deferredDue > 0 && (
              <div className="flex justify-between font-semibold text-[#b42b24] border-t border-[#1f2421]/20 pt-2">
                <span>Aplazamiento anterior vencido (inaplazable):</span>
                <span className="font-bureau font-bold">{formatEuros(deferredDue)}</span>
              </div>
            )}

            <div className="border-t-2 border-[#1f2421] pt-2.5 flex justify-between text-base font-bold">
              <span>Total a ingresar hoy:</span>
              <span data-testid="trimestre-total-due" className="font-bureau text-[#b42b24]">
                {formatEuros(totalPayNow)}
              </span>
            </div>

            <div className="flex justify-between text-xs text-[#4a524e]">
              <span>Caja disponible antes del pago:</span>
              <span className="font-bureau font-bold">{formatEuros(state.indicators.money)}</span>
            </div>
          </div>

          {/* Inspection Trigger Notice */}
          {report?.inspection_triggered && (
            <div className="rounded-lg border-2 border-[#b42b24] bg-[#fdf0ef] p-3.5 flex items-start gap-2.5 text-xs text-[#b42b24]">
              <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
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
                <strong className="font-bureau">{formatEuros(cashAfterFullPay)}</strong> (Números
                rojos).{" "}
                {cashAfterFullPay < balance.hard_debt_floor
                  ? "¡Supera el descubierto máximo permitido y provocará bancarrota inmediata!"
                  : "Recuerda que encadenar 3 meses en negativo provoca insolvencia."}
              </span>
            </div>
          )}

          {/* Settlement Choices */}
          <div className="space-y-2.5 pt-1">
            <button
              type="button"
              data-testid="trimestre-pay-btn"
              onClick={() => onSettle("pay")}
              className="w-full min-h-12 rounded-lg border-2 border-[#1f2421] bg-[#1f5c53] hover:bg-[#174740] text-[#fffdf8] px-4 py-3 font-bold text-left flex items-center justify-between gap-3 cursor-pointer transition-colors"
            >
              <span className="inline-flex items-center gap-2">
                <span className="font-bureau text-xs px-1.5 py-0.5 rounded bg-[#fffdf8]/20 shrink-0">
                  1
                </span>
                <span>Pagar liquidación íntegra al contado</span>
              </span>
              <span className="font-bureau text-sm shrink-0">-{formatEuros(totalPayNow)}</span>
            </button>

            <button
              type="button"
              data-testid="trimestre-defer-btn"
              disabled={!canDefer}
              onClick={() => onSettle("defer")}
              className={`w-full min-h-12 rounded-lg border-2 px-4 py-3 text-left transition-colors ${
                canDefer
                  ? "border-[#1f2421] bg-[#fffdf8] hover:bg-[#fcf4df] text-[#1f2421] cursor-pointer"
                  : "border-[#1f2421]/30 bg-[#efe4ce]/70 text-[#4a524e] cursor-not-allowed"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 font-bold">
                <span className="inline-flex items-center gap-2">
                  <span className="font-bureau text-xs px-1.5 py-0.5 rounded bg-[#1f2421] text-[#fffdf8] shrink-0">
                    2
                  </span>
                  <CalendarClock className="w-4 h-4 shrink-0 text-[#8f510d]" aria-hidden="true" />
                  <span>Solicitar aplazamiento al próximo trimestre</span>
                </span>
                <span className="font-bureau text-xs text-[#8f510d] sm:shrink-0 pl-7 sm:pl-0">
                  +{Math.round(balance.deferral_surcharge_pct * 100)}% recargo (+
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
