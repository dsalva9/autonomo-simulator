import { AlertTriangle, Calendar, FileText, LogOut, ShieldAlert } from "lucide-react";
import type { GameState } from "../../engine/index.ts";
import { compiledCatalog } from "../../services/content/catalog.ts";
import {
  describeFiscalRiskTension,
  formatCalendarBadgeEs,
  formatEuros,
  formatSignedEuros,
  formatSignedInt,
} from "../../services/i18n/resolveEventText.ts";
import type { IndicatorDeltas } from "../../store/gameStore.ts";

export interface IndicatorBarProps {
  state: GameState;
  lastDeltas: IndicatorDeltas;
  onReturnToTitle: () => void;
  onOpenAbandon: () => void;
}

interface GaugeItemProps {
  testId: string;
  label: string;
  shortLabel: string;
  value: number;
  delta?: number;
  invertDanger?: boolean;
}

function GaugeItem({
  testId,
  label,
  shortLabel,
  value,
  delta,
  invertDanger = false,
}: GaugeItemProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const isDanger = invertDanger ? clamped >= 80 : clamped <= 20;
  const barColor = isDanger
    ? "bg-[#b42b24]"
    : invertDanger
      ? clamped >= 55
        ? "bg-[#c97a16]"
        : "bg-[#264e7a]"
      : clamped >= 60
        ? "bg-[#1f5c53]"
        : "bg-[#264e7a]";

  // For Stress, positive delta is harmful; for other stats, positive delta is beneficial.
  const deltaPositiveGood =
    delta !== undefined && delta !== 0 ? (invertDanger ? delta < 0 : delta > 0) : true;

  return (
    <div
      data-testid={testId}
      className={`rounded-lg border px-2.5 py-1.5 bg-[#fffdf8] ${
        isDanger ? "border-[#b42b24] bg-[#fdf0ef]" : "border-[#1f2421]/60"
      }`}
    >
      <div className="flex items-center justify-between gap-1 text-xs">
        <span className="font-semibold text-[#1f2421] truncate">
          <span className="hidden sm:inline">{label}</span>
          <span className="sm:hidden">{shortLabel}</span>
        </span>
        <div className="flex items-center gap-1 shrink-0 font-bureau font-bold">
          <span
            data-testid={`${testId}-value`}
            className={isDanger ? "text-[#b42b24]" : "text-[#1f2421]"}
          >
            {clamped}
          </span>
          {delta !== undefined && delta !== 0 && (
            <span
              data-testid={`${testId}-delta`}
              className={`text-[11px] px-1 rounded border ${
                deltaPositiveGood
                  ? "bg-[#e8f5f1] text-[#1f5c53] border-[#1f5c53]/40"
                  : "bg-[#fdf0ef] text-[#b42b24] border-[#b42b24]/40"
              }`}
            >
              {formatSignedInt(delta)}
            </span>
          )}
        </div>
      </div>
      <meter min={0} max={100} value={clamped} aria-label={label} className="sr-only">
        {clamped}%
      </meter>
      <div
        aria-hidden="true"
        className="mt-1 h-2 w-full rounded-full bg-[#e5dac5] overflow-hidden border border-[#1f2421]/30"
      >
        <div
          className={`h-full transition-all duration-200 ${barColor}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

export function IndicatorBar({
  state,
  lastDeltas,
  onReturnToTitle,
  onOpenAbandon,
}: IndicatorBarProps) {
  const calendar = formatCalendarBadgeEs(state.month);
  const fiscalTension = describeFiscalRiskTension(state.fiscal_risk);
  const isNegativeCash = state.indicators.money < 0;
  const maxNegativeMonths = compiledCatalog.balance.max_consecutive_negative_months;

  const liveAnnouncementParts: string[] = [];
  if (lastDeltas.money) liveAnnouncementParts.push(`Dinero ${formatSignedEuros(lastDeltas.money)}`);
  if (lastDeltas.moral) liveAnnouncementParts.push(`Moral ${formatSignedInt(lastDeltas.moral)}`);
  if (lastDeltas.stress) liveAnnouncementParts.push(`Estrés ${formatSignedInt(lastDeltas.stress)}`);
  if (lastDeltas.personal_life) {
    liveAnnouncementParts.push(`Vida personal ${formatSignedInt(lastDeltas.personal_life)}`);
  }
  if (lastDeltas.reputation) {
    liveAnnouncementParts.push(`Reputación ${formatSignedInt(lastDeltas.reputation)}`);
  }

  return (
    <header className="sticky top-0 z-30 border-b-2 border-[#1f2421] bg-[#f6efe0]/95 backdrop-blur-xs shadow-xs">
      <div className="max-w-[1440px] mx-auto px-3 sm:px-5 py-2.5 space-y-2">
        {/* Screen-reader live region for turn deltas */}
        <output className="sr-only" aria-live="polite">
          {liveAnnouncementParts.length > 0
            ? `${calendar.label}: ${liveAnnouncementParts.join(", ")}`
            : calendar.label}
        </output>

        {/* Top Bar: Calendar + Liquidity + Fiscal Tension + Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <div
              data-testid="indicator-calendar"
              className="inline-flex items-center gap-2 rounded-lg border-2 border-[#1f2421] bg-[#fffdf8] px-2.5 py-1"
            >
              <Calendar className="w-4 h-4 text-[#8f510d] shrink-0" aria-hidden="true" />
              <span className="font-editorial font-bold text-sm text-[#1f2421]">
                {calendar.label}
              </span>
              <span className="text-xs font-bureau font-bold px-1.5 py-0.5 rounded bg-[#efe4ce] text-[#373f3a]">
                {state.endless_mode ? `Mes ${state.month} · Infinito` : `Mes ${state.month}/120`}
              </span>
              <span
                className={`hidden md:inline-block text-xs font-bureau font-bold px-2 py-0.5 rounded ${
                  calendar.monthsUntilTrimestre === 0
                    ? "bg-[#fdf0ef] text-[#b42b24] border border-[#b42b24]/40"
                    : "bg-[#fcf4df] text-[#8f510d]"
                }`}
              >
                {calendar.trimestreLabel}
              </span>
            </div>

            {/* Money & Números Rojos Alert */}
            <div
              data-testid="indicator-money"
              className={`inline-flex items-center gap-2 rounded-lg border-2 px-3 py-1 ${
                isNegativeCash
                  ? "border-[#b42b24] bg-[#fdf0ef] text-[#b42b24]"
                  : "border-[#1f2421] bg-[#fffdf8] text-[#1f2421]"
              }`}
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-[#4a524e]">
                Caja:
              </span>
              <span
                data-testid="indicator-money-value"
                className="font-bureau font-bold text-sm sm:text-base"
              >
                {formatEuros(state.indicators.money)}
              </span>
              {lastDeltas.money !== undefined && lastDeltas.money !== 0 && (
                <span
                  data-testid="indicator-money-delta"
                  className={`font-bureau text-xs font-bold px-1.5 py-0.5 rounded border ${
                    lastDeltas.money > 0
                      ? "bg-[#e8f5f1] text-[#1f5c53] border-[#1f5c53]/40"
                      : "bg-[#fdf0ef] text-[#b42b24] border-[#b42b24]/40"
                  }`}
                >
                  {formatSignedEuros(lastDeltas.money)}
                </span>
              )}
              {isNegativeCash && (
                <span
                  data-testid="numeros-rojos-alert"
                  className="inline-flex items-center gap-1 stamp-badge text-[11px] px-1.5 py-0.5 rounded bg-[#b42b24] text-[#fffdf8]"
                >
                  <AlertTriangle className="w-3 h-3" aria-hidden="true" />
                  NÚMEROS ROJOS ({state.finances.consecutive_negative_months}/{maxNegativeMonths})
                </span>
              )}
            </div>

            {/* Subtle Fiscal Risk Tension */}
            <div
              data-testid="indicator-fiscal-risk"
              className={`hidden sm:inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                fiscalTension.level === "critical"
                  ? "border-[#b42b24] bg-[#fdf0ef] text-[#b42b24]"
                  : fiscalTension.level === "watched"
                    ? "border-[#8f510d] bg-[#fcf4df] text-[#8f510d]"
                    : "border-[#1f2421]/40 bg-[#fffdf8] text-[#4a524e]"
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Hacienda: {fiscalTension.label}</span>
            </div>
          </div>

          {/* Right Quick Actions */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              data-testid="return-title-btn"
              aria-label="Volver al inicio"
              onClick={onReturnToTitle}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#1f2421] bg-[#fffdf8] hover:bg-[#efe4ce] px-2.5 py-1.5 text-xs font-bold text-[#1f2421] transition-colors cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Inicio</span>
            </button>
            <button
              type="button"
              data-testid="abandon-run-btn"
              aria-label="Darse de baja voluntaria"
              onClick={onOpenAbandon}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#b42b24]/70 bg-[#fdf0ef] hover:bg-[#f9dcd9] px-2.5 py-1.5 text-xs font-bold text-[#b42b24] transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="sm:hidden">Baja</span>
              <span className="hidden sm:inline">Darse de baja</span>
            </button>
          </div>
        </div>

        {/* Mobile Trimestre & Fiscal Sub-strip */}
        <div className="flex sm:hidden items-center justify-between text-[11px] font-bureau font-bold text-[#4a524e] px-0.5">
          <span>{calendar.trimestreLabel}</span>
          <span>Hacienda: {fiscalTension.label}</span>
        </div>

        {/* 4 Core Bounded Gauges */}
        <section
          aria-label="Indicadores personales y de negocio"
          className="grid grid-cols-2 lg:grid-cols-4 gap-2"
        >
          <GaugeItem
            testId="indicator-moral"
            label="Moral"
            shortLabel="Moral"
            value={state.indicators.moral}
            delta={lastDeltas.moral}
          />
          <GaugeItem
            testId="indicator-stress"
            label="Estrés"
            shortLabel="Estrés"
            value={state.indicators.stress}
            delta={lastDeltas.stress}
            invertDanger={true}
          />
          <GaugeItem
            testId="indicator-personal-life"
            label="Vida personal"
            shortLabel="Vida"
            value={state.indicators.personal_life}
            delta={lastDeltas.personal_life}
          />
          <GaugeItem
            testId="indicator-reputation"
            label="Reputación"
            shortLabel="Reput."
            value={state.indicators.reputation}
            delta={lastDeltas.reputation}
          />
        </section>
      </div>
    </header>
  );
}
