import {
  AlertTriangle,
  Calendar,
  FileText,
  LogOut,
  ShieldAlert,
  Volume2,
  VolumeX,
  Zap,
} from "lucide-react";
import {
  type GameState,
  computeNetCashAfterTaxReserve,
  computeReservedTaxObligation,
} from "../../engine/index.ts";
import { playUiSound } from "../../services/audio/soundEffects.ts";
import { compiledCatalog } from "../../services/content/catalog.ts";
import {
  describeFiscalRiskTension,
  formatCalendarBadgeEs,
  formatEuros,
  formatSignedEuros,
  formatSignedInt,
} from "../../services/i18n/resolveEventText.ts";
import type { IndicatorDeltas } from "../../store/gameStore.ts";
import { useUIStore } from "../../store/uiStore.ts";

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
      className={`rounded-lg border px-2 py-1 lg:px-3 lg:py-1.5 flex flex-col justify-between bg-[#fffdf8] ${
        isDanger ? "border-[#b42b24] bg-[#fdf0ef]" : "border-[#1f2421]/55"
      }`}
    >
      <div className="flex items-center justify-between gap-0.5 min-h-[16px] leading-none">
        <span className="font-semibold text-[11px] lg:text-xs text-[#1f2421] truncate">
          <span className="hidden sm:inline">{label}</span>
          <span className="sm:hidden">{shortLabel}</span>
        </span>
        <div className="flex items-center gap-0.5 shrink-0 font-bureau font-bold tabular-nums">
          <span
            data-testid={`${testId}-value`}
            className={`text-[11px] lg:text-xs ${isDanger ? "text-[#b42b24]" : "text-[#1f2421]"}`}
          >
            {clamped}
          </span>
          {delta !== undefined && delta !== 0 && (
            <span
              data-testid={`${testId}-delta`}
              className={`text-[10px] leading-none px-1 py-0.5 rounded border ${
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
        className="mt-1 h-1.5 w-full rounded-full bg-[#e5dac5] overflow-hidden border border-[#1f2421]/25"
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
  const sfxMuted = useUIStore((s) => s.sfxMuted);
  const toggleSfxMuted = useUIStore((s) => s.toggleSfxMuted);
  const fastPacing = useUIStore((s) => s.fastPacing);
  const toggleFastPacing = useUIStore((s) => s.toggleFastPacing);

  const calendar = formatCalendarBadgeEs(state.month);
  const fiscalTension = describeFiscalRiskTension(state.fiscal_risk);
  const isNegativeCash = state.indicators.money < 0;
  const maxNegativeMonths = compiledCatalog.balance.max_consecutive_negative_months;

  const reservedTax = computeReservedTaxObligation(state);
  const netCashAfterTax = computeNetCashAfterTaxReserve(state);

  const handleToggleSfx = () => {
    const willBeUnmuted = sfxMuted;
    toggleSfxMuted();
    if (willBeUnmuted) {
      playUiSound("paper_choice", { muted: false });
    }
  };

  const handleToggleFastPacing = () => {
    toggleFastPacing();
    playUiSound("paper_choice", { muted: sfxMuted });
  };

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
    <header className="sticky top-0 z-30 border-b-2 border-[#1f2421] bg-[#f6efe0]/96 backdrop-blur-xs shadow-xs">
      <div className="max-w-[1400px] mx-auto px-2.5 sm:px-5 py-1.5 lg:py-2 space-y-1.5">
        {/* Screen-reader live region for turn deltas */}
        <output className="sr-only" aria-live="polite">
          {liveAnnouncementParts.length > 0
            ? `${calendar.label}: ${liveAnnouncementParts.join(", ")}`
            : calendar.label}
        </output>

        {/* Command Band 1:
            - Mobile (<1024px): Row 1 = Calendar (left) + Toolbar (right); Row 2 = Full-width Treasury & Hacienda strip.
            - Desktop (>=1024px): Single aligned horizontal row = Calendar | Treasury & Hacienda | Toolbar. */}
        <div className="grid grid-cols-[minmax(0,1fr)_auto] lg:flex lg:items-center lg:justify-between gap-1.5 lg:gap-3">
          {/* 1. Calendar & Trimestre Pill */}
          <div
            data-testid="indicator-calendar"
            className="order-1 lg:order-1 inline-flex items-center gap-1.5 self-center justify-self-start rounded-lg border border-[#1f2421]/80 bg-[#fffdf8] px-2 py-1 min-w-0 max-w-full"
          >
            <Calendar className="w-3.5 h-3.5 text-[#8f510d] shrink-0" aria-hidden="true" />
            <span className="font-editorial font-bold text-xs sm:text-sm text-[#1f2421] whitespace-nowrap">
              {calendar.label}
            </span>
            <span className="font-bureau text-[10px] sm:text-[11px] font-bold px-1.5 py-0.5 rounded bg-[#efe4ce] text-[#373f3a] whitespace-nowrap tabular-nums">
              {state.endless_mode ? `M${state.month}·∞` : `M${state.month}/120`}
            </span>
            <span
              className={`hidden min-[385px]:inline-block font-bureau text-[10px] sm:text-[11px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap tabular-nums ${
                calendar.monthsUntilTrimestre === 0
                  ? "bg-[#fdf0ef] text-[#b42b24] border border-[#b42b24]/40"
                  : "bg-[#fcf4df] text-[#8f510d]"
              }`}
            >
              <span className="hidden xl:inline">{calendar.trimestreLabel}</span>
              <span className="xl:hidden">
                {calendar.monthsUntilTrimestre === 0
                  ? `T${calendar.quarter} hoy`
                  : `T${calendar.quarter}·${calendar.monthsUntilTrimestre}m`}
              </span>
            </span>
          </div>

          {/* 2. Utility & Session Actions (Flush Right on Mobile Row 1 & Desktop Band 1) */}
          <div className="order-2 lg:order-3 flex items-center gap-1 justify-self-end shrink-0">
            <button
              type="button"
              data-testid="toggle-sfx-btn"
              aria-label="Sonido de oficina"
              aria-pressed={!sfxMuted}
              title={sfxMuted ? "Sonido silenciado (activar)" : "Sonido activo (silenciar)"}
              onClick={handleToggleSfx}
              className={`h-7 min-w-7 px-1.5 xl:px-2 inline-flex items-center justify-center gap-1 rounded-md border text-[11px] font-bold transition-colors cursor-pointer ${
                sfxMuted
                  ? "border-[#1f2421]/40 bg-[#efe4ce]/80 text-[#4a524e]"
                  : "border-[#1f2421]/75 bg-[#fffdf8] hover:bg-[#efe4ce] text-[#1f2421]"
              }`}
            >
              {sfxMuted ? (
                <VolumeX className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 shrink-0 text-[#1f5c53]" aria-hidden="true" />
              )}
              <span className="hidden xl:inline">Sonido</span>
            </button>

            <button
              type="button"
              data-testid="toggle-fast-pacing-btn"
              aria-label="Modo ágil"
              aria-pressed={fastPacing}
              title={
                fastPacing
                  ? "Modo ágil activado (volver a lectura normal)"
                  : "Activar Modo ágil (avanzar sin pausa intermedia)"
              }
              onClick={handleToggleFastPacing}
              className={`h-7 min-w-7 px-1.5 xl:px-2 inline-flex items-center justify-center gap-1 rounded-md border text-[11px] font-bold transition-colors cursor-pointer ${
                fastPacing
                  ? "border-[#8f510d] bg-[#fcf4df] text-[#8f510d]"
                  : "border-[#1f2421]/75 bg-[#fffdf8] hover:bg-[#efe4ce] text-[#1f2421]"
              }`}
            >
              <Zap className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span className="hidden xl:inline">Modo ágil</span>
            </button>

            <button
              type="button"
              data-testid="return-title-btn"
              aria-label="Volver al inicio"
              onClick={onReturnToTitle}
              className="h-7 px-2 inline-flex items-center gap-1 rounded-md border border-[#1f2421]/80 bg-[#fffdf8] hover:bg-[#efe4ce] text-[11px] font-bold text-[#1f2421] transition-colors cursor-pointer whitespace-nowrap"
            >
              <FileText className="w-3 h-3 shrink-0" aria-hidden="true" />
              <span>Inicio</span>
            </button>

            <button
              type="button"
              data-testid="abandon-run-btn"
              aria-label="Darse de baja voluntaria"
              onClick={onOpenAbandon}
              className="h-7 px-2 inline-flex items-center gap-1 rounded-md border border-[#b42b24]/75 bg-[#fdf0ef] hover:bg-[#f9dcd9] text-[11px] font-bold text-[#b42b24] transition-colors cursor-pointer whitespace-nowrap"
            >
              <LogOut className="w-3 h-3 shrink-0" aria-hidden="true" />
              <span className="sm:hidden">Baja</span>
              <span className="hidden sm:inline">Darse de baja</span>
            </button>
          </div>

          {/* 3. Treasury (Caja + Tax Reserve + Net Cash) & Hacienda Tension Strip */}
          <div
            className={`col-span-2 order-3 lg:order-2 lg:flex-1 rounded-lg border px-2.5 py-1 flex items-center justify-between gap-2 min-w-0 ${
              isNegativeCash ? "border-[#b42b24] bg-[#fdf0ef]" : "border-[#1f2421]/80 bg-[#fffdf8]"
            }`}
          >
            <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 min-w-0">
              <div
                data-testid="indicator-money"
                className="inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <span className="text-[11px] font-semibold uppercase tracking-wide text-[#4a524e]">
                  Caja:
                </span>
                <span
                  data-testid="indicator-money-value"
                  className={`font-bureau font-bold text-xs sm:text-sm tabular-nums ${
                    isNegativeCash ? "text-[#b42b24]" : "text-[#1f2421]"
                  }`}
                >
                  {formatEuros(state.indicators.money)}
                </span>
                {lastDeltas.money !== undefined && lastDeltas.money !== 0 && (
                  <span
                    data-testid="indicator-money-delta"
                    className={`font-bureau text-[10px] sm:text-[11px] font-bold px-1.5 py-0.5 rounded border leading-none tabular-nums ${
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
                    className="inline-flex items-center gap-1 stamp-badge text-[10px] px-1.5 py-0.5 rounded bg-[#b42b24] text-[#fffdf8] leading-none"
                  >
                    <AlertTriangle className="w-3 h-3 shrink-0" aria-hidden="true" />
                    <span className="hidden sm:inline">
                      NÚMEROS ROJOS ({state.finances.consecutive_negative_months}/
                      {maxNegativeMonths})
                    </span>
                    <span className="sm:hidden">
                      ROJOS {state.finances.consecutive_negative_months}/{maxNegativeMonths}
                    </span>
                  </span>
                )}
              </div>

              <span className="hidden sm:inline text-[#1f2421]/25" aria-hidden="true">
                |
              </span>

              <div
                data-testid="indicator-net-cash"
                className="inline-flex items-center gap-1 text-[11px] font-bureau tabular-nums whitespace-nowrap text-[#4a524e]"
              >
                <span className="hidden md:inline">Reserva Trimestre:</span>
                <span className="md:hidden">Res.:</span>
                <span className="font-bold text-[#8f510d]">
                  {reservedTax > 0 ? `-${formatEuros(reservedTax)}` : formatEuros(0)}
                </span>
                <span className="text-[#1f2421]/30" aria-hidden="true">
                  ·
                </span>
                <span>Libre:</span>
                <strong
                  className={`font-bold ${
                    netCashAfterTax < 0 ? "text-[#b42b24]" : "text-[#1f5c53]"
                  }`}
                >
                  {formatEuros(netCashAfterTax)}
                </strong>
              </div>
            </div>

            {/* Hacienda Tension Badge */}
            <div
              data-testid="indicator-fiscal-risk"
              className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] sm:text-[11px] font-semibold shrink-0 whitespace-nowrap ${
                fiscalTension.level === "critical"
                  ? "border-[#b42b24]/60 bg-[#fdf0ef] text-[#b42b24]"
                  : fiscalTension.level === "watched"
                    ? "border-[#8f510d]/50 bg-[#fcf4df] text-[#8f510d]"
                    : "border-[#1f2421]/20 bg-[#f6efe0] text-[#4a524e]"
              }`}
            >
              <ShieldAlert className="w-3 h-3 shrink-0" aria-hidden="true" />
              <span className="hidden xl:inline">Hacienda:</span>
              <span>{fiscalTension.label}</span>
            </div>
          </div>
        </div>

        {/* Command Band 2: 4-Column Aligned Micro-Gauges (Mobile & Desktop) */}
        <section
          aria-label="Indicadores personales y de negocio"
          className="grid grid-cols-4 gap-1.5 lg:gap-3"
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
