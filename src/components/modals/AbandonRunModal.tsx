import { LogOut, X } from "lucide-react";
import { useEffect } from "react";
import type { AbandonEndingId } from "../../engine/index.ts";

export interface AbandonRunModalProps {
  onConfirmAbandon: (endingId: AbandonEndingId) => void;
  onCancel: () => void;
}

export function AbandonRunModal({ onConfirmAbandon, onCancel }: AbandonRunModalProps) {
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onCancel]);

  return (
    <dialog
      open
      aria-modal="true"
      aria-labelledby="abandon-modal-title"
      data-testid="abandon-modal"
      className="fixed inset-0 z-50 m-0 h-full w-full max-h-none max-w-none border-0 bg-[#1f2421]/70 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="paper-dossier animate-dossier w-full max-w-md rounded-xl overflow-hidden">
        <div className="bg-[#1f2421] text-[#fffdf8] px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LogOut className="w-5 h-5 shrink-0 text-[#fce592]" aria-hidden="true" />
            <h2 id="abandon-modal-title" className="font-editorial text-lg font-bold">
              Tramitar baja voluntaria (Modelo 036)
            </h2>
          </div>
          <button
            type="button"
            data-testid="abandon-cancel-btn"
            onClick={onCancel}
            aria-label="Cerrar ventana"
            className="rounded p-1 hover:bg-[#fffdf8]/15 cursor-pointer"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="p-5 space-y-3 text-sm">
          <p className="text-[#373f3a]">
            ¿Cómo quieres cerrar definitivamente esta partida y emitir tu certificado final?
          </p>

          <button
            type="button"
            data-testid="abandon-oposiciones-btn"
            onClick={() => onConfirmAbandon("abandon_oposiciones")}
            className="w-full min-h-12 text-left rounded-lg border-2 border-[#1f2421] bg-[#fffdf8] hover:bg-[#fcf4df] px-4 py-3 font-semibold cursor-pointer"
          >
            📚 Encerrarse a preparar oposiciones
            <span className="block text-xs font-normal text-[#4a524e]">
              Cambias las facturas urgentes por el temario y los subrayadores.
            </span>
          </button>

          <button
            type="button"
            data-testid="abandon-salaried-btn"
            onClick={() => onConfirmAbandon("abandon_salaried")}
            className="w-full min-h-12 text-left rounded-lg border-2 border-[#1f2421] bg-[#fffdf8] hover:bg-[#fcf4df] px-4 py-3 font-semibold cursor-pointer"
          >
            💼 Volver a un empleo asalariado en oficina
            <span className="block text-xs font-normal text-[#4a524e]">
              Vuelves a tener jefe, pero recuperas las vacaciones pagadas.
            </span>
          </button>

          <button
            type="button"
            data-testid="abandon-cese-btn"
            onClick={() => onConfirmAbandon("abandon_subsidies")}
            className="w-full min-h-12 text-left rounded-lg border-2 border-[#1f2421] bg-[#fffdf8] hover:bg-[#fcf4df] px-4 py-3 font-semibold cursor-pointer"
          >
            📄 Solicitar el cese de actividad
            <span className="block text-xs font-normal text-[#4a524e]">
              Cierras la persiana tras comprobar la letra pequeña de emprender.
            </span>
          </button>
        </div>
      </div>
    </dialog>
  );
}
