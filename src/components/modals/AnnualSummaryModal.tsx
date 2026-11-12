import { Briefcase, CheckCircle2, FileSpreadsheet, Heart, ShieldCheck } from "lucide-react";
import { useRef } from "react";
import { type GameState, buildAnnualSummary, getEventById } from "../../engine/index.ts";
import { compiledCatalog } from "../../services/content/catalog.ts";
import {
  formatEuros,
  formatSignedEuros,
  resolveEventTitle,
  translateCharacterName,
  translateEmployeeRoleLabel,
  translateFamilyStatus,
  translateGestorTier,
} from "../../services/i18n/resolveEventText.ts";
import { getUiStrings } from "../../services/i18n/uiStrings.ts";
import { useGameStore } from "../../store/gameStore.ts";
import { useModalKeyboard } from "./useModalKeyboard.ts";

export interface AnnualSummaryModalProps {
  state: GameState;
  locale?: string;
  onClose: () => void;
}

export function AnnualSummaryModal({
  state,
  locale: localeProp,
  onClose,
}: AnnualSummaryModalProps) {
  const storeLocale = useGameStore((s) => s.profile.settings.locale);
  const locale = localeProp ?? storeLocale;
  const a = getUiStrings(locale).modals.annual;

  const dialogRef = useRef<HTMLDialogElement | null>(null);
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

  useModalKeyboard(dialogRef, {
    onDefaultEnter: onClose,
    shortcuts: {
      "1": onClose,
    },
  });

  return (
    <dialog
      ref={dialogRef}
      open
      aria-modal="true"
      aria-labelledby="annual-summary-title"
      data-testid="annual-summary-modal"
      className="fixed inset-0 z-50 m-0 h-dvh w-full max-h-none max-w-none border-0 bg-[#1f2421]/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4"
    >
      <div className="paper-dossier animate-dossier w-full max-w-lg max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] flex flex-col rounded-xl overflow-hidden">
        <div className="bg-[#264e7a] text-[#fffdf8] px-4 sm:px-5 py-2.5 sm:py-3 border-b-2 border-[#1f2421] flex items-center gap-3 shrink-0">
          <FileSpreadsheet
            className="w-5 h-5 sm:w-6 sm:h-6 text-[#fce592] shrink-0"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="stamp-badge text-[10px] sm:text-[11px] text-[#fce592] truncate">
              {a.formBadge}
            </p>
            <h2 id="annual-summary-title" className="font-editorial text-base sm:text-xl font-bold">
              {a.heading(summary.year, summary.month)}
            </h2>
          </div>
        </div>

        <div className="flex-1 min-h-0 p-3 sm:p-4 space-y-2.5 text-sm overflow-y-auto dossier-scroll">
          <p className="text-xs sm:text-sm text-[#373f3a]">{a.intro}</p>

          {/* Annual Accounting Ledger */}
          <div className="rounded-lg border border-[#1f2421]/35 bg-[#f6efe0] p-3 space-y-1.5 text-xs sm:text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#373f3a]">{a.grossBilled}</span>
              <span className="font-bureau font-bold text-[#1f5c53] tabular-nums whitespace-nowrap shrink-0">
                +{formatEuros(summary.billed, locale)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#373f3a]">{a.operatingPersonalExpenses}</span>
              <span className="font-bureau font-bold text-[#b42b24] tabular-nums whitespace-nowrap shrink-0">
                -{formatEuros(summary.expenses, locale)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#373f3a]">{a.quarterlyTaxesPaid}</span>
              <span className="font-bureau font-bold text-[#264e7a] tabular-nums whitespace-nowrap shrink-0">
                -{formatEuros(summary.taxes_paid, locale)}
              </span>
            </div>
            <div className="border-t border-[#1f2421]/25 pt-1.5 flex items-center justify-between gap-2 font-bold">
              <span>{a.netCashChange}</span>
              <span
                className={`font-bureau tabular-nums whitespace-nowrap shrink-0 ${
                  summary.net_cash_change >= 0 ? "text-[#1f5c53]" : "text-[#b42b24]"
                }`}
              >
                {formatSignedEuros(summary.net_cash_change, locale)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 text-xs text-[#4a524e]">
              <span>{a.yearEndCash}</span>
              <span className="font-bureau font-bold tabular-nums whitespace-nowrap shrink-0">
                {formatEuros(summary.ending_money, locale)}
              </span>
            </div>
          </div>

          {/* Resumen de Estructura: Gestoría, Familia, Plantilla */}
          <div data-testid="annual-structure-summary" className="space-y-1.5">
            <p className="stamp-badge text-[10px] text-[#4a524e]">{a.structureHeading}</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div className="rounded-lg border border-[#1f2421]/20 bg-[#fffdf8] p-2 space-y-0.5 min-w-0">
                <span className="inline-flex items-center gap-1 stamp-badge text-[10px] text-[#8f510d]">
                  <ShieldCheck className="w-3 h-3 shrink-0" aria-hidden="true" />
                  {a.gestorCardLabel}
                </span>
                <p className="font-bold text-[#1f2421] truncate">
                  {gestorChar
                    ? translateCharacterName(gestorChar, locale)
                    : translateGestorTier(state.gestor.tier, locale)}
                </p>
                <p className="font-bureau text-[11px] text-[#4a524e] tabular-nums">
                  {formatEuros(state.gestor.monthly_fee, locale)}
                  {a.perMonthSuffix}
                </p>
              </div>

              <div className="rounded-lg border border-[#1f2421]/20 bg-[#fffdf8] p-2 space-y-0.5 min-w-0">
                <span className="inline-flex items-center gap-1 stamp-badge text-[10px] text-[#b42b24]">
                  <Heart className="w-3 h-3 shrink-0" aria-hidden="true" />
                  {a.familyCardLabel}
                </span>
                <p className="font-bold text-[#1f2421] truncate">
                  {partnerChar
                    ? translateCharacterName(partnerChar, locale)
                    : translateFamilyStatus(state.family.status, locale)}
                </p>
                <p className="font-bureau text-[11px] text-[#4a524e] tabular-nums">
                  {state.family.children_count > 0
                    ? a.childrenCountPrefix(state.family.children_count)
                    : ""}
                  {formatEuros(state.family.monthly_cost, locale)}
                  {a.perMonthSuffix}
                </p>
              </div>

              <div className="rounded-lg border border-[#1f2421]/20 bg-[#fffdf8] p-2 space-y-0.5 min-w-0">
                <span className="inline-flex items-center gap-1 stamp-badge text-[10px] text-[#1f5c53]">
                  <Briefcase className="w-3 h-3 shrink-0" aria-hidden="true" />
                  {a.staffCardLabel}
                </span>
                <p className="font-bold text-[#1f2421] truncate">
                  {state.employee
                    ? employeeChar
                      ? translateCharacterName(employeeChar, locale)
                      : translateEmployeeRoleLabel(state.employee.role_label, locale)
                    : a.soloLabel}
                </p>
                <p className="font-bureau text-[11px] text-[#4a524e] tabular-nums">
                  {state.employee
                    ? `${formatEuros(state.employee.monthly_cost, locale)}${a.perMonthSuffix}`
                    : `${formatEuros(0, locale)}${a.perMonthSuffix}`}
                </p>
              </div>
            </div>
          </div>

          {summary.highlight_event_ids.length > 0 && (
            <div className="space-y-1">
              <p className="stamp-badge text-[10px] text-[#4a524e]">{a.highlightsHeading}</p>
              <ul className="space-y-0.5 text-xs text-[#373f3a] list-disc list-inside">
                {summary.highlight_event_ids.map((eventId) => {
                  const ev = getEventById(compiledCatalog, eventId);
                  return <li key={eventId}>{ev ? resolveEventTitle(ev, locale) : eventId}</li>;
                })}
              </ul>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-[#1f2421]/18 bg-[#fffdf8] px-3 sm:px-4 py-2 sm:py-2.5">
          <button
            type="button"
            data-testid="annual-summary-close-btn"
            data-autofocus="true"
            data-modal-option="true"
            onClick={onClose}
            className="w-full min-h-12 rounded-lg border-2 border-[#1f2421] bg-[#264e7a] hover:bg-[#1c3b5e] text-[#fffdf8] font-bold px-4 py-2.5 flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <CheckCircle2 className="w-5 h-5 shrink-0" aria-hidden="true" />
            <span>{a.closeBtn(summary.year, summary.year + 1)}</span>
            <span className="hidden sm:inline-block ml-1 font-bureau text-xs px-1.5 py-0.5 rounded bg-[#fffdf8]/20">
              {a.enterKeyLabel}
            </span>
          </button>
        </div>
      </div>
    </dialog>
  );
}
