import { Award, History } from "lucide-react";
import {
  type EndingId,
  type GameState,
  type HistoryEntry,
  type VictoryBadge,
  getEventById,
} from "../../engine/index.ts";
import { getLocalizedAchievementCatalog } from "../../services/achievements/definitions.ts";
import { compiledCatalog } from "../../services/content/catalog.ts";
import {
  ENDING_METADATA,
  getVictoryBadgeLabel,
  resolveLocalizedEndingQuote,
} from "../../services/endings/endingMetadata.ts";
import {
  formatSignedEuros,
  normalizeLocale,
  resolveChoiceLabel,
  resolveChoiceResultText,
  resolveEventTitle,
} from "../../services/i18n/resolveEventText.ts";
import { getUiStrings } from "../../services/i18n/uiStrings.ts";
import { useGameStore } from "../../store/gameStore.ts";

export interface HistorialPanelProps {
  state: GameState;
  unlockedAchievements: Record<string, string>;
  locale?: string;
}

function describeHistoryEntry(entry: HistoryEntry, state: GameState, locale: string): string {
  const ui = getUiStrings(locale);
  const isEn = normalizeLocale(locale) === "en";

  switch (entry.kind) {
    case "month_start":
      return ui.historial.entryMonthStart;
    case "event_choice": {
      if (!isEn || !entry.event_id) {
        return entry.title
          ? `${entry.title}: ${entry.summary ?? ui.historial.entryDecisionFallback}`
          : (entry.summary ?? ui.historial.entryDecisionRecordedFallback);
      }
      const ev = getEventById(compiledCatalog, entry.event_id);
      if (!ev) {
        return entry.title
          ? `${entry.title}: ${entry.summary ?? ui.historial.entryDecisionFallback}`
          : (entry.summary ?? ui.historial.entryDecisionRecordedFallback);
      }
      const localizedTitle = resolveEventTitle(ev, locale);
      const choiceObj = entry.choice_id
        ? ev.choices.find((c) => c.id === entry.choice_id)
        : undefined;
      const localizedSummary = entry.choice_id
        ? (resolveChoiceResultText(
            ev.id,
            entry.choice_id,
            entry.outcome_id ?? null,
            entry.summary ?? null,
            locale,
          ) ?? (choiceObj ? resolveChoiceLabel(ev.id, choiceObj, locale) : entry.summary))
        : entry.summary;

      return `${localizedTitle}: ${localizedSummary ?? ui.historial.entryDecisionFallback}`;
    }
    case "invoice_paid":
      return ui.historial.entryInvoicePaid;
    case "invoice_defaulted":
      return ui.historial.entryInvoiceDefaulted;
    case "quarterly_tax":
      return ui.historial.entryQuarterlyTax;
    case "inspection":
      return ui.historial.entryInspection;
    case "victory_unlocked": {
      const raw = entry.summary;
      if (isEn && (raw === "hero_120m" || raw === "rich_150k")) {
        return ui.historial.entryVictoryUnlocked(
          getVictoryBadgeLabel(raw as VictoryBadge, locale).title,
        );
      }
      return ui.historial.entryVictoryUnlocked(raw ?? ui.historial.entryVictoryFallback);
    }
    case "annual_summary":
      return ui.historial.entryAnnualSummary;
    case "game_over": {
      if (!entry.summary) {
        return ui.historial.entryGameOverFallback;
      }
      if (!isEn) {
        return entry.summary;
      }
      if (state.ending) {
        return resolveLocalizedEndingQuote(state.ending.id, entry.summary, locale);
      }
      for (const endingId of Object.keys(ENDING_METADATA) as EndingId[]) {
        const translated = resolveLocalizedEndingQuote(endingId, entry.summary, locale);
        if (translated !== entry.summary) {
          return translated;
        }
      }
      return entry.summary;
    }
  }
}

export function HistorialPanel({
  state,
  unlockedAchievements,
  locale: localeProp,
}: HistorialPanelProps) {
  const storeLocale = useGameStore((s) => s.profile.settings.locale);
  const locale = localeProp ?? storeLocale;
  const ui = getUiStrings(locale);
  const localizedAchievements = getLocalizedAchievementCatalog(locale);

  const recentEntries = [...state.history].reverse().slice(0, 30);
  const unlockedCount = localizedAchievements.filter((a) =>
    Boolean(unlockedAchievements[a.id]),
  ).length;
  const progressPct = Math.round((unlockedCount / localizedAchievements.length) * 100);

  return (
    <section
      data-testid="panel-historial"
      aria-label={ui.historial.sectionAria}
      className="paper-dossier rounded-xl overflow-hidden bg-[#fffdf8]"
    >
      <div className="dossier-header">
        <div className="flex items-center gap-2 min-w-0">
          <History className="w-4 h-4 text-[#8f510d] shrink-0" aria-hidden="true" />
          <h2 className="font-editorial font-bold text-base text-[#1f2421] truncate">
            {ui.historial.heading}
          </h2>
        </div>
        <span className="stamp-badge text-[10px] px-2 py-0.5 rounded bg-[#fcf4df] text-[#8f510d] shrink-0 tabular-nums">
          {ui.historial.entriesCountBadge(state.history.length)}
        </span>
      </div>

      <div className="historial-body p-3 space-y-2">
        {/* Tidy Career Seals Progress + Compact 2-Column Scrollable Grid */}
        <div className="rounded-lg border border-[#1f2421]/20 bg-[#f6efe0] p-2 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold text-[#1f2421]">
            <span className="inline-flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-[#1f5c53] shrink-0" aria-hidden="true" />
              {ui.historial.careerSealsHeading}
            </span>
            <span className="font-bureau text-[11px] text-[#1f5c53] tabular-nums">
              {unlockedCount}/{localizedAchievements.length}
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
            {localizedAchievements.map((ach) => {
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
        <ul
          data-testid="historial-timeline"
          data-keyboard-scroll="true"
          // biome-ignore lint/a11y/noNoninteractiveTabindex: WCAG 2.1.1 scrollable log container requires keyboard focus for Arrow/Page scrolling
          tabIndex={0}
          aria-label={ui.historial.timelineAria}
          className="historial-timeline divide-y divide-[#1f2421]/12 rounded-lg border border-[#1f2421]/18 bg-[#fffdf8] max-h-24 xl:max-h-36 overflow-y-auto dossier-scroll text-xs"
        >
          {recentEntries.map((entry) => (
            <li key={entry.id} className="px-2.5 py-1.5 space-y-0.5">
              <div className="flex items-center justify-between gap-2 font-bureau text-[11px] tabular-nums">
                <span className="font-bold text-[#8f510d]">
                  {ui.historial.monthLabel(entry.month)}
                </span>
                {entry.money_delta !== undefined && entry.money_delta !== 0 && (
                  <span
                    className={`font-bold whitespace-nowrap ${
                      entry.money_delta > 0 ? "text-[#1f5c53]" : "text-[#b42b24]"
                    }`}
                  >
                    {formatSignedEuros(entry.money_delta, locale)}
                  </span>
                )}
              </div>
              <p className="text-[#373f3a] leading-snug line-clamp-2">
                {describeHistoryEntry(entry, state, locale)}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
