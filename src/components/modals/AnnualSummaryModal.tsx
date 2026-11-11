import { Briefcase, CheckCircle2, FileSpreadsheet, Heart, ShieldCheck } from "lucide-react";
import { useEffect } from "react";
import { type GameState, buildAnnualSummary, getEventById } from "../../engine/index.ts";
import { compiledCatalog } from "../../services/content/catalog.ts";
import {
  formatEuros,
  formatSignedEuros,
  translateFamilyStatus,
  translateGestorTier,
} from "../../services/i18n/resolveEventText.ts";

export interface AnnualSummaryModalProps {
  state: GameState;
  onClose: () => void;
}

export function AnnualSummaryModal({ state, onClose }: AnnualSummaryModalProps) {
  const summary = buildAnnualSummary(state);
  const gestorChar = state.gestor.character_id
    ? compiledCatalog.characters[state.gestor.character_id]
    : undefined;
  const partnerChar = state.family.partner_character_id
    ? compiledCatalog.characters[state.family.partner_character_id]
    : undefined;
  const employeeChar = state.employee
    ? compiledCatalog.characters[state.employee.character_id]
    : undefined;

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        const target = event.target as HTMLElement | null;
        if (target?.tagName === "BUTTON") return;
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <dialog
      open
      aria-modal="true"
      aria-labelledby="annual-summary-title"
      data-testid="annual-summary-modal"
      className="fixed inset-0 z-50 m-0 h-dvh w-full max-h-none max-w-none border-0 bg-[#1f2421]/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
    >
      <div className="paper-dossier animate-dossier w-full max-w-lg max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2.5rem)] flex flex-col rounded-xl overflow-hidden">
        <div className="bg-[#264e7a] text-[#fffdf8] px-4 sm:px-5 py-3.5 border-b-2 border-[#1f2421] flex items-center gap-3 shrink-0">
          <FileSpreadsheet className="w-6 h-6 text-[#fce592] shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <p className="stamp-badge text-[11px] text-[#fce592]">
              MODELO 390 · RESUMEN CONTABLE ANUAL
            </p>
            <h2 id="annual-summary-title" className="font-editorial text-lg sm:text-xl font-bold">
              Cierre del Año {summary.year} (Mes {summary.month})
            </h2>
          </div>
        </div>

        <div className="p-4 sm:p-5 space-y-3.5 text-sm overflow-y-auto dossier-scroll">
          <p className="text-xs sm:text-sm text-[#373f3a]">
            Otro año natural superado sin cerrar la persiana. Balance oficial y estructura al cierre
            del ejercicio:
          </p>

          {/* Annual Accounting Ledger */}
          <div className="rounded-lg border border-[#1f2421]/35 bg-[#f6efe0] p-3.5 space-y-1.5 text-xs sm:text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#373f3a]">Facturación bruta del año:</span>
              <span className="font-bureau font-bold text-[#1f5c53] tabular-nums whitespace-nowrap shrink-0">
                +{formatEuros(summary.billed)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#373f3a]">Gastos operativos y personales:</span>
              <span className="font-bureau font-bold text-[#b42b24] tabular-nums whitespace-nowrap shrink-0">
                -{formatEuros(summary.expenses)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#373f3a]">Impuestos trimestrales abonados:</span>
              <span className="font-bureau font-bold text-[#264e7a] tabular-nums whitespace-nowrap shrink-0">
                -{formatEuros(summary.taxes_paid)}
              </span>
            </div>
            <div className="border-t border-[#1f2421]/25 pt-1.5 flex items-center justify-between gap-2 font-bold">
              <span>Variación neta de tesorería:</span>
              <span
                className={`font-bureau tabular-nums whitespace-nowrap shrink-0 ${
                  summary.net_cash_change >= 0 ? "text-[#1f5c53]" : "text-[#b42b24]"
                }`}
              >
                {formatSignedEuros(summary.net_cash_change)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 text-xs text-[#4a524e]">
              <span>Liquidez al cierre del año:</span>
              <span className="font-bureau font-bold tabular-nums whitespace-nowrap shrink-0">
                {formatEuros(summary.ending_money)}
              </span>
            </div>
          </div>

          {/* Resumen de Estructura: Gestoría, Familia, Plantilla */}
          <div data-testid="annual-structure-summary" className="space-y-1.5">
            <p className="stamp-badge text-[10px] text-[#4a524e]">
              RESUMEN DE ESTRUCTURA AL CIERRE
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div className="rounded-lg border border-[#1f2421]/20 bg-[#fffdf8] p-2.5 space-y-0.5 min-w-0">
                <span className="inline-flex items-center gap-1 stamp-badge text-[10px] text-[#8f510d]">
                  <ShieldCheck className="w-3 h-3 shrink-0" aria-hidden="true" />
                  Gestoría
                </span>
                <p className="font-bold text-[#1f2421] truncate">
                  {gestorChar ? gestorChar.name : translateGestorTier(state.gestor.tier)}
                </p>
                <p className="font-bureau text-[11px] text-[#4a524e] tabular-nums">
                  {formatEuros(state.gestor.monthly_fee)}/mes
                </p>
              </div>

              <div className="rounded-lg border border-[#1f2421]/20 bg-[#fffdf8] p-2.5 space-y-0.5 min-w-0">
                <span className="inline-flex items-center gap-1 stamp-badge text-[10px] text-[#b42b24]">
                  <Heart className="w-3 h-3 shrink-0" aria-hidden="true" />
                  Familia
                </span>
                <p className="font-bold text-[#1f2421] truncate">
                  {partnerChar ? partnerChar.name : translateFamilyStatus(state.family.status)}
                </p>
                <p className="font-bureau text-[11px] text-[#4a524e] tabular-nums">
                  {state.family.children_count > 0
                    ? `${state.family.children_count} ${state.family.children_count === 1 ? "hijo" : "hijos"} · `
                    : ""}
                  {formatEuros(state.family.monthly_cost)}/mes
                </p>
              </div>

              <div className="rounded-lg border border-[#1f2421]/20 bg-[#fffdf8] p-2.5 space-y-0.5 min-w-0">
                <span className="inline-flex items-center gap-1 stamp-badge text-[10px] text-[#1f5c53]">
                  <Briefcase className="w-3 h-3 shrink-0" aria-hidden="true" />
                  Plantilla
                </span>
                <p className="font-bold text-[#1f2421] truncate">
                  {state.employee
                    ? (employeeChar?.name ?? state.employee.role_label)
                    : "En solitario"}
                </p>
                <p className="font-bureau text-[11px] text-[#4a524e] tabular-nums">
                  {state.employee ? `${formatEuros(state.employee.monthly_cost)}/mes` : "0 €/mes"}
                </p>
              </div>
            </div>
          </div>

          {summary.highlight_event_ids.length > 0 && (
            <div className="space-y-1">
              <p className="stamp-badge text-[10px] text-[#4a524e]">Momentos memorables del año</p>
              <ul className="space-y-0.5 text-xs text-[#373f3a] list-disc list-inside">
                {summary.highlight_event_ids.map((eventId) => {
                  const ev = getEventById(compiledCatalog, eventId);
                  return <li key={eventId}>{ev ? ev.title : eventId}</li>;
                })}
              </ul>
            </div>
          )}

          <button
            type="button"
            data-testid="annual-summary-close-btn"
            onClick={onClose}
            className="w-full min-h-12 rounded-lg border-2 border-[#1f2421] bg-[#264e7a] hover:bg-[#1c3b5e] text-[#fffdf8] font-bold px-4 py-3 flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <CheckCircle2 className="w-5 h-5 shrink-0" aria-hidden="true" />
            <span>
              Archivar Año {summary.year} y abrir Año {summary.year + 1}
            </span>
          </button>
        </div>
      </div>
    </dialog>
  );
}
