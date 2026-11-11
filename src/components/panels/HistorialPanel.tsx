import { Award, History } from "lucide-react";
import type { GameState, HistoryEntry } from "../../engine/index.ts";
import { formatSignedEuros } from "../../services/i18n/resolveEventText.ts";
import { ACHIEVEMENT_CATALOG } from "../../services/storage/index.ts";

export interface HistorialPanelProps {
  state: GameState;
  unlockedAchievements: Record<string, string>;
}

function describeHistoryEntryEs(entry: HistoryEntry): string {
  switch (entry.kind) {
    case "month_start":
      return "Cierre de ingresos y gastos fijos mensuales";
    case "event_choice":
      return entry.title
        ? `${entry.title}: ${entry.summary ?? "Decisión tomada"}`
        : (entry.summary ?? "Decisión registrada");
    case "invoice_paid":
      return "Factura a plazo cobrada con éxito";
    case "invoice_defaulted":
      return "Impago en factura emitida a plazo";
    case "quarterly_tax":
      return "Liquidación trimestral presentada";
    case "inspection":
      return "Requerimiento / actuación de inspección fiscal";
    case "victory_unlocked":
      return `Sello conquistado: ${entry.summary ?? "Hito de supervivencia"}`;
    case "annual_summary":
      return "Cierre contable de ejercicio anual";
    case "game_over":
      return entry.summary ?? "Fin del expediente";
  }
}

export function HistorialPanel({ state, unlockedAchievements }: HistorialPanelProps) {
  const recentEntries = [...state.history].reverse().slice(0, 30);
  const unlockedCount = ACHIEVEMENT_CATALOG.filter((a) =>
    Boolean(unlockedAchievements[a.id]),
  ).length;

  return (
    <section
      data-testid="panel-historial"
      aria-label="Historial de decisiones y logros"
      className="paper-dossier rounded-xl p-4 space-y-4"
    >
      <div className="flex items-center justify-between border-b-2 border-[#1f2421]/20 pb-2">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-[#8f510d]" aria-hidden="true" />
          <h2 className="font-editorial font-bold text-base text-[#1f2421]">
            Diario de Expediente
          </h2>
        </div>
        <span className="stamp-badge text-[10px] px-2 py-0.5 rounded bg-[#fcf4df] text-[#8f510d]">
          {state.history.length} APUNTES
        </span>
      </div>

      {/* Compact Achievements Strip */}
      <div className="rounded-lg border border-[#1f2421]/30 bg-[#f6efe0] p-2.5 space-y-1.5">
        <div className="flex items-center justify-between text-xs font-bold text-[#1f2421]">
          <span className="inline-flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-[#1f5c53]" aria-hidden="true" />
            Sellos de carrera
          </span>
          <span className="font-bureau text-[11px] text-[#1f5c53]">
            {unlockedCount}/{ACHIEVEMENT_CATALOG.length}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ACHIEVEMENT_CATALOG.map((ach) => {
            const isUnlocked = Boolean(unlockedAchievements[ach.id]);
            return (
              <span
                key={ach.id}
                className={`font-bureau text-[10px] font-bold px-2 py-0.5 rounded border ${
                  isUnlocked
                    ? "bg-[#e8f5f1] text-[#1f5c53] border-[#1f5c53]/50"
                    : "bg-[#efe4ce] text-[#4a524e] border-[#1f2421]/20 opacity-75"
                }`}
              >
                {isUnlocked ? "★ " : "○ "}
                {ach.title}
              </span>
            );
          })}
        </div>
      </div>

      {/* Reverse-Chronological Timeline */}
      <ul className="space-y-2 max-h-72 overflow-y-auto pr-1 text-xs">
        {recentEntries.map((entry) => (
          <li
            key={entry.id}
            className="rounded-lg border border-[#1f2421]/25 bg-[#fffdf8] px-3 py-2 space-y-1"
          >
            <div className="flex items-center justify-between gap-2 font-bureau text-[11px]">
              <span className="font-bold text-[#8f510d]">Mes {entry.month}</span>
              {entry.money_delta !== undefined && entry.money_delta !== 0 && (
                <span
                  className={`font-bold ${
                    entry.money_delta > 0 ? "text-[#1f5c53]" : "text-[#b42b24]"
                  }`}
                >
                  {formatSignedEuros(entry.money_delta)}
                </span>
              )}
            </div>
            <p className="text-[#373f3a] leading-snug line-clamp-2">
              {describeHistoryEntryEs(entry)}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
