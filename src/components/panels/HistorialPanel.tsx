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
  const progressPct = Math.round((unlockedCount / ACHIEVEMENT_CATALOG.length) * 100);

  return (
    <section
      data-testid="panel-historial"
      aria-label="Historial de decisiones y logros"
      className="paper-dossier rounded-xl overflow-hidden bg-[#fffdf8]"
    >
      <div className="dossier-header">
        <div className="flex items-center gap-2 min-w-0">
          <History className="w-4 h-4 text-[#8f510d] shrink-0" aria-hidden="true" />
          <h2 className="font-editorial font-bold text-base text-[#1f2421] truncate">
            Diario de Expediente
          </h2>
        </div>
        <span className="stamp-badge text-[10px] px-2 py-0.5 rounded bg-[#fcf4df] text-[#8f510d] shrink-0 tabular-nums">
          {state.history.length} APUNTES
        </span>
      </div>

      <div className="historial-body p-3 space-y-2">
        {/* Tidy Career Seals Progress + Compact 2-Column Scrollable Grid */}
        <div className="rounded-lg border border-[#1f2421]/20 bg-[#f6efe0] p-2 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold text-[#1f2421]">
            <span className="inline-flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-[#1f5c53] shrink-0" aria-hidden="true" />
              Sellos de carrera
            </span>
            <span className="font-bureau text-[11px] text-[#1f5c53] tabular-nums">
              {unlockedCount}/{ACHIEVEMENT_CATALOG.length}
            </span>
          </div>

          <div
            aria-hidden="true"
            className="h-1.5 w-full rounded-full bg-[#e5dac5] overflow-hidden border border-[#1f2421]/20"
          >
            <div
              className="h-full bg-[#1f5c53] transition-all duration-200"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <div className="historial-seals-grid grid grid-cols-2 gap-1 max-h-14 overflow-y-auto dossier-scroll pr-0.5">
            {ACHIEVEMENT_CATALOG.map((ach) => {
              const isUnlocked = Boolean(unlockedAchievements[ach.id]);
              return (
                <span
                  key={ach.id}
                  title={`${ach.title}: ${ach.description}`}
                  className={`font-bureau text-[10px] font-bold px-1.5 py-0.5 rounded border truncate ${
                    isUnlocked
                      ? "bg-[#e8f5f1] text-[#1f5c53] border-[#1f5c53]/45"
                      : "bg-[#efe4ce]/80 text-[#4a524e] border-[#1f2421]/15 opacity-75"
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
        <ul className="historial-timeline divide-y divide-[#1f2421]/12 rounded-lg border border-[#1f2421]/18 bg-[#fffdf8] max-h-24 xl:max-h-36 overflow-y-auto dossier-scroll text-xs">
          {recentEntries.map((entry) => (
            <li key={entry.id} className="px-2.5 py-1.5 space-y-0.5">
              <div className="flex items-center justify-between gap-2 font-bureau text-[11px] tabular-nums">
                <span className="font-bold text-[#8f510d]">Mes {entry.month}</span>
                {entry.money_delta !== undefined && entry.money_delta !== 0 && (
                  <span
                    className={`font-bold whitespace-nowrap ${
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
      </div>
    </section>
  );
}
