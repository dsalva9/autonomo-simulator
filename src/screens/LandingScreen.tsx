import { ArrowRight, Play, Sparkles } from "lucide-react";
import { useEffect, useRef } from "react";
import { KofiSupportBanner } from "../components/common/KofiSupportBanner.tsx";
import { trackDashboardEntered } from "../services/analytics/umamiAnalytics.ts";
import { playUiSound } from "../services/audio/soundEffects.ts";
import { compiledCatalog, resolveManifestAsset } from "../services/content/catalog.ts";
import {
  formatCalendarBadgeEs,
  formatEuros,
  normalizeLocale,
} from "../services/i18n/resolveEventText.ts";
import { getUiStrings } from "../services/i18n/uiStrings.ts";
import { useGameStore } from "../store/gameStore.ts";
import { useUIStore } from "../store/uiStore.ts";

export function LandingScreen() {
  const activeRun = useGameStore((s) => s.activeRun);
  const profile = useGameStore((s) => s.profile);
  const continueRun = useGameStore((s) => s.continueRun);
  const toggleLocalePreference = useGameStore((s) => s.toggleLocalePreference);

  const setScreenView = useUIStore((s) => s.setScreenView);
  const sfxMuted = useUIStore((s) => s.sfxMuted);

  const locale = normalizeLocale(profile.settings.locale);
  const isEn = locale === "en";
  const victoryMoney = compiledCatalog.balance.victory_money;
  const ui = getUiStrings(locale, { victoryMoney });

  const hasResumableRun =
    activeRun !== null && activeRun.phase !== "game_over" && activeRun.ending === null;
  const resumableCalendar =
    hasResumableRun && activeRun ? formatCalendarBadgeEs(activeRun.month, locale) : null;

  const landingIllustration = resolveManifestAsset(
    compiledCatalog.manifest,
    "illus_portada_landing",
  );

  const handleEnterDashboard = () => {
    playUiSound("stamp_thud", { muted: sfxMuted });
    trackDashboardEntered({ locale, hasActiveRun: hasResumableRun });
    setScreenView("title");
  };

  const handleContinueRun = () => {
    playUiSound("paper_choice", { muted: sfxMuted });
    continueRun();
  };

  const handleToggleLocale = () => {
    playUiSound("paper_choice", { muted: sfxMuted });
    void toggleLocalePreference();
  };

  const actionsRef = useRef({
    hasResumableRun,
    handleEnterDashboard,
    handleContinueRun,
    handleToggleLocale,
  });
  actionsRef.current = {
    hasResumableRun,
    handleEnterDashboard,
    handleContinueRun,
    handleToggleLocale,
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }

      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (event.key === "Enter") {
        if (target && (target.tagName === "BUTTON" || target.tagName === "A")) {
          return;
        }
        event.preventDefault();
        actionsRef.current.handleEnterDashboard();
        return;
      }

      const key = event.key.toLowerCase();
      if (key === "c" && actionsRef.current.hasResumableRun) {
        event.preventDefault();
        actionsRef.current.handleContinueRun();
      } else if (key === "l") {
        event.preventDefault();
        actionsRef.current.handleToggleLocale();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <main
      data-testid="landing-screen"
      className="landing-screen-shell w-full max-w-[960px] mx-auto px-3.5 sm:px-5 py-2.5 sm:py-4 min-h-dvh lg:h-dvh lg:max-h-dvh lg:overflow-hidden [@media(max-height:559px)]:!h-auto [@media(max-height:559px)]:!max-h-none [@media(max-height:559px)]:!overflow-visible flex flex-col justify-center"
    >
      <div className="w-full flex-1 lg:max-h-[820px] min-h-0 flex flex-col gap-2.5 sm:gap-3">
        {/* Clean Bureaucratic Landing Hero Header */}
        <section className="paper-dossier shrink-0 rounded-2xl overflow-hidden">
          <div className="bg-[#1f2421] text-[#fffdf8] px-3 sm:px-5 py-1.5 flex flex-wrap items-center justify-between gap-2 border-b-2 border-[#1f2421]">
            <div className="flex items-center gap-2 min-w-0">
              <span className="stamp-badge text-[10px] sm:text-xs text-[#fce592] leading-tight">
                {ui.title.headerFormBadge}
              </span>
              <span className="hidden md:inline font-bureau text-[11px] text-[#efe4ce] shrink-0">
                · {ui.title.headerCountryBadge}
              </span>
            </div>

            <button
              type="button"
              data-testid="locale-toggle-btn"
              aria-label={ui.localeToggle.ariaLabel}
              title={ui.localeToggle.title}
              onClick={handleToggleLocale}
              className="h-7 px-2.5 rounded-md border border-[#fce592]/60 bg-[#2d3430] hover:bg-[#3a433e] text-[#fffdf8] font-bureau text-[11px] font-bold inline-flex items-center justify-center shrink-0 cursor-pointer transition-colors ml-auto"
            >
              <span
                className={isEn ? "text-[#d8cbb5]" : "text-[#fce592] underline underline-offset-2"}
              >
                ES
              </span>
              <span className="text-[#b5a790] mx-1" aria-hidden="true">
                |
              </span>
              <span
                className={isEn ? "text-[#fce592] underline underline-offset-2" : "text-[#d8cbb5]"}
              >
                EN
              </span>
            </button>
          </div>

          <div className="title-hero-body px-3.5 sm:px-5 py-2.5 sm:py-3.5 bg-gradient-to-br from-[#fffdf8] via-[#fffdf8] to-[#f6efe0] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-4">
            <div className="space-y-1 max-w-2xl">
              <h1 className="title-hero-title font-editorial text-2xl sm:text-3xl font-bold text-[#1f2421] tracking-tight leading-tight">
                Autónomo Simulator
              </h1>
              <blockquote className="border-l-4 border-[#b42b24] pl-2.5 py-0.5 font-editorial italic text-xs sm:text-base text-[#373f3a]">
                {ui.title.taglineQuote}
              </blockquote>
              <p className="text-xs sm:text-[13px] text-[#4a524e] leading-snug">
                {ui.title.heroLeadBeforeAmount}
                <strong className="font-bureau text-[#1f5c53] tabular-nums">
                  {formatEuros(victoryMoney, locale)}
                </strong>
                {ui.title.heroLeadAfterAmount}
              </p>
            </div>

            {/* Official Tilted Rubber Stamp */}
            <div className="self-start sm:self-center shrink-0 mx-1.5 my-0.5 rotate-[-2.5deg] rounded-xl border-3 sm:border-4 border-[#9e221b] bg-[#fdf0ef] px-3 sm:px-4 py-1 sm:py-1.5 text-center shadow-xs">
              <p className="stamp-badge text-[10px] sm:text-[11px] text-[#9e221b]">
                {ui.title.stampTop}
              </p>
              <p className="font-bureau text-sm sm:text-lg font-black text-[#9e221b] tabular-nums leading-tight">
                {ui.title.stampMain}
              </p>
              <p className="font-bureau text-[10px] sm:text-[11px] font-bold text-[#373f3a]">
                {ui.title.stampBottom}
              </p>
            </div>
          </div>
        </section>

        {/* Clean Guía Rápida Card: Comic Illustration + 3-Step Guide + Primary Play CTA */}
        <section
          data-testid="landing-guide-card"
          className="paper-dossier lg:flex-1 lg:min-h-0 rounded-2xl overflow-hidden bg-[#fffdf8] flex flex-col"
        >
          <div className="title-guide-header dossier-header !min-h-[32px] !py-1.5 !px-4 shrink-0">
            <span className="stamp-badge text-[10px] sm:text-[11px] text-[#7a4308]">
              {ui.title.landingGuideBadge}
            </span>
            <span className="hidden sm:inline font-bureau text-[11px] font-bold text-[#4a524e] truncate">
              {ui.title.landingIllustrationCaption}
            </span>
          </div>

          <div className="title-guide-body flex-1 min-h-0 p-3 sm:p-4 flex flex-col gap-2.5 sm:gap-3">
            {landingIllustration && (
              <div className="title-guide-illus-wrap relative h-40 sm:h-56 lg:h-auto lg:flex-1 lg:min-h-[120px] rounded-xl border-2 border-[#1f2421] overflow-hidden bg-[#f6efe0] shadow-[2px_2px_0px_0px_rgba(31,36,33,0.75)]">
                <img
                  data-testid="landing-hero-illustration"
                  data-asset-id={landingIllustration.id}
                  src={landingIllustration.url}
                  alt={ui.title.landingIllustrationAlt}
                  width={landingIllustration.width}
                  height={landingIllustration.height}
                  loading="eager"
                  fetchPriority="high"
                  decoding="async"
                  className="w-full h-full lg:absolute lg:inset-0 object-cover object-center render-vector-hd"
                />
              </div>
            )}

            <div className="title-guide-steps shrink-0 grid grid-cols-1 sm:grid-cols-3 gap-2">
              {ui.title.landingSteps.map((item) => (
                <div
                  key={item.step}
                  className="rounded-lg border border-[#1f2421]/20 bg-[#f6efe0] px-3 py-2 space-y-0.5"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="stamp-badge text-[9.5px] px-1.5 py-0.5 rounded bg-[#1f2421] text-[#fce592] shrink-0">
                      {item.step}
                    </span>
                    <h2 className="font-editorial text-xs sm:text-sm font-bold text-[#1f2421] leading-tight">
                      {item.title}
                    </h2>
                  </div>
                  <p className="text-[11.5px] text-[#373f3a] leading-snug">{item.desc}</p>
                </div>
              ))}
            </div>

            {/* Big Unmistakable Play CTA (+ Optional Resume Shortcut when mid-run) */}
            <div className="shrink-0 flex flex-col sm:flex-row items-stretch gap-2 pt-0.5">
              <button
                type="button"
                data-testid="landing-enter-btn"
                title={ui.title.landingEnterTitle}
                onClick={handleEnterDashboard}
                className="flex-1 min-h-13 sm:min-h-14 rounded-xl border-2 border-[#1f2421] bg-[#b42b24] hover:bg-[#96221c] text-[#fffdf8] font-bold text-base sm:text-lg px-5 py-2.5 flex items-center justify-center gap-2.5 cursor-pointer transition-colors shadow-[3px_3px_0px_0px_rgba(31,36,33,0.9)]"
              >
                <Sparkles className="w-5 h-5 shrink-0" aria-hidden="true" />
                <span>{ui.title.landingEnterBtn}</span>
                <ArrowRight className="w-5 h-5 shrink-0" aria-hidden="true" />
                <kbd className="hidden lg:inline-block ml-1 font-bureau text-xs px-1.5 py-0.5 rounded bg-[#1f2421] text-[#fffdf8]">
                  {isEn ? "Enter" : "Intro"}
                </kbd>
              </button>

              {hasResumableRun && resumableCalendar && (
                <button
                  type="button"
                  data-testid="landing-continue-btn"
                  title={ui.title.landingContinueTitle}
                  onClick={handleContinueRun}
                  className="sm:w-auto min-h-12 sm:min-h-14 rounded-xl border-2 border-[#1f2421] bg-[#1f5c53] hover:bg-[#174740] text-[#fffdf8] font-bold text-sm sm:text-base px-4 py-2 flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-[3px_3px_0px_0px_rgba(31,36,33,0.9)] shrink-0"
                >
                  <Play className="w-4 h-4 fill-current shrink-0" aria-hidden="true" />
                  <span>{ui.title.landingContinueBtn(resumableCalendar.label)}</span>
                  <kbd className="hidden lg:inline-block font-bureau text-xs px-1.5 py-0.5 rounded bg-[#1f2421] text-[#fffdf8]">
                    C
                  </kbd>
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Ko-fi Support Banner (visible on both Mobile & Desktop) */}
        <KofiSupportBanner
          locale={locale}
          context="landing"
          placement="landing"
          testId="kofi-landing-banner"
          className="shrink-0"
        />

        {/* Reserved extensible footer slot for future social links */}
        <footer data-testid="landing-social-slot" className="shrink-0 empty:hidden" />
      </div>
    </main>
  );
}
