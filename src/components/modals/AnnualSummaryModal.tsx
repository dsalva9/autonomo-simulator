import { CheckCircle2, FileSpreadsheet } from "lucide-react";
import { useEffect } from "react";
import { type GameState, buildAnnualSummary, getEventById } from "../../engine/index.ts";
import { compiledCatalog } from "../../services/content/catalog.ts";
import { formatEuros, formatSignedEuros } from "../../services/i18n/resolveEventText.ts";

export interface AnnualSummaryModalProps {
  state: GameState;
  onClose: () => void;
}

export function AnnualSummaryModal({ state, onClose }: AnnualSummaryModalProps) {
  const summary = buildAnnualSummary(state);

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
      className="fixed inset-0 z-50 m-0 h-full w-full max-h-none max-w-none border-0 bg-[#1f2421]/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="paper-dossier animate-dossier w-full max-w-lg rounded-xl overflow-hidden my-auto">
        <div className="bg-[#264e7a] text-[#fffdf8] px-5 py-4 border-b-2 border-[#1f2421] flex items-center gap-3">
          <FileSpreadsheet className="w-6 h-6 text-[#fce592] shrink-0" aria-hidden="true" />
          <div>
            <p className="stamp-badge text-xs text-[#fce592]">
              MODELO 390 · RESUMEN CONTABLE ANUAL
            </p>
            <h2 id="annual-summary-title" className="font-editorial text-xl font-bold">
              Cierre del Año {summary.year} (Mes {summary.month})
            </h2>
          </div>
        </div>

        <div className="p-5 sm:p-6 space-y-4 text-sm">
          <p className="text-[#373f3a]">
            Otro año natural superado sin cerrar la persiana. Aquí tienes el balance oficial del
            ejercicio:
          </p>

          <div className="rounded-lg border-2 border-[#1f2421] bg-[#f6efe0] p-4 space-y-2 text-xs sm:text-sm">
            <div className="flex justify-between">
              <span className="text-[#373f3a]">Facturación bruta del año:</span>
              <span className="font-bureau font-bold text-[#1f5c53]">
                +{formatEuros(summary.billed)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#373f3a]">Gastos operativos y personales:</span>
              <span className="font-bureau font-bold text-[#b42b24]">
                -{formatEuros(summary.expenses)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#373f3a]">Impuestos trimestrales abonados:</span>
              <span className="font-bureau font-bold text-[#264e7a]">
                -{formatEuros(summary.taxes_paid)}
              </span>
            </div>
            <div className="border-t border-[#1f2421]/30 pt-2 flex justify-between font-bold">
              <span>Variación neta de tesorería:</span>
              <span
                className={`font-bureau ${
                  summary.net_cash_change >= 0 ? "text-[#1f5c53]" : "text-[#b42b24]"
                }`}
              >
                {formatSignedEuros(summary.net_cash_change)}
              </span>
            </div>
            <div className="flex justify-between text-xs text-[#4a524e]">
              <span>Liquidez al cierre del año:</span>
              <span className="font-bureau font-bold">{formatEuros(summary.ending_money)}</span>
            </div>
          </div>

          {summary.highlight_event_ids.length > 0 && (
            <div className="space-y-1.5">
              <p className="stamp-badge text-xs text-[#4a524e]">Momentos memorables del año</p>
              <ul className="space-y-1 text-xs text-[#373f3a] list-disc list-inside">
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
            <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
            Archivar Año {summary.year} y abrir Año {summary.year + 1}
          </button>
        </div>
      </div>
    </dialog>
  );
}
