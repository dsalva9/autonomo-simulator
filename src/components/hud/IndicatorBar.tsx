import {
  AlertTriangle,
  Award,
  Calendar,
  FileText,
  LogOut,
  Settings,
  ShieldAlert,
  Volume2,
  VolumeX,
  Zap,
} from "lucide-react";
import { type Ref, useEffect, useRef, useState } from "react";
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
import {
  type IndicatorDeltas,
  canRetireHonorably as checkCanRetireHonorably,
  useGameStore,
} from "../../store/gameStore.ts";
import { useUIStore } from "../../store/uiStore.ts";

export interface IndicatorBarProps {
  headerRef?: Ref<HTMLElement>;
  state: GameState;
  lastDeltas: IndicatorDeltas;
  locale?: string;
  abandonDisabled?: boolean;
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
  const hasDelta = delta !== undefined && delta !== 0;
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
  const deltaPositiveGood = hasDelta ? (invertDanger ? delta < 0 : delta > 0) : true;

  return (
    <div
      data-testid={testId}
      className={`hud-gauge-card relative rounded-lg border px-1 min-[360px]:px-1.5 sm:px-2 xl:px-2.5 py-0.5 sm:py-1 flex flex-col justify-between bg-[#fffdf8] ${
        isDanger ? "border-[#b42b24] bg-[#fdf0ef]" : "border-[#1f2421]/55"
      }`}
    >
      <div className="flex items-center justify-between gap-0.5 sm:gap-1 min-h-[15px] leading-none">
        <span className="font-semibold text-[10.5px] sm:text-[11px] xl:text-xs text-[#1f2421] whitespace-nowrap">
          <span className="hidden sm:inline">{label}</span>
          {hasDelta ? (
            <span className="sm:hidden">{compactPhoneLabel}</span>
          ) : (
            <>
              <span className="hidden min-[380px]:inline sm:hidden">{shortLabel}</span>
              <span className="min-[380px]:hidden">{compactPhoneLabel}</span>
            </>
          )}
        </span>
        <div className="flex items-center gap-0.5 shrink-0 font-bureau font-bold tabular-nums">
          <span
            data-testid={`${testId}-value`}
            className={`text-[11px] xl:text-xs ${isDanger ? "text-[#9e221b]" : "text-[#1f2421]"}`}
          >
            {clamped}
          </span>
          {hasDelta && (
            <span
              data-testid={`${testId}-delta`}
              className={`text-[9.5px] sm:text-[10px] leading-none px-1 py-0 rounded border ${
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
        className="hud-gauge-bar-track mt-0.5 sm:mt-1 lg:mt-0.5 h-1.5 w-full rounded-full bg-[#e5dac5] overflow-hidden border border-[#1f2421]/25"
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
  abandonDisabled = false,
  onReturnToTitle,
  onOpenAbandon,
}: IndicatorBarProps) {
  const storeLocale = useGameStore((s) => s.profile.settings.locale);
  const toggleLocalePreference = useGameStore((s) => s.toggleLocalePreference);

  const sfxMuted = useUIStore((s) => s.sfxMuted);
  const toggleSfxMuted = useUIStore((s) => s.toggleSfxMuted);
  const fastPacing = useUIStore((s) => s.fastPacing);
  const toggleFastPacing = useUIStore((s) => s.toggleFastPacing);

  const [isMobileToolbar, setIsMobileToolbar] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.innerWidth < 768 : false,
  );
  const [utilityMenuOpen, setUtilityMenuOpen] = useState(false);
  const utilityMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const syncViewport = () => {
      const mobile = window.innerWidth < 768;
      setIsMobileToolbar(mobile);
      if (!mobile) {
        setUtilityMenuOpen(false);
      }
    };
    syncViewport();
    window.addEventListener("resize", syncViewport);
    return () => window.removeEventListener("resize", syncViewport);
  }, []);

  useEffect(() => {
    if (!utilityMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && utilityMenuRef.current && !utilityMenuRef.current.contains(target)) {
        setUtilityMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setUtilityMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [utilityMenuOpen]);

  const locale = normalizeLocale(localeProp ?? storeLocale);
  const isEn = locale === "en";
  const ui = getUiStrings(locale);

  const calendar = formatCalendarBadgeEs(state.month, locale);
  const fiscalTension = describeFiscalRiskTension(state.fiscal_risk, locale);
  const isNegativeCash = state.indicators.money < 0;
  const maxNegativeMonths = compiledCatalog.balance.max_consecutive_negative_months;

  const reservedTax = computeReservedTaxObligation(state);
  const netCashAfterTax = computeNetCashAfterTaxReserve(state);

  const canRetireHonorably = checkCanRetireHonorably(state);

  const retireLongLabel = isEn ? "Retire with honors" : "Jubilarse con honores";
  const retireShortLabel = isEn ? "Retire" : "Jubilarse";
  const retireAriaLabel = isEn
    ? "Retire with honors or close dossier (B)"
    : "Jubilarse con honores o tramitar baja (B)";
  const utilityMenuAria = isEn ? "Open utility menu" : "Abrir menú de utilidades";

  const handleToggleLocale = () => {
    playUiSound("paper_choice", { muted: sfxMuted });
    setUtilityMenuOpen(false);
    void toggleLocalePreference();
  };

  const handleToggleSfx = () => {
    const willBeUnmuted = sfxMuted;
    toggleSfxMuted();
    if (willBeUnmuted) {
      playUiSound("paper_choice", { muted: false });
    }
    setUtilityMenuOpen(false);
  };

  const handleToggleFastPacing = () => {
    toggleFastPacing();
    playUiSound("paper_choice", { muted: sfxMuted });
    setUtilityMenuOpen(false);
  };

  const handleReturnTitleClick = () => {
    setUtilityMenuOpen(false);
    onReturnToTitle();
  };

  const handleAbandonClick = () => {
    if (abandonDisabled) {
      return;
    }
    setUtilityMenuOpen(false);
    onOpenAbandon();
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

  const fiscalRiskBadge = (
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
      <span className="hidden min-[1680px]:inline">{ui.hud.taxAgencyPrefix}</span>
      <span>{fiscalTension.label}</span>
    </div>
  );

  return (
    <header
      ref={headerRef}
      data-hud-header="true"
      className={`hud-header-bar sticky top-0 ${
        utilityMenuOpen ? "z-50" : "z-30"
      } border-b-2 border-[#1f2421] bg-[#f6efe0]/96 backdrop-blur-xs shadow-xs`}
    >
      <div className="hud-shell-inner max-w-3xl lg:max-w-none xl:max-w-[1440px] 2xl:max-w-[1600px] mx-auto px-2 min-[390px]:px-2.5 sm:px-4 lg:px-3 xl:px-4 2xl:px-5 py-1 sm:py-1.5 lg:py-1 space-y-1 sm:space-y-1.5 lg:space-y-1">
        {/* Screen-reader live region for turn deltas */}
        <output className="sr-only" aria-live="polite">
          {liveAnnouncementParts.length > 0
            ? `${calendar.label}: ${liveAnnouncementParts.join(", ")}`
            : calendar.label}
        </output>

        {/* Command Band 1:
            - Mobile (<768px): Row 1 (Calendar + Fiscal Risk + [⚙] Menu) + 1-line 26px Treasury Strip.
            - Tablet (768px-1023px): Row 1 (Calendar + 5 inline buttons) + 1-line Treasury & Hacienda Strip.
            - Desktop (>=1024px): Single aligned horizontal row = Calendar | Treasury & Hacienda | Toolbar. */}
        <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-1 sm:gap-1.5 lg:gap-2 xl:gap-2.5">
          {/* 1. Calendar & Trimestre Pill */}
          <div
            data-testid="indicator-calendar"
            className="order-1 lg:order-1 inline-flex items-center gap-1 sm:gap-1.5 rounded-lg border border-[#1f2421]/80 bg-[#fffdf8] px-1.5 sm:px-2 py-0.5 sm:py-1 min-w-0 shrink-0"
          >
            <Calendar
              className="hidden min-[400px]:block w-3.5 h-3.5 text-[#7a4308] shrink-0"
              aria-hidden="true"
            />
            <span className="font-editorial font-bold text-xs sm:text-sm text-[#1f2421] whitespace-nowrap">
              {calendar.label}
            </span>
            <span className="hidden min-[440px]:inline-block font-bureau text-[10px] sm:text-[11px] font-bold px-1 sm:px-1.5 py-0.5 rounded bg-[#efe4ce] text-[#373f3a] whitespace-nowrap tabular-nums">
              {state.endless_mode ? `M${state.month}·∞` : `M${state.month}/120`}
            </span>
            <span
              className={`hidden min-[520px]:max-lg:inline-block xl:inline-block font-bureau text-[10px] sm:text-[11px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap tabular-nums ${
                calendar.monthsUntilTrimestre === 0
                  ? "bg-[#fdf0ef] text-[#9e221b] border border-[#9e221b]/40"
                  : "bg-[#fcf4df] text-[#7a4308]"
              }`}
            >
              <span className="hidden min-[1680px]:inline">{calendar.trimestreLabel}</span>
              <span className="min-[1680px]:hidden">{calendar.shortTrimestreBadge}</span>
            </span>
          </div>

          {/* Mobile (<768px) Promoted Hacienda Tension Badge + [⚙] Utility Menu Sheet */}
          {isMobileToolbar ? (
            <div className="order-2 flex items-center gap-1.5 ml-auto shrink-0">
              {fiscalRiskBadge}

              <div ref={utilityMenuRef} className="relative">
                <button
                  type="button"
                  data-testid="mobile-utility-menu-btn"
                  aria-haspopup="menu"
                  aria-expanded={utilityMenuOpen}
                  aria-controls="mobile-utility-sheet"
                  aria-label={utilityMenuAria}
                  title={utilityMenuAria}
                  onClick={() => setUtilityMenuOpen((prev) => !prev)}
                  className={`min-h-8 px-2 inline-flex items-center justify-center gap-1 rounded-lg border font-bureau text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                    utilityMenuOpen
                      ? "border-[#1f2421] bg-[#efe4ce] text-[#1f2421]"
                      : "border-[#1f2421]/80 bg-[#fffdf8] hover:bg-[#efe4ce] text-[#1f2421]"
                  }`}
                >
                  <Settings className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  {fastPacing && (
                    <Zap
                      data-testid="mobile-utility-fast-indicator"
                      className="w-3 h-3 text-[#7a4308] shrink-0"
                      aria-hidden="true"
                    />
                  )}
                </button>

                {utilityMenuOpen && (
                  <div
                    id="mobile-utility-sheet"
                    data-testid="mobile-utility-sheet"
                    role="menu"
                    aria-label={utilityMenuAria}
                    className="absolute right-0 top-[calc(100%+6px)] z-50 w-64 max-w-[calc(100vw-1rem)] paper-dossier animate-dossier rounded-xl p-2 flex flex-col gap-1.5 bg-[#fffdf8]"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      data-testid="locale-toggle-btn"
                      aria-label={ui.localeToggle.ariaLabel}
                      title={ui.localeToggle.title}
                      onClick={handleToggleLocale}
                      className="min-h-11 px-3 inline-flex items-center justify-between gap-2 rounded-lg border border-[#1f2421]/75 bg-[#fffdf8] hover:bg-[#efe4ce] text-xs font-bold text-[#1f2421] transition-colors cursor-pointer"
                    >
                      <span>{isEn ? "Language" : "Idioma"}</span>
                      <span className="font-bureau">
                        <span
                          className={
                            isEn ? "text-[#4a524e]" : "text-[#1f5c53] underline underline-offset-2"
                          }
                        >
                          ES
                        </span>
                        <span className="text-[#5c6661] mx-1" aria-hidden="true">
                          |
                        </span>
                        <span
                          className={
                            isEn ? "text-[#1f5c53] underline underline-offset-2" : "text-[#4a524e]"
                          }
                        >
                          EN
                        </span>
                      </span>
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      data-testid="toggle-sfx-btn"
                      aria-label={ui.hud.sfxAria}
                      aria-pressed={!sfxMuted}
                      title={sfxMuted ? ui.hud.sfxTitleMuted : ui.hud.sfxTitleActive}
                      onClick={handleToggleSfx}
                      className={`min-h-11 px-3 inline-flex items-center justify-between gap-2 rounded-lg border text-xs font-bold transition-colors cursor-pointer ${
                        sfxMuted
                          ? "border-[#1f2421]/50 bg-[#efe4ce] text-[#373f3a]"
                          : "border-[#1f2421]/75 bg-[#fffdf8] hover:bg-[#efe4ce] text-[#1f2421]"
                      }`}
                    >
                      <span className="inline-flex items-center gap-2">
                        {sfxMuted ? (
                          <VolumeX className="w-4 h-4 shrink-0" aria-hidden="true" />
                        ) : (
                          <Volume2 className="w-4 h-4 shrink-0 text-[#1f5c53]" aria-hidden="true" />
                        )}
                        <span>{ui.hud.sfxLabel}</span>
                      </span>
                      <span className="font-bureau text-[10px] uppercase">
                        {sfxMuted ? "OFF" : "ON"}
                      </span>
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      data-testid="toggle-fast-pacing-btn"
                      aria-label={ui.hud.fastAria}
                      aria-pressed={fastPacing}
                      title={fastPacing ? ui.hud.fastTitleOn : ui.hud.fastTitleOff}
                      onClick={handleToggleFastPacing}
                      className={`min-h-11 px-3 inline-flex items-center justify-between gap-2 rounded-lg border text-xs font-bold transition-colors cursor-pointer ${
                        fastPacing
                          ? "border-[#7a4308] bg-[#fcf4df] text-[#7a4308]"
                          : "border-[#1f2421]/75 bg-[#fffdf8] hover:bg-[#efe4ce] text-[#1f2421]"
                      }`}
                    >
                      <span className="inline-flex items-center gap-2">
                        <Zap className="w-4 h-4 shrink-0" aria-hidden="true" />
                        <span>{ui.hud.fastLabel}</span>
                      </span>
                      <span className="font-bureau text-[10px] uppercase">
                        {fastPacing ? "ON" : "OFF"}
                      </span>
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      data-testid="return-title-btn"
                      aria-label={ui.hud.homeAria}
                      title={ui.hud.homeTitle}
                      onClick={handleReturnTitleClick}
                      className="min-h-11 px-3 inline-flex items-center gap-2 rounded-lg border border-[#1f2421]/80 bg-[#fffdf8] hover:bg-[#efe4ce] text-xs font-bold text-[#1f2421] transition-colors cursor-pointer"
                    >
                      <FileText className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>{ui.hud.homeLabel}</span>
                    </button>

                    <button
                      id="hud-abandon-btn"
                      type="button"
                      role="menuitem"
                      disabled={abandonDisabled}
                      data-testid="abandon-run-btn"
                      data-can-retire={canRetireHonorably ? "true" : "false"}
                      aria-label={canRetireHonorably ? retireAriaLabel : ui.hud.abandonAria}
                      title={canRetireHonorably ? retireAriaLabel : ui.hud.abandonTitle}
                      onClick={handleAbandonClick}
                      className={`min-h-11 px-3 inline-flex items-center gap-2 rounded-lg border text-xs font-bold transition-colors ${
                        abandonDisabled
                          ? "border-[#5c6661] bg-[#efe4ce] text-[#373f3a] cursor-not-allowed"
                          : canRetireHonorably
                            ? "border-[#1f5c53] bg-[#e8f5f1] hover:bg-[#d5ebe4] text-[#1f5c53] cursor-pointer"
                            : "border-[#9e221b]/80 bg-[#fdf0ef] hover:bg-[#f9dcd9] text-[#9e221b] cursor-pointer"
                      }`}
                    >
                      {canRetireHonorably ? (
                        <Award className="w-4 h-4 shrink-0" aria-hidden="true" />
                      ) : (
                        <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" />
                      )}
                      <span>{canRetireHonorably ? retireLongLabel : ui.hud.abandonLong}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* 2. Tablet & Desktop (>= 768px) Inline Utility & Session Actions (>= 6px inter-button gap) */
            <div className="order-2 lg:order-3 flex items-center gap-1.5 ml-auto lg:ml-0 shrink-0">
              <button
                type="button"
                data-testid="locale-toggle-btn"
                aria-label={ui.localeToggle.ariaLabel}
                title={ui.localeToggle.title}
                onClick={handleToggleLocale}
                className="h-7 px-1.5 inline-flex items-center justify-center rounded-md border border-[#1f2421]/80 bg-[#fffdf8] hover:bg-[#efe4ce] font-bureau text-[10px] font-bold text-[#1f2421] transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <span
                  className={
                    isEn ? "text-[#4a524e]" : "text-[#1f5c53] underline underline-offset-2"
                  }
                >
                  ES
                </span>
                <span className="text-[#5c6661] mx-0.5" aria-hidden="true">
                  |
                </span>
                <span
                  className={
                    isEn ? "text-[#1f5c53] underline underline-offset-2" : "text-[#4a524e]"
                  }
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
                className={`h-7 min-w-7 px-1.5 min-[1680px]:px-2 inline-flex items-center justify-center gap-1 rounded-md border text-[11px] font-bold transition-colors cursor-pointer ${
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
                <span className="hidden min-[1680px]:inline">{ui.hud.sfxLabel}</span>
              </button>

              <button
                type="button"
                data-testid="toggle-fast-pacing-btn"
                aria-label={ui.hud.fastAria}
                aria-pressed={fastPacing}
                title={fastPacing ? ui.hud.fastTitleOn : ui.hud.fastTitleOff}
                onClick={handleToggleFastPacing}
                className={`h-7 min-w-7 px-1.5 min-[1680px]:px-2 inline-flex items-center justify-center gap-1 rounded-md border text-[11px] font-bold transition-colors cursor-pointer ${
                  fastPacing
                    ? "border-[#7a4308] bg-[#fcf4df] text-[#7a4308]"
                    : "border-[#1f2421]/75 bg-[#fffdf8] hover:bg-[#efe4ce] text-[#1f2421]"
                }`}
              >
                <Zap className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span className="hidden min-[1680px]:inline">{ui.hud.fastLabel}</span>
              </button>

              <button
                type="button"
                data-testid="return-title-btn"
                aria-label={ui.hud.homeAria}
                title={ui.hud.homeTitle}
                onClick={handleReturnTitleClick}
                className="h-7 min-w-7 px-1.5 xl:px-2 inline-flex items-center justify-center gap-1 rounded-md border border-[#1f2421]/80 bg-[#fffdf8] hover:bg-[#efe4ce] text-[11px] font-bold text-[#1f2421] transition-colors cursor-pointer whitespace-nowrap"
              >
                <FileText className="w-3 h-3 shrink-0" aria-hidden="true" />
                <span>{ui.hud.homeLabel}</span>
              </button>

              <button
                id="hud-abandon-btn"
                type="button"
                disabled={abandonDisabled}
                data-testid="abandon-run-btn"
                data-can-retire={canRetireHonorably ? "true" : "false"}
                aria-label={canRetireHonorably ? retireAriaLabel : ui.hud.abandonAria}
                title={canRetireHonorably ? retireAriaLabel : ui.hud.abandonTitle}
                onClick={handleAbandonClick}
                className={`h-7 min-w-7 px-1.5 xl:px-2 inline-flex items-center justify-center gap-1 rounded-md border text-[11px] font-bold transition-colors whitespace-nowrap ${
                  abandonDisabled
                    ? "border-[#5c6661] bg-[#efe4ce] text-[#373f3a] cursor-not-allowed"
                    : canRetireHonorably
                      ? "border-[#1f5c53] bg-[#e8f5f1] hover:bg-[#d5ebe4] text-[#1f5c53] cursor-pointer"
                      : "border-[#9e221b]/80 bg-[#fdf0ef] hover:bg-[#f9dcd9] text-[#9e221b] cursor-pointer"
                }`}
              >
                {canRetireHonorably ? (
                  <Award className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                ) : (
                  <LogOut className="w-3 h-3 shrink-0" aria-hidden="true" />
                )}
                <span className="xl:hidden">
                  {canRetireHonorably ? retireShortLabel : ui.hud.abandonShort}
                </span>
                <span className="hidden xl:inline">
                  {canRetireHonorably ? retireLongLabel : ui.hud.abandonLong}
                </span>
              </button>
            </div>
          )}

          {/* 3. Single-Line Treasury (Caja + Tax Reserve + Net Cash) & (>=768px) Hacienda Tension Strip */}
          <div
            className={`hud-treasury-strip w-full lg:w-auto order-3 lg:order-2 lg:flex-1 min-h-[26px] rounded-lg border px-2 sm:px-2.5 py-0.5 sm:py-1 flex flex-nowrap items-center justify-between gap-x-2 min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
              isNegativeCash ? "border-[#b42b24] bg-[#fdf0ef]" : "border-[#1f2421]/80 bg-[#fffdf8]"
            }`}
          >
            <div className="flex items-center flex-nowrap gap-x-1.5 sm:gap-x-2 min-w-0">
              <div
                data-testid="indicator-money"
                className="inline-flex items-center gap-1 sm:gap-1.5 whitespace-nowrap shrink-0"
              >
                <span className="hidden min-[420px]:inline text-[11px] font-semibold uppercase tracking-wide text-[#4a524e]">
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
                    className={`font-bureau text-[9.5px] sm:text-[11px] font-bold px-1 sm:px-1.5 py-0.5 rounded border leading-none tabular-nums ${
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
                    className="inline-flex items-center gap-1 stamp-badge text-[9.5px] sm:text-[10px] px-1 sm:px-1.5 py-0.5 rounded bg-[#9e221b] text-[#fffdf8] leading-none"
                  >
                    <AlertTriangle className="w-3 h-3 shrink-0" aria-hidden="true" />
                    <span className="hidden min-[1440px]:inline">
                      {ui.hud.overdraftLong(
                        state.finances.consecutive_negative_months,
                        maxNegativeMonths,
                      )}
                    </span>
                    <span className="hidden min-[400px]:inline min-[1440px]:hidden">
                      {ui.hud.overdraftShort(
                        state.finances.consecutive_negative_months,
                        maxNegativeMonths,
                      )}
                    </span>
                    <span className="min-[400px]:hidden">
                      {state.finances.consecutive_negative_months}/{maxNegativeMonths}
                    </span>
                  </span>
                )}
              </div>

              <span className="text-[#5c6661] text-[10px] shrink-0" aria-hidden="true">
                |
              </span>

              <div
                data-testid="indicator-net-cash"
                className="inline-flex items-center gap-0.5 min-[390px]:gap-1 text-[10px] min-[390px]:text-[11px] font-bureau tabular-nums whitespace-nowrap text-[#4a524e] shrink-0"
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

            {!isMobileToolbar && fiscalRiskBadge}
          </div>
        </div>

        {/* Command Band 2: 4-Column Aligned Micro-Gauges (Mobile & Desktop, inline delta pills) */}
        <section
          aria-label={ui.hud.indicatorsSectionAria}
          className="hud-gauges-band grid grid-cols-4 gap-1 min-[390px]:gap-1.5 xl:gap-3"
        >
          <GaugeItem
            testId="indicator-moral"
            label={ui.hud.moralLabel}
            shortLabel={ui.hud.moralShort}
            compactPhoneLabel="Mor"
            value={state.indicators.moral}
            delta={lastDeltas.moral}
          />
          <GaugeItem
            testId="indicator-stress"
            label={ui.hud.stressLabel}
            shortLabel={ui.hud.stressShort}
            compactPhoneLabel={isEn ? "Str" : "Est"}
            value={state.indicators.stress}
            delta={lastDeltas.stress}
            invertDanger={true}
          />
          <GaugeItem
            testId="indicator-personal-life"
            label={ui.hud.personalLifeLabel}
            shortLabel={ui.hud.personalLifeShort}
            compactPhoneLabel={isEn ? "Lif" : "Vid"}
            value={state.indicators.personal_life}
            delta={lastDeltas.personal_life}
          />
          <GaugeItem
            testId="indicator-reputation"
            label={ui.hud.reputationLabel}
            shortLabel={ui.hud.reputationShort}
            compactPhoneLabel="Rep"
            value={state.indicators.reputation}
            delta={lastDeltas.reputation}
          />
        </section>
      </div>
    </header>
  );
}
