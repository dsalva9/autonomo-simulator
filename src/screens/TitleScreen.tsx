import {
  AlertCircle,
  AlertTriangle,
  Award,
  CheckCircle2,
  FilePlus2,
  FolderArchive,
  Play,
  SlidersHorizontal,
  Sparkles,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";
import {
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { getLocalizedAchievementCatalog } from "../services/achievements/definitions.ts";
import { playUiSound } from "../services/audio/soundEffects.ts";
import {
  getEndingMetadata,
  getVictoryBadgeLabel,
  resolveLocalizedEndingQuote,
} from "../services/endings/endingMetadata.ts";
import {
  formatCalendarBadgeEs,
  formatDurationMonthsEs,
  formatEuros,
  normalizeLocale,
} from "../services/i18n/resolveEventText.ts";
import { getUiStrings } from "../services/i18n/uiStrings.ts";
import { useGameStore } from "../store/gameStore.ts";
import { useUIStore } from "../store/uiStore.ts";

export function TitleScreen() {
  const activeRun = useGameStore((s) => s.activeRun);
  const profile = useGameStore((s) => s.profile);
  const corruptedSaveNotice = useGameStore((s) => s.corruptedSaveNotice);
  const startRun = useGameStore((s) => s.startRun);
  const continueRun = useGameStore((s) => s.continueRun);
  const dismissCorruptNotice = useGameStore((s) => s.dismissCorruptNotice);
  const setReducedMotionPreference = useGameStore((s) => s.setReducedMotionPreference);
  const toggleLocalePreference = useGameStore((s) => s.toggleLocalePreference);

  const activeTitleTab = useUIStore((s) => s.activeTitleTab);
  const setActiveTitleTab = useUIStore((s) => s.setActiveTitleTab);
  const reducedMotionOverride = useUIStore((s) => s.reducedMotionOverride);
  const sfxMuted = useUIStore((s) => s.sfxMuted);
  const toggleSfxMuted = useUIStore((s) => s.toggleSfxMuted);
  const fastPacing = useUIStore((s) => s.fastPacing);
  const toggleFastPacing = useUIStore((s) => s.toggleFastPacing);

  const [seedInput, setSeedInput] = useState("");
  const [confirmOverwriteOpen, setConfirmOverwriteOpen] = useState(false);

  const seedInputRef = useRef<HTMLInputElement | null>(null);
  const hallTabRef = useRef<HTMLButtonElement | null>(null);
  const achievementsTabRef = useRef<HTMLButtonElement | null>(null);
  const confirmOverwriteBtnRef = useRef<HTMLButtonElement | null>(null);
  const cancelOverwriteBtnRef = useRef<HTMLButtonElement | null>(null);

  const locale = normalizeLocale(profile.settings.locale);
  const isEn = locale === "en";
  const ui = getUiStrings(locale);
  const localizedAchievements = getLocalizedAchievementCatalog(locale);

  const hasResumableRun =
    activeRun !== null && activeRun.phase !== "game_over" && activeRun.ending === null;
  const resumableCalendar =
    hasResumableRun && activeRun ? formatCalendarBadgeEs(activeRun.month, locale) : null;

  useEffect(() => {
    if (!hasResumableRun && confirmOverwriteOpen) {
      setConfirmOverwriteOpen(false);
    }
  }, [hasResumableRun, confirmOverwriteOpen]);

  useEffect(() => {
    if (confirmOverwriteOpen) {
      confirmOverwriteBtnRef.current?.focus({ preventScroll: true });
    }
  }, [confirmOverwriteOpen]);

  const executeStartNewRun = () => {
    setConfirmOverwriteOpen(false);
    playUiSound("stamp_thud", { muted: sfxMuted });
    void startRun(seedInput);
  };

  const handleRequestStartNewRun = () => {
    if (hasResumableRun) {
      playUiSound("paper_choice", { muted: sfxMuted });
      setConfirmOverwriteOpen(true);
      return;
    }
    executeStartNewRun();
  };

  const handleStartFormSubmit = (event: FormEvent) => {
    event.preventDefault();
    handleRequestStartNewRun();
  };

  const handleContinueRun = () => {
    playUiSound("paper_choice", { muted: sfxMuted });
    continueRun();
  };

  const handleToggleReducedMotion = () => {
    void setReducedMotionPreference(reducedMotionOverride === true ? null : true);
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

  const handleToggleLocale = () => {
    playUiSound("paper_choice", { muted: sfxMuted });
    void toggleLocalePreference();
  };

  const handleArchiveTabKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (
      event.key !== "ArrowLeft" &&
      event.key !== "ArrowRight" &&
      event.key !== "Home" &&
      event.key !== "End"
    ) {
      return;
    }
    event.preventDefault();
    const nextTab =
      event.key === "Home"
        ? "hall_of_fame"
        : event.key === "End"
          ? "achievements"
          : activeTitleTab === "hall_of_fame"
            ? "achievements"
            : "hall_of_fame";
    setActiveTitleTab(nextTab);
    if (nextTab === "hall_of_fame") {
      hallTabRef.current?.focus({ preventScroll: true });
    } else {
      achievementsTabRef.current?.focus({ preventScroll: true });
    }
  };

  const keyboardActionsRef = useRef({
    hasResumableRun,
    confirmOverwriteOpen,
    corruptedSaveNotice,
    handleContinueRun,
    handleRequestStartNewRun,
    executeStartNewRun,
    closeOverwriteModal: () => setConfirmOverwriteOpen(false),
    handleToggleReducedMotion,
    handleToggleSfx,
    handleToggleFastPacing,
    handleToggleLocale,
    setActiveTitleTab,
    dismissCorruptNotice,
  });
  keyboardActionsRef.current = {
    hasResumableRun,
    confirmOverwriteOpen,
    corruptedSaveNotice,
    handleContinueRun,
    handleRequestStartNewRun,
    executeStartNewRun,
    closeOverwriteModal: () => setConfirmOverwriteOpen(false),
    handleToggleReducedMotion,
    handleToggleSfx,
    handleToggleFastPacing,
    handleToggleLocale,
    setActiveTitleTab,
    dismissCorruptNotice,
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }

      const actions = keyboardActionsRef.current;

      if (actions.confirmOverwriteOpen) {
        if (event.key === "Escape") {
          event.preventDefault();
          actions.closeOverwriteModal();
          return;
        }
        if (event.key === "1") {
          event.preventDefault();
          actions.executeStartNewRun();
          return;
        }
        if (event.key === "2") {
          event.preventDefault();
          actions.closeOverwriteModal();
          return;
        }
        if (
          event.key === "ArrowLeft" ||
          event.key === "ArrowRight" ||
          event.key === "ArrowUp" ||
          event.key === "ArrowDown"
        ) {
          event.preventDefault();
          if (document.activeElement === confirmOverwriteBtnRef.current) {
            cancelOverwriteBtnRef.current?.focus({ preventScroll: true });
          } else {
            confirmOverwriteBtnRef.current?.focus({ preventScroll: true });
          }
          return;
        }
        if (event.key === "Tab") {
          const btns = [confirmOverwriteBtnRef.current, cancelOverwriteBtnRef.current].filter(
            (b): b is HTMLButtonElement => Boolean(b),
          );
          if (btns.length === 2) {
            event.preventDefault();
            const nextBtn = document.activeElement === btns[0] ? btns[1] : btns[0];
            nextBtn?.focus({ preventScroll: true });
          }
        }
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
        if (event.key === "Escape") {
          event.preventDefault();
          target.blur();
        }
        return;
      }

      if (event.key === "Enter") {
        if (target && (target.tagName === "BUTTON" || target.tagName === "A")) {
          return;
        }
        event.preventDefault();
        if (actions.hasResumableRun) {
          actions.handleContinueRun();
        } else {
          actions.handleRequestStartNewRun();
        }
        return;
      }

      if (event.key === "Escape") {
        if (actions.corruptedSaveNotice) {
          event.preventDefault();
          actions.dismissCorruptNotice();
        } else if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        return;
      }

      const key = event.key.toLowerCase();
      if (key === "c" && actions.hasResumableRun) {
        event.preventDefault();
        actions.handleContinueRun();
      } else if (key === "n") {
        event.preventDefault();
        actions.handleRequestStartNewRun();
      } else if (key === "s" || event.key === "/") {
        event.preventDefault();
        seedInputRef.current?.focus({ preventScroll: true });
        seedInputRef.current?.select();
      } else if (event.key === "1") {
        event.preventDefault();
        actions.setActiveTitleTab("hall_of_fame");
      } else if (event.key === "2") {
        event.preventDefault();
        actions.setActiveTitleTab("achievements");
      } else if (key === "r") {
        event.preventDefault();
        actions.handleToggleReducedMotion();
      } else if (key === "m") {
        event.preventDefault();
        actions.handleToggleSfx();
      } else if (key === "f") {
        event.preventDefault();
        actions.handleToggleFastPacing();
      } else if (key === "l") {
        event.preventDefault();
        actions.handleToggleLocale();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const unlockedCount = localizedAchievements.filter((ach) =>
    Boolean(profile.achievements[ach.id]),
  ).length;

  return (
    <main
      data-testid="title-screen"
      className="title-screen-shell min-h-screen px-3.5 sm:px-5 py-3.5 sm:py-4 max-w-6xl mx-auto space-y-3 sm:space-y-3.5"
    >
      {/* Corrupt Save Recovery Banner */}
      {corruptedSaveNotice && (
        <div
          data-testid="corrupt-save-alert"
          role="alert"
          className="paper-dossier rounded-xl border-2 border-[#9e221b] bg-[#fdf0ef] p-4 flex items-start justify-between gap-3"
        >
          <div className="flex items-start gap-2.5 text-sm text-[#1f2421]">
            <AlertCircle className="w-5 h-5 text-[#9e221b] shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-bold text-[#9e221b]">{ui.title.corruptTitle}</p>
              <p className="text-xs text-[#373f3a] mt-0.5">
                {ui.title.corruptBody(corruptedSaveNotice)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={dismissCorruptNotice}
            className="font-bureau text-xs font-bold px-2.5 py-1 rounded border border-[#1f2421] bg-[#fffdf8] shrink-0 cursor-pointer"
          >
            {ui.title.corruptDismiss}
          </button>
        </div>
      )}

      {/* Hero Bureaucratic Header Card */}
      <section className="paper-dossier rounded-2xl overflow-hidden">
        <div className="bg-[#1f2421] text-[#fffdf8] px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-2 border-b-2 border-[#1f2421]">
          <span className="stamp-badge text-[11px] sm:text-xs text-[#fce592]">
            {ui.title.headerFormBadge}
          </span>
          <div className="flex items-center gap-2.5 ml-auto">
            <span className="hidden sm:inline font-bureau text-[11px] sm:text-xs text-[#efe4ce]">
              {ui.title.headerCountryBadge}
            </span>
            <button
              type="button"
              data-testid="locale-toggle-btn"
              aria-label={ui.localeToggle.ariaLabel}
              title={ui.localeToggle.title}
              onClick={handleToggleLocale}
              className="h-7 px-2 rounded-md border border-[#fce592]/60 bg-[#2d3430] hover:bg-[#3a433e] text-[#fffdf8] font-bureau text-[11px] font-bold inline-flex items-center justify-center shrink-0 cursor-pointer transition-colors"
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
        </div>

        <div className="title-hero-body p-4 sm:p-5 bg-gradient-to-br from-[#fffdf8] via-[#fffdf8] to-[#f6efe0] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3.5">
          <div className="space-y-1 max-w-2xl">
            <h1 className="title-hero-title font-editorial text-2xl sm:text-4xl font-bold text-[#1f2421] tracking-tight">
              Autónomo Simulator
            </h1>
            <blockquote className="border-l-4 border-[#b42b24] pl-3 py-0.5 font-editorial italic text-sm sm:text-lg text-[#373f3a]">
              {ui.title.taglineQuote}
            </blockquote>
            <p className="text-xs sm:text-sm text-[#4a524e] leading-relaxed">
              {ui.title.heroLeadBeforeAmount}
              <strong className="font-bureau text-[#1f5c53] tabular-nums">
                {formatEuros(150_000, locale)}
              </strong>
              {ui.title.heroLeadAfterAmount}
            </p>
          </div>

          {/* Official Tilted Rubber Stamp — safe margin prevents clipping on narrow 360px phones */}
          <div className="self-start lg:self-center shrink-0 mx-1.5 my-0.5 rotate-[-2.5deg] rounded-xl border-4 border-[#9e221b] bg-[#fdf0ef] px-4 py-2 text-center shadow-xs">
            <p className="stamp-badge text-[10px] sm:text-[11px] text-[#9e221b]">
              {ui.title.stampTop}
            </p>
            <p className="font-bureau text-base sm:text-lg font-black text-[#9e221b] tabular-nums">
              {ui.title.stampMain}
            </p>
            <p className="font-bureau text-[10px] sm:text-[11px] font-bold text-[#373f3a]">
              {ui.title.stampBottom}
            </p>
          </div>
        </div>
      </section>

      {/* Main Action Grid: Play & Settings (Left) + Archive (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left Column: Play Actions & Desk Preferences */}
        <div className="title-left-stack lg:col-span-5 space-y-3">
          {hasResumableRun && activeRun && resumableCalendar && (
            <section
              data-testid="continue-run-card"
              className="paper-dossier rounded-xl overflow-hidden bg-[#e8f5f1]"
            >
              <div className="dossier-header !bg-[#d7ede6] !border-[#1f5c53]/25">
                <span className="stamp-badge text-[11px] px-2 py-0.5 rounded bg-[#1f5c53] text-[#fffdf8]">
                  {ui.title.activeDossierBadge}
                </span>
                <span className="font-bureau text-xs font-bold text-[#373f3a] truncate">
                  {ui.title.seedPrefix}: {activeRun.prng.seed}
                </span>
              </div>

              <div className="title-card-body p-3.5 space-y-2.5">
                <div className="grid grid-cols-2 divide-x divide-[#1f2421]/14 rounded-lg border border-[#1f2421]/25 bg-[#fffdf8] text-xs">
                  <div className="p-2">
                    <span className="text-[#4a524e] block text-[11px]">
                      {ui.title.calendarLabel}
                    </span>
                    <strong
                      data-testid="continue-run-calendar"
                      className="font-editorial text-sm text-[#1f2421]"
                    >
                      {resumableCalendar.label}
                    </strong>
                  </div>
                  <div className="p-2">
                    <span className="text-[#4a524e] block text-[11px]">
                      {ui.title.cashInHandLabel}
                    </span>
                    <strong
                      data-testid="continue-run-money"
                      className={`font-bureau text-sm tabular-nums whitespace-nowrap ${
                        activeRun.indicators.money < 0 ? "text-[#9e221b]" : "text-[#1f5c53]"
                      }`}
                    >
                      {formatEuros(activeRun.indicators.money, locale)}
                    </strong>
                  </div>
                </div>

                <button
                  type="button"
                  data-testid="continue-run-btn"
                  title={ui.title.continueTitle}
                  onClick={handleContinueRun}
                  className="w-full min-h-12 rounded-lg border-2 border-[#1f2421] bg-[#1f5c53] hover:bg-[#174740] text-[#fffdf8] font-bold text-base px-4 py-2 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <Play className="w-5 h-5 fill-current shrink-0" aria-hidden="true" />
                  <span>{ui.title.continueBtn}</span>
                  <kbd className="hidden xl:inline-block ml-1 font-bureau text-xs px-1.5 py-0.5 rounded bg-[#fffdf8]/20">
                    C
                  </kbd>
                </button>
              </div>
            </section>
          )}

          {/* New Run Card */}
          <form
            onSubmit={handleStartFormSubmit}
            className="paper-dossier rounded-xl overflow-hidden bg-[#fffdf8]"
          >
            <div className="dossier-header">
              <h2 className="font-editorial text-base font-bold text-[#1f2421] flex items-center gap-2">
                <FilePlus2 className="w-4 h-4 text-[#9e221b] shrink-0" aria-hidden="true" />
                {ui.title.newRunHeading}
              </h2>
              <span className="stamp-badge text-[10px] px-2 py-0.5 rounded bg-[#fcf4df] text-[#7a4308]">
                {ui.title.box01Badge}
              </span>
            </div>

            <div className="title-card-body p-3.5 space-y-2.5">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="seed-input"
                    className="block text-xs font-bold text-[#373f3a] uppercase tracking-wide"
                  >
                    {ui.title.seedInputLabel}
                  </label>
                  <kbd className="hidden xl:inline-block font-bureau text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#efe4ce] text-[#373f3a]">
                    S
                  </kbd>
                </div>
                <input
                  ref={seedInputRef}
                  id="seed-input"
                  data-testid="seed-input"
                  type="text"
                  value={seedInput}
                  onChange={(e) => setSeedInput(e.target.value)}
                  placeholder={ui.title.seedPlaceholder}
                  maxLength={40}
                  className="w-full min-h-11 rounded-lg border-2 border-[#1f2421]/60 bg-[#f6efe0] px-3.5 py-2 font-bureau text-sm text-[#1f2421] placeholder:text-[#4a524e]"
                />
              </div>

              <button
                type="submit"
                data-testid="start-run-btn"
                title={ui.title.startRunTitle}
                className="w-full min-h-12 rounded-lg border-2 border-[#1f2421] bg-[#b42b24] hover:bg-[#96221c] text-[#fffdf8] font-bold text-base px-4 py-2.5 flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-xs"
              >
                <Sparkles className="w-5 h-5 shrink-0" aria-hidden="true" />
                <span>{ui.title.startRunBtn}</span>
                <kbd className="hidden xl:inline-block ml-1 font-bureau text-xs px-1.5 py-0.5 rounded bg-[#1f2421]/25">
                  N
                </kbd>
              </button>

              {hasResumableRun && (
                <p className="text-xs text-[#7a4308] text-center">{ui.title.replaceActiveNote}</p>
              )}
            </div>
          </form>

          {/* Compact Desk Preferences Card: Motion, Sound & Fast Pacing */}
          <section className="paper-dossier rounded-xl overflow-hidden bg-[#fffdf8]">
            <div className="dossier-header">
              <h2 className="font-editorial text-base font-bold text-[#1f2421] flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-[#373f3a] shrink-0" aria-hidden="true" />
                {ui.title.settingsHeading}
              </h2>
              <span className="stamp-badge text-[10px] px-2 py-0.5 rounded bg-[#efe4ce] text-[#373f3a]">
                {ui.title.settingsBadge}
              </span>
            </div>

            <div className="divide-y divide-[#1f2421]/14 text-xs">
              <div className="px-4 py-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-[#1f2421]">{ui.title.reducedMotionTitle}</p>
                  <p className="text-[11px] text-[#4a524e]">{ui.title.reducedMotionDesc}</p>
                </div>
                <button
                  type="button"
                  data-testid="toggle-reduced-motion"
                  title={ui.title.reducedMotionTitleAttr}
                  onClick={handleToggleReducedMotion}
                  aria-pressed={reducedMotionOverride === true}
                  className={`min-h-9 px-3 py-1.5 rounded-lg border font-bureau font-bold shrink-0 cursor-pointer ${
                    reducedMotionOverride === true
                      ? "border-[#1f5c53] bg-[#e8f5f1] text-[#1f5c53]"
                      : "border-[#1f2421]/50 bg-[#f6efe0] text-[#1f2421]"
                  }`}
                >
                  {reducedMotionOverride === true
                    ? ui.title.reducedMotionOn
                    : ui.title.reducedMotionAuto}
                </button>
              </div>

              <div className="px-4 py-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-[#1f2421]">{ui.title.sfxTitle}</p>
                  <p className="text-[11px] text-[#4a524e]">{ui.title.sfxDesc}</p>
                </div>
                <button
                  type="button"
                  data-testid="toggle-sfx-title-btn"
                  title={ui.title.sfxTitleAttr}
                  aria-pressed={!sfxMuted}
                  onClick={handleToggleSfx}
                  className={`min-h-9 px-3 py-1.5 rounded-lg border font-bureau font-bold inline-flex items-center gap-1.5 shrink-0 cursor-pointer ${
                    !sfxMuted
                      ? "border-[#1f5c53] bg-[#e8f5f1] text-[#1f5c53]"
                      : "border-[#1f2421]/50 bg-[#f6efe0] text-[#373f3a]"
                  }`}
                >
                  {sfxMuted ? (
                    <VolumeX className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  )}
                  <span>{sfxMuted ? ui.title.sfxMutedLabel : ui.title.sfxActiveLabel}</span>
                </button>
              </div>

              <div className="px-4 py-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-[#1f2421]">{ui.title.fastPacingTitle}</p>
                  <p className="text-[11px] text-[#4a524e]">{ui.title.fastPacingDesc}</p>
                </div>
                <button
                  type="button"
                  data-testid="toggle-fast-pacing-title-btn"
                  title={ui.title.fastPacingTitleAttr}
                  aria-pressed={fastPacing}
                  onClick={handleToggleFastPacing}
                  className={`min-h-9 px-3 py-1.5 rounded-lg border font-bureau font-bold inline-flex items-center gap-1.5 shrink-0 cursor-pointer ${
                    fastPacing
                      ? "border-[#7a4308] bg-[#fcf4df] text-[#7a4308]"
                      : "border-[#1f2421]/50 bg-[#f6efe0] text-[#1f2421]"
                  }`}
                >
                  <Zap className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>{fastPacing ? ui.title.fastPacingOn : ui.title.fastPacingNormal}</span>
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: Salón de Caídos & 15 Logros */}
        <section className="lg:col-span-7 paper-dossier rounded-xl overflow-hidden bg-[#fffdf8]">
          <div
            role="tablist"
            aria-label={ui.title.archiveTablistAria}
            onKeyDown={handleArchiveTabKeyDown}
            className="grid grid-cols-2 border-b-2 border-[#1f2421]/25 bg-[#efe4ce]"
          >
            <button
              ref={hallTabRef}
              id="title-tab-hall-of-fame"
              type="button"
              role="tab"
              tabIndex={activeTitleTab === "hall_of_fame" ? 0 : -1}
              aria-selected={activeTitleTab === "hall_of_fame"}
              aria-controls="title-archive-panel"
              data-testid="title-tab-hall-of-fame"
              title={ui.title.hallTabTitle}
              onClick={() => setActiveTitleTab("hall_of_fame")}
              className={`min-h-12 px-3 sm:px-4 py-2.5 font-editorial font-bold text-sm sm:text-base flex items-center justify-center gap-2 cursor-pointer ${
                activeTitleTab === "hall_of_fame"
                  ? "bg-[#fffdf8] text-[#1f2421] shadow-[inset_0_-3px_0_0_#b42b24]"
                  : "text-[#373f3a] hover:bg-[#f6efe0]"
              }`}
            >
              <FolderArchive className="w-4 h-4 text-[#9e221b] shrink-0" aria-hidden="true" />
              <span className="truncate">{ui.title.hallTabLabel(profile.hall_of_fame.length)}</span>
            </button>
            <button
              ref={achievementsTabRef}
              id="title-tab-achievements"
              type="button"
              role="tab"
              tabIndex={activeTitleTab === "achievements" ? 0 : -1}
              aria-selected={activeTitleTab === "achievements"}
              aria-controls="title-archive-panel"
              data-testid="title-tab-achievements"
              title={ui.title.achievementsTabTitle}
              onClick={() => setActiveTitleTab("achievements")}
              className={`min-h-12 px-3 sm:px-4 py-2.5 font-editorial font-bold text-sm sm:text-base flex items-center justify-center gap-2 border-l-2 border-[#1f2421]/25 cursor-pointer ${
                activeTitleTab === "achievements"
                  ? "bg-[#fffdf8] text-[#1f2421] shadow-[inset_0_-3px_0_0_#1f5c53]"
                  : "text-[#373f3a] hover:bg-[#f6efe0]"
              }`}
            >
              <Award className="w-4 h-4 text-[#1f5c53] shrink-0" aria-hidden="true" />
              <span className="truncate">
                {ui.title.achievementsTabLabel(unlockedCount, localizedAchievements.length)}
              </span>
            </button>
          </div>

          <div
            id="title-archive-panel"
            role="tabpanel"
            // biome-ignore lint/a11y/noNoninteractiveTabindex: WAI-ARIA APG Tabs pattern & WCAG 2.1.1 scrollable tabpanel
            tabIndex={0}
            aria-labelledby={
              activeTitleTab === "hall_of_fame"
                ? "title-tab-hall-of-fame"
                : "title-tab-achievements"
            }
            data-testid="title-archive-panel"
            className="title-archive-body p-4 max-h-[460px] overflow-y-auto dossier-scroll"
          >
            {activeTitleTab === "hall_of_fame" ? (
              <div data-testid="hall-of-fame-list" className="space-y-2.5">
                {profile.hall_of_fame.length === 0 ? (
                  <div className="rounded-xl border-2 border-dashed border-[#1f2421]/20 bg-[#f6efe0] p-8 text-center space-y-1.5">
                    <p className="font-editorial font-bold text-base text-[#1f2421]">
                      {ui.title.emptyHallTitle}
                    </p>
                    <p className="text-xs text-[#4a524e] max-w-md mx-auto">
                      {ui.title.emptyHallBody}
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-2.5">
                    {profile.hall_of_fame.map((run) => {
                      const meta = getEndingMetadata(run.ending_id, locale);
                      const quote = resolveLocalizedEndingQuote(
                        run.ending_id,
                        run.summary_quote,
                        locale,
                      );
                      const runSeed = (run as { seed?: string }).seed;
                      return (
                        <li
                          key={run.run_id}
                          className="rounded-lg border border-[#1f2421]/25 bg-[#f6efe0] p-3.5 space-y-1.5 text-xs"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-editorial font-bold text-sm text-[#1f2421]">
                              {meta.title}
                            </span>
                            <span
                              className={`stamp-badge text-[10px] px-2 py-0.5 rounded border ${
                                meta.tone === "victory"
                                  ? "bg-[#e8f5f1] text-[#1f5c53] border-[#1f5c53]/40"
                                  : meta.tone === "abandon"
                                    ? "bg-[#ebf2fa] text-[#264e7a] border-[#264e7a]/40"
                                    : "bg-[#fdf0ef] text-[#9e221b] border-[#9e221b]/40"
                              }`}
                            >
                              {meta.stampText}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 font-bureau font-bold text-[#373f3a] tabular-nums">
                            <span>⏱ {formatDurationMonthsEs(run.months_survived, locale)}</span>
                            <span>
                              💶 {ui.title.hallCashPrefix}: {formatEuros(run.final_money, locale)}
                            </span>
                            <span>
                              🧾 {ui.title.hallBilledPrefix}:{" "}
                              {formatEuros(run.lifetime_billed, locale)}
                            </span>
                            {runSeed && (
                              <span className="text-[#4a524e]">
                                {ui.title.seedPrefix}: {runSeed}
                              </span>
                            )}
                          </div>
                          {run.earned_victories.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-0.5">
                              {run.earned_victories.map((badge) => (
                                <span
                                  key={badge}
                                  className="stamp-badge text-[10px] px-2 py-0.5 rounded bg-[#e8f5f1] text-[#1f5c53] border border-[#1f5c53]/40"
                                >
                                  ★ {getVictoryBadgeLabel(badge, locale).shortSeal}
                                </span>
                              ))}
                            </div>
                          )}
                          <p className="italic text-[#4a524e]">
                            {isEn ? `"${quote}"` : `«${quote}»`}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ) : (
              <ul data-testid="achievements-list" className="space-y-2">
                {localizedAchievements.map((ach) => {
                  const unlockedAt = profile.achievements[ach.id];
                  return (
                    <li
                      key={ach.id}
                      data-testid={`achievement-item-${ach.id}`}
                      className={`rounded-lg border p-3 flex items-start justify-between gap-3 ${
                        unlockedAt
                          ? "border-[#1f5c53] bg-[#e8f5f1]"
                          : "border-[#1f2421]/25 bg-[#f6efe0]"
                      }`}
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="stamp-badge text-[10px] px-1.5 py-0.5 rounded bg-[#1f2421] text-[#fffdf8]">
                            {ach.code}
                          </span>
                          <h3 className="font-editorial font-bold text-sm text-[#1f2421]">
                            {ach.title}
                          </h3>
                        </div>
                        <p className="text-xs text-[#373f3a] leading-snug">{ach.description}</p>
                      </div>
                      <span
                        className={`shrink-0 inline-flex items-center gap-1 stamp-badge text-[10px] px-2 py-1 rounded ${
                          unlockedAt ? "bg-[#1f5c53] text-[#fffdf8]" : "bg-[#efe4ce] text-[#373f3a]"
                        }`}
                      >
                        {unlockedAt ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                            {ui.title.achievementUnlockedBadge}
                          </>
                        ) : (
                          ui.title.achievementPendingBadge
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      </div>

      {/* Overwrite Active Run Confirmation Modal */}
      {confirmOverwriteOpen && hasResumableRun && activeRun && resumableCalendar && (
        <dialog
          open
          aria-modal="true"
          aria-labelledby="confirm-overwrite-title"
          data-testid="confirm-overwrite-run-modal"
          className="fixed inset-0 z-50 m-0 h-dvh w-full max-h-none max-w-none border-0 bg-[#1f2421]/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
        >
          <div className="paper-dossier animate-dossier w-full max-w-md rounded-xl overflow-hidden bg-[#fffdf8]">
            <div className="bg-[#9e221b] text-[#fffdf8] px-4 py-3 border-b-2 border-[#1f2421] flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <AlertTriangle className="w-5 h-5 shrink-0 text-[#fce592]" aria-hidden="true" />
                <h2
                  id="confirm-overwrite-title"
                  className="font-editorial text-base sm:text-lg font-bold"
                >
                  {isEn ? "Replace active dossier?" : "¿Reemplazar expediente en curso?"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setConfirmOverwriteOpen(false)}
                aria-label={isEn ? "Cancel" : "Cancelar"}
                className="inline-flex items-center gap-1 rounded px-1.5 py-1 hover:bg-[#fffdf8]/15 shrink-0 cursor-pointer"
              >
                <span className="hidden sm:inline font-bureau text-[10px] font-bold text-[#fce592]">
                  Esc
                </span>
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-sm text-[#1f2421]">
              <p className="text-[#373f3a] leading-snug">
                {isEn
                  ? `Starting a new registration will overwrite your active run (${resumableCalendar.label}, ${formatEuros(activeRun.indicators.money, locale)} in cash).`
                  : `Tramitar una nueva alta reemplazará la partida activa (${resumableCalendar.label}, ${formatEuros(activeRun.indicators.money, locale)} en caja).`}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <button
                  ref={confirmOverwriteBtnRef}
                  type="button"
                  data-testid="confirm-overwrite-run-btn"
                  onClick={executeStartNewRun}
                  className="min-h-12 rounded-lg border-2 border-[#1f2421] bg-[#b42b24] hover:bg-[#96221c] text-[#fffdf8] font-bold text-sm px-4 py-2.5 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <span>{isEn ? "Overwrite & start" : "Sí, nueva alta"}</span>
                  <kbd className="hidden sm:inline-block font-bureau text-[11px] px-1.5 py-0.5 rounded bg-[#1f2421]/25">
                    1
                  </kbd>
                </button>

                <button
                  ref={cancelOverwriteBtnRef}
                  type="button"
                  data-testid="cancel-overwrite-run-btn"
                  onClick={() => setConfirmOverwriteOpen(false)}
                  className="min-h-12 rounded-lg border-2 border-[#1f2421] bg-[#efe4ce] hover:bg-[#e5d6ba] text-[#1f2421] font-bold text-sm px-4 py-2.5 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <span>{isEn ? "Keep active run" : "Conservar partida"}</span>
                  <kbd className="hidden sm:inline-block font-bureau text-[11px] px-1.5 py-0.5 rounded bg-[#1f2421]/15">
                    Esc
                  </kbd>
                </button>
              </div>
            </div>
          </div>
        </dialog>
      )}
    </main>
  );
}
