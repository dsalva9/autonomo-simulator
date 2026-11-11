import { Award, Infinity as InfinityIcon, Trophy } from "lucide-react";
import type { GameState, VictoryDecision } from "../../engine/index.ts";
import { formatDurationMonthsEs, formatEuros } from "../../services/i18n/resolveEventText.ts";

export interface VictoryModalProps {
  state: GameState;
  onDecide: (decision: VictoryDecision) => void;
}

export function VictoryModal({ state, onDecide }: VictoryModalProps) {
  const isRich = state.pending_victory_badge === "rich_150k";

  const headline = isRich ? "¡Ricachón!" : "«¡Eres un héroe!»";
  const subheadline = isRich
    ? "Has superado los 150.000 € limpios en tu cuenta corriente sin que Hacienda ni los clientes acaben contigo."
    : "Has sobrevivido diez años completos (120 meses) dado de alta en el RETA. En tu gestoría te han enmarcado el Modelo 036.";

  return (
    <dialog
      open
      aria-modal="true"
      aria-labelledby="victory-modal-title"
      data-testid="victory-modal"
      className="fixed inset-0 z-50 m-0 h-full w-full max-h-none max-w-none border-0 bg-[#1f2421]/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="paper-dossier animate-dossier w-full max-w-lg rounded-xl overflow-hidden my-auto">
        <div className="bg-[#1f5c53] text-[#fffdf8] px-5 py-4 border-b-2 border-[#1f2421] flex items-center gap-3">
          <Trophy className="w-7 h-7 text-[#fce592] shrink-0" aria-hidden="true" />
          <div>
            <p className="stamp-badge text-xs text-[#fce592]">DIPLOMA DE SUPERVIVENCIA AUTÓNOMA</p>
            <h2 id="victory-modal-title" className="font-editorial text-2xl font-bold">
              {headline}
            </h2>
          </div>
        </div>

        <div className="p-5 sm:p-6 space-y-4 text-sm">
          <p className="text-base text-[#1f2421] leading-relaxed">{subheadline}</p>

          <div className="rounded-lg border-2 border-[#1f5c53] bg-[#e8f5f1] p-3.5 space-y-1 text-xs">
            <div className="flex items-center gap-1.5 font-bureau font-bold text-[#1f5c53]">
              <Award className="w-4 h-4 shrink-0" aria-hidden="true" />
              SELLO CONQUISTADO Y BLINDADO EN TU CERTIFICADO
            </div>
            <p className="text-[#373f3a]">
              Tiempo cotizado: <strong>{formatDurationMonthsEs(state.month)}</strong> · Liquidez:{" "}
              <strong className="font-bureau">{formatEuros(state.indicators.money)}</strong>. Aunque
              decidas continuar en Modo Infinito y caigas más adelante, este sello aparecerá en tu
              certificado final.
            </p>
          </div>

          <div className="space-y-2.5 pt-2">
            <button
              type="button"
              data-testid="victory-continue-btn"
              onClick={() => onDecide("continue")}
              className="w-full min-h-12 rounded-lg border-2 border-[#1f2421] bg-[#1f5c53] hover:bg-[#174740] text-[#fffdf8] px-4 py-3 font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <InfinityIcon className="w-5 h-5" aria-hidden="true" />
              Seguir cotizando en Modo Infinito
            </button>

            <button
              type="button"
              data-testid="victory-retire-btn"
              onClick={() => onDecide("retire")}
              className="w-full min-h-12 rounded-lg border-2 border-[#1f2421] bg-[#fffdf8] hover:bg-[#fcf4df] text-[#1f2421] px-4 py-3 font-bold cursor-pointer transition-colors"
            >
              Retirarse por todo lo alto y emitir certificado
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
