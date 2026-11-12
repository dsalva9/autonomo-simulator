import {
  AlertTriangle,
  Award,
  Calendar,
  FileText,
  LogOut,
  ShieldAlert,
  Volume2,
  VolumeX,
  Zap,
} from "lucide-react";
import type { Ref } from "react";
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
  normalizeLocale,
} from "../../services/i18n/resolveEventText.ts";
import { getUiStrings } from "../../services/i18n/uiStrings.ts";
import { type IndicatorDeltas, useGameStore } from "../../store/gameStore.ts";
import { useUIStore } from "../../store/uiStore.ts";

export interface IndicatorBarProps {
  headerRef?: Ref<HTMLElement>;
  state: GameState;
  lastDeltas: IndicatorDeltas;
  locale?: string;
  onReturnToTitle: () => void;
  onOpenAbandon: () => void;
}

interface GaugeItemProps {
  testId: string;
  label: string;
  shortLabel: string;
  compactPhoneLabel: string;
  value: number;
  delta?: number;
  invertDanger?: boolean;
}

function GaugeItem({
  testId,
  label,
  shortLabel,
  compactPhoneLabel,
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
      className={`hud-gauge-card relative rounded-lg border px-1.5 sm:px-2 xl:px-2.5 py-0.5 sm:py-1 flex flex-col justify-between bg-[#fffdf8] ${
        isDanger ? "border-[#b42b24] bg-[#fdf0ef]" : "border-[#1f2421]/55"
      }`}
    >
      <div className="flex items-center justify-between gap-1 min-h-[15px] leading-none">
        <span className="font-semibold text-[11px] xl:text-xs text-[#1f2421] whitespace-nowrap">
          <span className="hidden sm:inline">{label}</span>
          <span className="hidden min-[380px]:inline sm:hidden">{shortLabel}</span>
          <span className="min-[380px]:hidden">{compactPhoneLabel}</span>
        </span>
        <div className="flex items-center gap-0.5 shrink-0 font-bureau font-bold tabular-nums">
          <span
            data-testid={`${testId}-value`}
            className={`text-[11px] xl:text-xs ${isDanger ? "text-[#9e221b]" : "text-[#1f2421]"}`}
          >
            {clamped}
          </span>
          {delta !== undefined && delta !== 0 && (
            <span
              data-testid={`${testId}-delta`}
              className={`max-sm:absolute max-sm:-top-2 max-sm:right-1 max-sm:z-10 max-sm:shadow-2xs text-[9.5px] sm:text-[10px] leading-none px-1 py-0.5 rounded border ${
                deltaPositiveGood
                  ? "bg-[#e8f5f1] text-[#1f5c53] border-[#1f5c53]/50"
                  : "bg-[#fdf0ef] text-[#9e221b] border-[#9e221b]/50"
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
        className="hud-gauge-bar-track mt-0.5 sm:mt-1 xl:mt-0.5 h-1.5 w-full rounded-full bg-[#e5dac5] overflow-hidden border border-[#1f2421]/25"
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
  headerRef,
  state,
  lastDeltas,
  locale: localeProp,
  onReturnToTitle,
  onOpenAbandon,
}: IndicatorBarProps) {
  const storeLocale = useGameStore((s) => s.profile.settings.locale);
  const toggleLocalePreference = useGameStore((s) => s.toggleLocalePreference);

  const sfxMuted = useUIStore((s) => s.sfxMuted);
  const toggleSfxMuted = useUIStore((s) => s.toggleSfxMuted);
  const fastPacing = useUIStore((s) => s.fastPacing);
  const toggleFastPacing = useUIStore((s) => s.toggleFastPacing);

  const locale = normalizeLocale(localeProp ?? storeLocale);
  const isEn = locale === "en";
  const ui = getUiStrings(locale);

  const calendar = formatCalendarBadgeEs(state.month, locale);
  const fiscalTension = describeFiscalRiskTension(state.fiscal_risk, locale);
  const isNegativeCash = state.indicators.money < 0;
  const maxNegativeMonths = compiledCatalog.balance.max_consecutive_negative_months;

  const reservedTax = computeReservedTaxObligation(state);
  const netCashAfterTax = computeNetCashAfterTaxReserve(state);

  const canRetireHonorably =
    state.endless_mode ||
    state.month >= compiledCatalog.balance.victory_month ||
    state.earned_victories.length > 0;

  const retireLongLabel = isEn ? "Retire with honors" : "Jubilarse con honores";
  const retireShortLabel = isEn ? "Retire" : "Jubilarse";
  const retireAriaLabel = isEn
    ? "Retire with honors or close dossier (B)"
    : "Jubilarse con honores o tramitar baja (B)";

  const handleToggleLocale = () => {
    playUiSound("paper_choice", { muted: sfxMuted });
    void toggleLocalePreference();
  };

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
  if (lastDeltas.money) {
    liveAnnouncementParts.push(
      `${ui.hud.liveMoney} ${formatSignedEuros(lastDeltas.money, locale)}`,
    );
  }
  if (lastDeltas.moral) {
    liveAnnouncementParts.push(`${ui.hud.liveMoral} ${formatSignedInt(lastDeltas.moral)}`);
  }
  if (lastDeltas.stress) {
    liveAnnouncementParts.push(`${ui.hud.liveStress} ${formatSignedInt(lastDeltas.stress)}`);
  }
  if (lastDeltas.personal_life) {
    liveAnnouncementParts.push(
      `${ui.hud.livePersonalLife} ${formatSignedInt(lastDeltas.personal_life)}`,
    );
  }
  if (lastDeltas.reputation) {
    liveAnnouncementParts.push(
      `${ui.hud.liveReputation} ${formatSignedInt(lastDeltas.reputation)}`,
    );
  }

  return (
    <header
      ref={headerRef}
      data-hud-header="true"
      className="hud-header-bar sticky top-0 z-30 border-b-2 border-[#1f2421] bg-[#f6efe0]/96 backdrop-blur-xs shadow-xs"
    >
      <div className="hud-shell-inner max-w-[1420px] mx-auto px-2.5 sm:px-5 py-1 sm:py-1.5 space-y-1 sm:space-y-1.5 xl:space-y-1">
        {/* Screen-reader live region for turn deltas */}
        <output className="sr-only" aria-live="polite">
          {liveAnnouncementParts.length > 0
            ? `${calendar.label}: ${liveAnnouncementParts.join(", ")}`
            : calendar.label}
        </output>

        {/* Command Band 1:
            - Mobile & Tablet (<1280px): Flex-wrapping row 1 (Calendar + Toolbar) + full-width Treasury & Hacienda strip.
            - Desktop (>=1280px): Single aligned horizontal row = Calendar | Treasury & Hacienda | Toolbar. */}
        <div className="flex flex-wrap xl:flex-nowrap items-center justify-between gap-1.5 xl:gap-2.5">
          {/* 1. Calendar & Trimestre Pill */}
          <div
            data-testid="indicator-calendar"
            className="order-1 xl:order-1 inline-flex items-center gap-1 sm:gap-1.5 rounded-lg border border-[#1f2421]/80 bg-[#fffdf8] px-1.5 sm:px-2 py-1 min-w-0 shrink-0"
          >
            <Calendar
              className="hidden min-[390px]:block w-3.5 h-3.5 text-[#7a4308] shrink-0"
              aria-hidden="true"
            />
            <span className="font-editorial font-bold text-xs sm:text-sm text-[#1f2421] whitespace-nowrap">
              {calendar.label}
            </span>
            <span className="hidden min-[360px]:inline-block font-bureau text-[10px] sm:text-[11px] font-bold px-1 sm:px-1.5 py-0.5 rounded bg-[#efe4ce] text-[#373f3a] whitespace-nowrap tabular-nums">
              {state.endless_mode ? `M${state.month}·∞` : `M${state.month}/120`}
            </span>
            <span
              className={`hidden min-[460px]:inline-block font-bureau text-[10px] sm:text-[11px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap tabular-nums ${
                calendar.monthsUntilTrimestre === 0
                  ? "bg-[#fdf0ef] text-[#9e221b] border border-[#9e221b]/40"
                  : "bg-[#fcf4df] text-[#7a4308]"
              }`}
            >
              <span className="hidden 2xl:inline">{calendar.trimestreLabel}</span>
              <span className="2xl:hidden">{calendar.shortTrimestreBadge}</span>
            </span>
          </div>

          {/* 2. Utility & Session Actions (>= 6px inter-button gap, high-contrast solid colors) */}
          <div className="order-2 xl:order-3 flex items-center gap-1.5 ml-auto xl:ml-0 shrink-0">
            <button
              type="button"
              data-testid="locale-toggle-btn"
              aria-label={ui.localeToggle.ariaLabel}
              title={ui.localeToggle.title}
              onClick={handleToggleLocale}
              className="h-7 px-1.5 inline-flex items-center justify-center rounded-md border border-[#1f2421]/80 bg-[#fffdf8] hover:bg-[#efe4ce] font-bureau text-[10px] font-bold text-[#1f2421] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <span
                className={isEn ? "text-[#4a524e]" : "text-[#1f5c53] underline underline-offset-2"}
              >
                ES
              </span>
              <span className="text-[#5c6661] mx-0.5" aria-hidden="true">
                |
              </span>
              <span
                className={isEn ? "text-[#1f5c53] underline underline-offset-2" : "text-[#4a524e]"}
              >
                EN
              </span>
            </button>

            <button
              type="button"
              data-testid="toggle-sfx-btn"
              aria-label={ui.hud.sfxAria}
              aria-pressed={!sfxMuted}
              title={sfxMuted ? ui.hud.sfxTitleMuted : ui.hud.sfxTitleActive}
              onClick={handleToggleSfx}
              className={`h-7 min-w-7 px-1.5 2xl:px-2 inline-flex items-center justify-center gap-1 rounded-md border text-[11px] font-bold transition-colors cursor-pointer ${
                sfxMuted
                  ? "border-[#1f2421]/50 bg-[#efe4ce] text-[#373f3a]"
                  : "border-[#1f2421]/75 bg-[#fffdf8] hover:bg-[#efe4ce] text-[#1f2421]"
              }`}
            >
              {sfxMuted ? (
                <VolumeX className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 shrink-0 text-[#1f5c53]" aria-hidden="true" />
              )}
              <span className="hidden 2xl:inline">{ui.hud.sfxLabel}</span>
            </button>

            <button
              type="button"
              data-testid="toggle-fast-pacing-btn"
              aria-label={ui.hud.fastAria}
              aria-pressed={fastPacing}
              title={fastPacing ? ui.hud.fastTitleOn : ui.hud.fastTitleOff}
              onClick={handleToggleFastPacing}
              className={`h-7 min-w-7 px-1.5 2xl:px-2 inline-flex items-center justify-center gap-1 rounded-md border text-[11px] font-bold transition-colors cursor-pointer ${
                fastPacing
                  ? "border-[#7a4308] bg-[#fcf4df] text-[#7a4308]"
                  : "border-[#1f2421]/75 bg-[#fffdf8] hover:bg-[#efe4ce] text-[#1f2421]"
              }`}
            >
              <Zap className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span className="hidden 2xl:inline">{ui.hud.fastLabel}</span>
            </button>

            <button
              type="button"
              data-testid="return-title-btn"
              aria-label={ui.hud.homeAria}
              title={ui.hud.homeTitle}
              onClick={onReturnToTitle}
              className="h-7 min-w-7 px-1.5 sm:px-2 inline-flex items-center justify-center gap-1 rounded-md border border-[#1f2421]/80 bg-[#fffdf8] hover:bg-[#efe4ce] text-[11px] font-bold text-[#1f2421] transition-colors cursor-pointer whitespace-nowrap"
            >
              <FileText className="w-3 h-3 shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">{ui.hud.homeLabel}</span>
            </button>

            <button
              id="hud-abandon-btn"
              type="button"
              data-testid="abandon-run-btn"
              data-can-retire={canRetireHonorably ? "true" : "false"}
              aria-label={canRetireHonorably ? retireAriaLabel : ui.hud.abandonAria}
              title={canRetireHonorably ? retireAriaLabel : ui.hud.abandonTitle}
              onClick={onOpenAbandon}
              className={`h-7 min-w-7 px-1.5 sm:px-2 inline-flex items-center justify-center gap-1 rounded-md border text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
                canRetireHonorably
                  ? "border-[#1f5c53] bg-[#e8f5f1] hover:bg-[#d5ebe4] text-[#1f5c53]"
                  : "border-[#9e221b]/80 bg-[#fdf0ef] hover:bg-[#f9dcd9] text-[#9e221b]"
              }`}
            >
              {canRetireHonorably ? (
                <Award className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              ) : (
                <LogOut className="w-3 h-3 shrink-0" aria-hidden="true" />
              )}
              <span className="hidden min-[410px]:inline sm:hidden">
                {canRetireHonorably ? retireShortLabel : ui.hud.abandonShort}
              </span>
              <span className="hidden sm:inline">
                {canRetireHonorably ? retireLongLabel : ui.hud.abandonLong}
              </span>
            </button>
          </div>

          {/* 3. Treasury (Caja + Tax Reserve + Net Cash) & Hacienda Tension Strip */}
          <div
            className={`hud-treasury-strip w-full xl:w-auto order-3 xl:order-2 xl:flex-1 rounded-lg border px-2.5 py-0.5 sm:py-1 flex flex-wrap items-center justify-between gap-x-2.5 gap-y-0.5 sm:gap-y-1 min-w-0 ${
              isNegativeCash ? "border-[#b42b24] bg-[#fdf0ef]" : "border-[#1f2421]/80 bg-[#fffdf8]"
            }`}
          >
            <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 min-w-0">
              <div
                data-testid="indicator-money"
                className="inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <span className="text-[11px] font-semibold uppercase tracking-wide text-[#4a524e]">
                  {ui.hud.cashLabel}
                </span>
                <span
                  data-testid="indicator-money-value"
                  className={`font-bureau font-bold text-xs sm:text-sm tabular-nums ${
                    isNegativeCash ? "text-[#9e221b]" : "text-[#1f2421]"
                  }`}
                >
                  {formatEuros(state.indicators.money, locale)}
                </span>
                {lastDeltas.money !== undefined && lastDeltas.money !== 0 && (
                  <span
                    data-testid="indicator-money-delta"
                    className={`font-bureau text-[10px] sm:text-[11px] font-bold px-1.5 py-0.5 rounded border leading-none tabular-nums ${
                      lastDeltas.money > 0
                        ? "bg-[#e8f5f1] text-[#1f5c53] border-[#1f5c53]/45"
                        : "bg-[#fdf0ef] text-[#9e221b] border-[#9e221b]/45"
                    }`}
                  >
                    {formatSignedEuros(lastDeltas.money, locale)}
                  </span>
                )}
                {isNegativeCash && (
                  <span
                    data-testid="numeros-rojos-alert"
                    className="inline-flex items-center gap-1 stamp-badge text-[10px] px-1.5 py-0.5 rounded bg-[#9e221b] text-[#fffdf8] leading-none"
                  >
                    <AlertTriangle className="w-3 h-3 shrink-0" aria-hidden="true" />
                    <span className="hidden sm:inline">
                      {ui.hud.overdraftLong(
                        state.finances.consecutive_negative_months,
                        maxNegativeMonths,
                      )}
                    </span>
                    <span className="sm:hidden">
                      {ui.hud.overdraftShort(
                        state.finances.consecutive_negative_months,
                        maxNegativeMonths,
                      )}
                    </span>
                  </span>
                )}
              </div>

              <span className="hidden md:inline text-[#5c6661]" aria-hidden="true">
                |
              </span>

              <div
                data-testid="indicator-net-cash"
                className="inline-flex items-center gap-1 text-[11px] font-bureau tabular-nums whitespace-nowrap text-[#4a524e]"
              >
                <span className="hidden md:inline">{ui.hud.quarterReserveLong}</span>
                <span className="md:hidden">{ui.hud.quarterReserveShort}</span>
                <span className="font-bold text-[#7a4308]">
                  {reservedTax > 0
                    ? `-${formatEuros(reservedTax, locale)}`
                    : formatEuros(0, locale)}
                </span>
                <span className="text-[#5c6661]" aria-hidden="true">
                  ·
                </span>
                <span>{ui.hud.netFreeCash}</span>
                <strong
                  className={`font-bold ${
                    netCashAfterTax < 0 ? "text-[#9e221b]" : "text-[#1f5c53]"
                  }`}
                >
                  {formatEuros(netCashAfterTax, locale)}
                </strong>
              </div>
            </div>

            {/* Hacienda Tension Badge */}
            <div
              data-testid="indicator-fiscal-risk"
              className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] sm:text-[11px] font-semibold shrink-0 whitespace-nowrap ${
                fiscalTension.level === "critical"
                  ? "border-[#9e221b]/60 bg-[#fdf0ef] text-[#9e221b]"
                  : fiscalTension.level === "watched"
                    ? "border-[#7a4308]/50 bg-[#fcf4df] text-[#7a4308]"
                    : "border-[#1f2421]/25 bg-[#f6efe0] text-[#373f3a]"
              }`}
            >
              <ShieldAlert className="w-3 h-3 shrink-0" aria-hidden="true" />
              <span className="hidden 2xl:inline">{ui.hud.taxAgencyPrefix}</span>
              <span>{fiscalTension.label}</span>
            </div>
          </div>
        </div>

        {/* Command Band 2: 4-Column Aligned Micro-Gauges (Mobile & Desktop) */}
        <section
          aria-label={ui.hud.indicatorsSectionAria}
          className="hud-gauges-band grid grid-cols-4 gap-1.5 xl:gap-3"
        >
          <GaugeItem
            testId="indicator-moral"
            label={ui.hud.moralLabel}
            shortLabel={ui.hud.moralShort}
            compactPhoneLabel={isEn ? "Mor." : "Mor."}
            value={state.indicators.moral}
            delta={lastDeltas.moral}
          />
          <GaugeItem
            testId="indicator-stress"
            label={ui.hud.stressLabel}
            shortLabel={ui.hud.stressShort}
            compactPhoneLabel={isEn ? "Str." : "Est."}
            value={state.indicators.stress}
            delta={lastDeltas.stress}
            invertDanger={true}
          />
          <GaugeItem
            testId="indicator-personal-life"
            label={ui.hud.personalLifeLabel}
            shortLabel={ui.hud.personalLifeShort}
            compactPhoneLabel={isEn ? "Life" : "Vida"}
            value={state.indicators.personal_life}
            delta={lastDeltas.personal_life}
          />
          <GaugeItem
            testId="indicator-reputation"
            label={ui.hud.reputationLabel}
            shortLabel={ui.hud.reputationShort}
            compactPhoneLabel="Rep."
            value={state.indicators.reputation}
            delta={lastDeltas.reputation}
          />
        </section>
      </div>
    </header>
  );
}
