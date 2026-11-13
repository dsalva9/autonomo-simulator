import { Award, ChevronDown, History } from "lucide-react";
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
  embeddedInFolder?: boolean;
  className?: string;
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
      if (raw === "hero_120m" || raw === "rich_150k") {
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
        return resolveLocalizedEndingQuote(state.ending.id, entry.summary, locale, state);
      }
      for (const endingId of Object.keys(ENDING_METADATA) as EndingId[]) {
        const translated = resolveLocalizedEndingQuote(endingId, entry.summary, locale, state);
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
  embeddedInFolder = false,
  className = "",
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
      className={`${
        embeddedInFolder
          ? "flex-1 min-h-0 flex flex-col overflow-hidden bg-[#fffdf8]"
          : "paper-dossier rounded-xl overflow-hidden bg-[#fffdf8] flex flex-col"
      } ${className}`}
    >
      {!embeddedInFolder ? (
        <div className="dossier-header shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <History className="w-4 h-4 text-[#7a4308] shrink-0" aria-hidden="true" />
            <h2 className="font-editorial font-bold text-base text-[#1f2421] leading-tight">
              {ui.historial.heading}
            </h2>
          </div>
          <span className="stamp-badge text-[10px] px-2 py-0.5 rounded bg-[#fcf4df] text-[#7a4308] shrink-0 tabular-nums">
            {ui.historial.entriesCountBadge(state.history.length)}
          </span>
        </div>
      ) : (
        <h2 className="sr-only">{ui.historial.heading}</h2>
      )}

      <div className="historial-body flex-1 min-h-0 flex flex-col gap-2 p-2.5 sm:p-3">
        {/* Compact 28px Collapsible Career Seals Accordion (non-truncating rows when expanded) */}
        <details
          data-testid="historial-seals-accordion"
          className="group shrink-0 rounded-lg border border-[#1f2421]/22 bg-[#f6efe0] overflow-hidden"
        >
          <summary className="min-h-7 px-2.5 py-1 flex items-center justify-between gap-2 text-xs font-bold text-[#1f2421] cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden hover:bg-[#efe4ce]/70 transition-colors">
            <span className="inline-flex items-center gap-1.5 min-w-0">
              <Award className="w-3.5 h-3.5 text-[#1f5c53] shrink-0" aria-hidden="true" />
              <span>{ui.historial.careerSealsHeading}</span>
              <span className="font-bureau text-[11px] text-[#1f5c53] tabular-nums shrink-0">
                · {unlockedCount}/{localizedAchievements.length}
              </span>
            </span>

            <span className="inline-flex items-center gap-1.5 shrink-0">
              <span
                aria-hidden="true"
                className="hidden sm:inline-block w-12 h-1.5 rounded-full bg-[#e5dac5] overflow-hidden border border-[#1f2421]/20"
              >
                <span
                  className="block h-full bg-[#1f5c53] transition-all duration-200"
                  style={{ width: `${progressPct}%` }}
                />
              </span>
              <ChevronDown
                className="w-3.5 h-3.5 text-[#4a524e] transition-transform duration-150 group-open:rotate-180"
                aria-hidden="true"
              />
            </span>
          </summary>

          <div className="px-2 pb-2 pt-1.5 border-t border-[#1f2421]/14 max-h-40 overflow-y-auto dossier-scroll">
            <div className="historial-seals-grid grid grid-cols-2 gap-1">
              {localizedAchievements.map((ach) => {
                const isUnlocked = Boolean(unlockedAchievements[ach.id]);
                return (
                  <span
                    key={ach.id}
                    title={`${ach.title}: ${ach.description}`}
                    className={`font-bureau text-[10px] leading-tight font-bold px-1.5 py-1 rounded border break-words ${
                      isUnlocked
                        ? "bg-[#e8f5f1] text-[#1f5c53] border-[#1f5c53]/45"
                        : "bg-[#efe4ce] text-[#373f3a] border-[#1f2421]/25"
                    }`}
                  >
                    {isUnlocked ? "★ " : "○ "}
                    {ach.title}
                  </span>
                );
              })}
            </div>
          </div>
        </details>

        {/* Reverse-Chronological Timeline — uncapped flex-1 on desktop, natural scroll on mobile */}
        <ul
          data-testid="historial-timeline"
          data-keyboard-scroll="true"
          // biome-ignore lint/a11y/noNoninteractiveTabindex: WCAG 2.1.1 scrollable log container requires keyboard focus for Arrow/Page scrolling
          tabIndex={0}
          aria-label={ui.historial.timelineAria}
          className="historial-timeline flex-1 min-h-0 divide-y divide-[#1f2421]/12 rounded-lg border border-[#1f2421]/18 bg-[#fffdf8] overflow-y-auto dossier-scroll text-xs"
        >
          {recentEntries.map((entry) => (
            <li key={entry.id} className="px-2.5 py-1.5 space-y-0.5">
              <div className="flex items-center justify-between gap-2 font-bureau text-[11px] tabular-nums">
                <span className="font-bold text-[#7a4308]">
                  {ui.historial.monthLabel(entry.month)}
                </span>
                {entry.money_delta !== undefined && entry.money_delta !== 0 && (
                  <span
                    className={`font-bold whitespace-nowrap ${
                      entry.money_delta > 0 ? "text-[#1f5c53]" : "text-[#9e221b]"
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
