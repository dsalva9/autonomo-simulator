import {
  AlertCircle,
  AlertTriangle,
  Award,
  CheckCircle2,
  FileCheck2,
  FilePlus2,
  FolderArchive,
  Play,
  Sparkles,
  Target,
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
import { useModalKeyboard } from "../components/modals/useModalKeyboard.ts";
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
import { type ConfirmOverwriteRunStrings, getUiStrings } from "../services/i18n/uiStrings.ts";
import { useGameStore } from "../store/gameStore.ts";
import { useUIStore } from "../store/uiStore.ts";

interface ConfirmOverwriteModalProps {
  strings: ConfirmOverwriteRunStrings;
  calendarLabel: string;
  formattedCash: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function stripOuterQuotes(text: string): string {
  return text.trim().replace(/^["«“]+|["»”]+$/g, "");
}

function ConfirmOverwriteModal({
  strings,
  calendarLabel,
  formattedCash,
  onConfirm,
  onCancel,
}: ConfirmOverwriteModalProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  useModalKeyboard(dialogRef, {
    onEscape: onCancel,
    onDefaultEnter: onConfirm,
    shortcuts: {
      "1": onConfirm,
      "2": onCancel,
    },
  });

  return (
    <dialog
      ref={dialogRef}
      open
      aria-modal="true"
      aria-labelledby="confirm-overwrite-title"
      data-testid="confirm-overwrite-run-modal"
      className="fixed inset-0 z-50 m-0 h-dvh w-full max-h-none max-w-none border-0 bg-[#1f2421]/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4"
    >
      <div className="paper-dossier animate-dossier w-full max-w-md max-h-[calc(100dvh-1.5rem)] flex flex-col rounded-xl overflow-hidden bg-[#fffdf8]">
        <div className="bg-[#9e221b] text-[#fffdf8] px-4 py-2.5 sm:py-3 border-b-2 border-[#1f2421] flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="w-5 h-5 shrink-0 text-[#fce592]" aria-hidden="true" />
            <h2
              id="confirm-overwrite-title"
              className="font-editorial text-base sm:text-lg font-bold"
            >
              {strings.heading}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label={strings.closeAria}
            className="min-h-9 min-w-9 inline-flex items-center justify-center gap-1 rounded px-2 py-1 hover:bg-[#fffdf8]/15 shrink-0 cursor-pointer"
          >
            <span className="hidden sm:inline font-bureau text-[10px] font-bold text-[#fce592]">
              Esc
            </span>
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 min-h-0 p-4 space-y-3 text-sm text-[#1f2421] overflow-y-auto dossier-scroll">
          <p className="text-[#373f3a] leading-snug">
            {strings.bodyWithRun(calendarLabel, formattedCash)}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              data-testid="confirm-overwrite-run-btn"
              data-autofocus="true"
              data-modal-option="true"
              onClick={onConfirm}
              className="min-h-12 rounded-lg border-2 border-[#1f2421] bg-[#b42b24] hover:bg-[#96221c] text-[#fffdf8] font-bold text-sm px-3.5 py-2.5 flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <span>{strings.confirmBtn}</span>
              <kbd className="hidden sm:inline-block font-bureau text-[11px] px-1.5 py-0.5 rounded bg-[#1f2421] text-[#fffdf8] shrink-0">
                1
              </kbd>
            </button>

            <button
              type="button"
              data-testid="cancel-overwrite-run-btn"
              data-modal-option="true"
              onClick={onCancel}
              className="min-h-12 rounded-lg border-2 border-[#1f2421] bg-[#efe4ce] hover:bg-[#e5d6ba] text-[#1f2421] font-bold text-sm px-3.5 py-2.5 flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <span>{strings.cancelBtn}</span>
              <kbd className="hidden sm:inline-block font-bureau text-[11px] px-1.5 py-0.5 rounded bg-[#1f2421] text-[#fffdf8] shrink-0">
                Esc
              </kbd>
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}

export function TitleScreen() {
  const activeRun = useGameStore((s) => s.activeRun);
  const profile = useGameStore((s) => s.profile);
  const corruptedSaveNotice = useGameStore((s) => s.corruptedSaveNotice);
  const startRun = useGameStore((s) => s.startRun);
  const continueRun = useGameStore((s) => s.continueRun);
  const openPastRunCertificate = useGameStore((s) => s.openPastRunCertificate);
  const dismissCorruptNotice = useGameStore((s) => s.dismissCorruptNotice);
  const setReducedMotionPreference = useGameStore((s) => s.setReducedMotionPreference);
  const toggleLocalePreference = useGameStore((s) => s.toggleLocalePreference);

  const activeTitleTab = useUIStore((s) => s.activeTitleTab);
  const setActiveTitleTab = useUIStore((s) => s.setActiveTitleTab);
  const confirmOverwriteOpen = useUIStore((s) => s.confirmOverwriteOpen);
  const setConfirmOverwriteOpen = useUIStore((s) => s.setConfirmOverwriteOpen);
  const reducedMotionOverride = useUIStore((s) => s.reducedMotionOverride);
  const sfxMuted = useUIStore((s) => s.sfxMuted);
  const toggleSfxMuted = useUIStore((s) => s.toggleSfxMuted);
  const fastPacing = useUIStore((s) => s.fastPacing);
  const toggleFastPacing = useUIStore((s) => s.toggleFastPacing);

  const [seedInput, setSeedInput] = useState("");

  const seedInputRef = useRef<HTMLInputElement | null>(null);
  const hallTabRef = useRef<HTMLButtonElement | null>(null);
  const achievementsTabRef = useRef<HTMLButtonElement | null>(null);

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
  }, [hasResumableRun, confirmOverwriteOpen, setConfirmOverwriteOpen]);

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
    handleToggleReducedMotion,
    handleToggleSfx,
    handleToggleFastPacing,
    handleToggleLocale,
    setActiveTitleTab,
    dismissCorruptNotice,
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) {
        if (event.key === "Enter" || event.key === " " || event.key === "Tab") {
          event.preventDefault();
        }
        return;
      }
      if (event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }

      const actions = keyboardActionsRef.current;
      if (actions.confirmOverwriteOpen) {
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
      className="title-screen-shell w-full max-w-[1360px] mx-auto px-3.5 sm:px-5 py-2 sm:py-3 min-h-dvh lg:h-dvh lg:max-h-dvh lg:overflow-hidden [@media(max-height:559px)]:!h-auto [@media(max-height:559px)]:!max-h-none [@media(max-height:559px)]:!overflow-visible flex flex-col"
    >
      <div inert={confirmOverwriteOpen} className="flex-1 min-h-0 flex flex-col gap-2 sm:gap-2.5">
        {/* Compact Corrupt Save Recovery Banner */}
        {corruptedSaveNotice && (
          <div
            data-testid="corrupt-save-alert"
            role="alert"
            className="paper-dossier shrink-0 rounded-xl border-2 border-[#9e221b] bg-[#fdf0ef] px-3 py-2 flex items-center justify-between gap-2.5"
          >
            <div className="flex items-center gap-2 text-xs text-[#1f2421] min-w-0">
              <AlertCircle className="w-4 h-4 text-[#9e221b] shrink-0" aria-hidden="true" />
              <p className="min-w-0 leading-snug">
                <strong className="text-[#9e221b]">{ui.title.corruptTitle}:</strong>{" "}
                <span className="text-[#373f3a]">{ui.title.corruptBody(corruptedSaveNotice)}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={dismissCorruptNotice}
              className="min-h-8 font-bureau text-xs font-bold px-2.5 py-1 rounded border border-[#1f2421] bg-[#fffdf8] text-[#1f2421] shrink-0 cursor-pointer"
            >
              {ui.title.corruptDismiss}
            </button>
          </div>
        )}

        {/* Hero Bureaucratic Header Card with Integrated Desk Utility Toggles */}
        <section className="paper-dossier shrink-0 rounded-2xl overflow-hidden">
          <div className="bg-[#1f2421] text-[#fffdf8] px-3 sm:px-5 py-1.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 border-b-2 border-[#1f2421]">
            <div className="flex items-center gap-2 min-w-0">
              <span className="stamp-badge text-[10px] sm:text-xs text-[#fce592] leading-tight">
                {ui.title.headerFormBadge}
              </span>
              <span className="hidden xl:inline font-bureau text-[11px] text-[#efe4ce] shrink-0">
                · {ui.title.headerCountryBadge}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 ml-auto">
              <button
                type="button"
                data-testid="toggle-reduced-motion"
                title={ui.title.reducedMotionTitleAttr}
                aria-label={ui.title.reducedMotionTitle}
                aria-pressed={reducedMotionOverride === true}
                onClick={handleToggleReducedMotion}
                className={`h-7 px-2 rounded-md border font-bureau text-[11px] font-bold inline-flex items-center gap-1 shrink-0 cursor-pointer transition-colors ${
                  reducedMotionOverride === true
                    ? "border-[#fce592] bg-[#e8f5f1] text-[#174740]"
                    : "border-[#efe4ce]/45 bg-[#2d3430] hover:bg-[#3a433e] text-[#fffdf8]"
                }`}
              >
                <span>
                  {reducedMotionOverride === true ? ui.title.motionPillOn : ui.title.motionPillAuto}
                </span>
              </button>

              <button
                type="button"
                data-testid="toggle-sfx-title-btn"
                title={ui.title.sfxTitleAttr}
                aria-label={ui.title.sfxTitle}
                aria-pressed={!sfxMuted}
                onClick={handleToggleSfx}
                className={`h-7 px-2 rounded-md border font-bureau text-[11px] font-bold inline-flex items-center gap-1 shrink-0 cursor-pointer transition-colors ${
                  !sfxMuted
                    ? "border-[#fce592] bg-[#e8f5f1] text-[#174740]"
                    : "border-[#efe4ce]/45 bg-[#2d3430] hover:bg-[#3a433e] text-[#fffdf8]"
                }`}
              >
                {sfxMuted ? (
                  <VolumeX className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                )}
                <span>{sfxMuted ? ui.title.sfxPillMuted : ui.title.sfxPillActive}</span>
              </button>

              <button
                type="button"
                data-testid="toggle-fast-pacing-title-btn"
                title={ui.title.fastPacingTitleAttr}
                aria-label={ui.title.fastPacingTitle}
                aria-pressed={fastPacing}
                onClick={handleToggleFastPacing}
                className={`h-7 px-2 rounded-md border font-bureau text-[11px] font-bold inline-flex items-center gap-1 shrink-0 cursor-pointer transition-colors ${
                  fastPacing
                    ? "border-[#fce592] bg-[#fce592] text-[#1f2421]"
                    : "border-[#efe4ce]/45 bg-[#2d3430] hover:bg-[#3a433e] text-[#fffdf8]"
                }`}
              >
                <Zap className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>{fastPacing ? ui.title.fastPillOn : ui.title.fastPillOff}</span>
              </button>

              <button
                type="button"
                data-testid="locale-toggle-btn"
                aria-label={ui.localeToggle.ariaLabel}
                title={ui.localeToggle.title}
                onClick={handleToggleLocale}
                className="h-7 px-2 rounded-md border border-[#fce592]/60 bg-[#2d3430] hover:bg-[#3a433e] text-[#fffdf8] font-bureau text-[11px] font-bold inline-flex items-center justify-center shrink-0 cursor-pointer transition-colors"
              >
                <span
                  className={
                    isEn ? "text-[#d8cbb5]" : "text-[#fce592] underline underline-offset-2"
                  }
                >
                  ES
                </span>
                <span className="text-[#b5a790] mx-1" aria-hidden="true">
                  |
                </span>
                <span
                  className={
                    isEn ? "text-[#fce592] underline underline-offset-2" : "text-[#d8cbb5]"
                  }
                >
                  EN
                </span>
              </button>
            </div>
          </div>

          <div className="title-hero-body px-3.5 sm:px-5 py-2.5 sm:py-3.5 bg-gradient-to-br from-[#fffdf8] via-[#fffdf8] to-[#f6efe0] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2.5 sm:gap-3.5">
            <div className="space-y-1 max-w-3xl">
              <h1 className="title-hero-title font-editorial text-xl sm:text-3xl font-bold text-[#1f2421] tracking-tight leading-tight">
                Autónomo Simulator
              </h1>
              <blockquote className="border-l-4 border-[#b42b24] pl-2.5 py-0.5 font-editorial italic text-xs sm:text-base text-[#373f3a]">
                {ui.title.taglineQuote}
              </blockquote>
              <p className="text-[11.5px] sm:text-xs lg:text-[13px] text-[#4a524e] leading-snug">
                {ui.title.heroLeadBeforeAmount}
                <strong className="font-bureau text-[#1f5c53] tabular-nums">
                  {formatEuros(150_000, locale)}
                </strong>
                {ui.title.heroLeadAfterAmount}
              </p>
            </div>

            {/* Official Tilted Rubber Stamp — safe margin prevents clipping on narrow 360px phones */}
            <div className="self-start lg:self-center shrink-0 mx-1.5 my-0.5 rotate-[-2.5deg] rounded-xl border-3 sm:border-4 border-[#9e221b] bg-[#fdf0ef] px-3 sm:px-4 py-1 sm:py-1.5 text-center shadow-xs">
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

        {/* Main 12-Column Workspace Grid: Play Actions (Left) + Provincial Archive (Right) */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 lg:items-stretch gap-3 sm:gap-3.5">
          {/* Left Column: Compact Continue Card + Inline-Seed New Run Card */}
          <div className="title-left-stack lg:col-span-5 flex flex-col gap-2.5 min-h-0">
            {hasResumableRun && activeRun && resumableCalendar && (
              <section
                data-testid="continue-run-card"
                className="paper-dossier shrink-0 rounded-xl overflow-hidden bg-[#e8f5f1]"
              >
                <div className="dossier-header !min-h-[32px] !py-1.5 !px-3 !bg-[#d7ede6] !border-[#1f5c53]/25">
                  <span className="stamp-badge text-[10px] sm:text-[11px] px-2 py-0.5 rounded bg-[#1f5c53] text-[#fffdf8] shrink-0">
                    {ui.title.activeDossierBadge}
                  </span>
                  <span className="font-bureau text-[11px] font-bold text-[#373f3a] break-all text-right leading-tight">
                    {ui.title.seedPrefix}: {activeRun.prng.seed}
                  </span>
                </div>

                <div className="title-card-body p-2.5 sm:p-3 space-y-2">
                  <div className="grid grid-cols-2 divide-x divide-[#1f2421]/14 rounded-lg border border-[#1f2421]/25 bg-[#fffdf8] text-xs">
                    <div className="px-2.5 py-1.5">
                      <span className="text-[#4a524e] block text-[10px] sm:text-[11px] leading-tight">
                        {ui.title.calendarLabel}
                      </span>
                      <strong
                        data-testid="continue-run-calendar"
                        className="font-editorial text-sm text-[#1f2421] leading-snug"
                      >
                        {resumableCalendar.label}
                      </strong>
                    </div>
                    <div className="px-2.5 py-1.5">
                      <span className="text-[#4a524e] block text-[10px] sm:text-[11px] leading-tight">
                        {ui.title.cashInHandLabel}
                      </span>
                      <strong
                        data-testid="continue-run-money"
                        className={`font-bureau text-sm tabular-nums whitespace-nowrap leading-snug ${
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
                    className="w-full min-h-12 rounded-lg border-2 border-[#1f2421] bg-[#1f5c53] hover:bg-[#174740] text-[#fffdf8] font-bold text-sm sm:text-base px-4 py-2 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    <Play
                      className="w-4 h-4 sm:w-5 sm:h-5 fill-current shrink-0"
                      aria-hidden="true"
                    />
                    <span>{ui.title.continueBtn}</span>
                    <kbd className="hidden xl:inline-block ml-1 font-bureau text-xs px-1.5 py-0.5 rounded bg-[#1f2421] text-[#fffdf8]">
                      C
                    </kbd>
                  </button>
                </div>
              </section>
            )}

            {/* New Run Card with Single-Row Inline Seed Field */}
            <form
              onSubmit={handleStartFormSubmit}
              className="paper-dossier shrink-0 rounded-xl overflow-hidden bg-[#fffdf8]"
            >
              <div className="dossier-header !min-h-[32px] !py-1.5 !px-3">
                <h2 className="font-editorial text-sm sm:text-base font-bold text-[#1f2421] flex items-center gap-1.5">
                  <FilePlus2 className="w-4 h-4 text-[#9e221b] shrink-0" aria-hidden="true" />
                  {ui.title.newRunHeading}
                </h2>
                <span className="stamp-badge text-[10px] px-2 py-0.5 rounded bg-[#fcf4df] text-[#7a4308] shrink-0">
                  {ui.title.box01Badge}
                </span>
              </div>

              <div className="title-card-body p-2.5 sm:p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="seed-input"
                    title={ui.title.seedInputLabel}
                    className="shrink-0 text-xs font-bold text-[#373f3a] inline-flex items-center gap-1"
                  >
                    <span>{ui.title.seedInlineLabel}</span>
                    <kbd className="hidden sm:inline-block font-bureau text-[10px] font-bold px-1 py-0.5 rounded bg-[#efe4ce] text-[#373f3a] border border-[#1f2421]/20">
                      S
                    </kbd>
                  </label>
                  <input
                    ref={seedInputRef}
                    id="seed-input"
                    data-testid="seed-input"
                    type="text"
                    value={seedInput}
                    onChange={(e) => setSeedInput(e.target.value)}
                    placeholder={ui.title.seedPlaceholder}
                    aria-label={ui.title.seedInputLabel}
                    maxLength={40}
                    className="flex-1 min-w-0 h-9 rounded-md border-2 border-[#1f2421]/60 bg-[#f6efe0] px-2.5 py-1 font-bureau text-xs sm:text-sm text-[#1f2421] placeholder:text-[#4a524e]"
                  />
                </div>

                <button
                  type="submit"
                  data-testid="start-run-btn"
                  title={ui.title.startRunTitle}
                  className="w-full min-h-12 rounded-lg border-2 border-[#1f2421] bg-[#b42b24] hover:bg-[#96221c] text-[#fffdf8] font-bold text-sm sm:text-base px-4 py-2 flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-xs"
                >
                  <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" aria-hidden="true" />
                  <span>{ui.title.startRunBtn}</span>
                  <kbd className="hidden xl:inline-block ml-1 font-bureau text-xs px-1.5 py-0.5 rounded bg-[#1f2421] text-[#fffdf8]">
                    N
                  </kbd>
                </button>

                {hasResumableRun && (
                  <p className="text-[11px] leading-tight text-[#7a4308] text-center">
                    {ui.title.replaceActiveNote}
                  </p>
                )}
              </div>
            </form>
          </div>

          {/* Right Column: Salón de Caídos & 15 Logros (Flex-Filled on >=1024px) */}
          <section className="lg:col-span-7 paper-dossier rounded-xl overflow-hidden bg-[#fffdf8] flex flex-col min-h-0">
            <div
              role="tablist"
              aria-label={ui.title.archiveTablistAria}
              onKeyDown={handleArchiveTabKeyDown}
              className="shrink-0 grid grid-cols-2 border-b-2 border-[#1f2421]/25 bg-[#efe4ce]"
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
                className={`min-h-12 px-2 sm:px-4 py-2 font-editorial font-bold text-xs sm:text-sm md:text-base leading-tight flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTitleTab === "hall_of_fame"
                    ? "bg-[#fffdf8] text-[#1f2421] shadow-[inset_0_-3px_0_0_#b42b24]"
                    : "text-[#373f3a] hover:bg-[#f6efe0]"
                }`}
              >
                <FolderArchive
                  className="hidden sm:block w-4 h-4 text-[#9e221b] shrink-0"
                  aria-hidden="true"
                />
                <span className="text-center">
                  {ui.title.hallTabBase}{" "}
                  <span className="inline-block rounded-full bg-[#1f2421]/10 px-1.5 py-0.5 font-bureau text-[11px] font-bold text-[#1f2421] tabular-nums">
                    ({profile.hall_of_fame.length})
                  </span>
                </span>
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
                className={`min-h-12 px-2 sm:px-4 py-2 font-editorial font-bold text-xs sm:text-sm md:text-base leading-tight flex items-center justify-center gap-1.5 border-l-2 border-[#1f2421]/25 cursor-pointer ${
                  activeTitleTab === "achievements"
                    ? "bg-[#fffdf8] text-[#1f2421] shadow-[inset_0_-3px_0_0_#1f5c53]"
                    : "text-[#373f3a] hover:bg-[#f6efe0]"
                }`}
              >
                <Award
                  className="hidden sm:block w-4 h-4 text-[#1f5c53] shrink-0"
                  aria-hidden="true"
                />
                <span className="text-center">
                  {ui.title.achievementsTabBase}{" "}
                  <span className="inline-block rounded-full bg-[#1f2421]/10 px-1.5 py-0.5 font-bureau text-[11px] font-bold text-[#1f2421] tabular-nums">
                    ({unlockedCount}/{localizedAchievements.length})
                  </span>
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
              className="title-archive-body p-3 sm:p-4 max-h-[52dvh] lg:!max-h-none lg:flex-1 lg:min-h-0 overflow-y-auto dossier-scroll"
            >
              {activeTitleTab === "hall_of_fame" ? (
                <div data-testid="hall-of-fame-list" className="h-full flex flex-col">
                  {profile.hall_of_fame.length === 0 ? (
                    <div className="flex-1 rounded-xl border-2 border-dashed border-[#1f2421]/25 bg-[#f6efe0]/85 p-4 sm:p-5 flex flex-col justify-between gap-3">
                      <div className="text-center space-y-1">
                        <span className="inline-flex items-center gap-1 stamp-badge text-[10px] px-2 py-0.5 rounded bg-[#fcf4df] text-[#7a4308] border border-[#7a4308]/35">
                          <Target className="w-3 h-3 shrink-0" aria-hidden="true" />
                          {ui.title.emptyHallStamp}
                        </span>
                        <p className="font-editorial font-bold text-base sm:text-lg text-[#1f2421]">
                          {ui.title.emptyHallTitle}
                        </p>
                        <p className="text-xs text-[#4a524e] max-w-md mx-auto leading-snug">
                          {ui.title.emptyHallBody}
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {ui.title.emptyHallGoals.map((goal) => (
                          <div
                            key={goal.code}
                            className="rounded-lg border border-[#1f2421]/20 bg-[#fffdf8] p-2.5 space-y-0.5 text-left"
                          >
                            <p className="stamp-badge text-[9.5px] text-[#7a4308]">{goal.code}</p>
                            <p className="font-bureau text-sm font-black text-[#1f5c53] tabular-nums">
                              {goal.target}
                            </p>
                            <p className="text-[11px] text-[#373f3a] leading-snug">{goal.desc}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <ul className="space-y-2.5">
                      {profile.hall_of_fame.map((run) => {
                        const meta = getEndingMetadata(run.ending_id, locale);
                        const rawQuote = resolveLocalizedEndingQuote(
                          run.ending_id,
                          run.summary_quote,
                          locale,
                        );
                        const cleanQuote = stripOuterQuotes(rawQuote);
                        const runSeed = (run as { seed?: string }).seed;
                        return (
                          <li
                            key={run.run_id}
                            className="rounded-lg border border-[#1f2421]/25 bg-[#f6efe0] p-3 space-y-1.5 text-xs"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-editorial font-bold text-sm text-[#1f2421]">
                                {meta.title}
                              </span>
                              <div className="flex items-center gap-1.5">
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
                                <button
                                  type="button"
                                  data-testid={`hall-view-cert-btn-${run.run_id}`}
                                  title={ui.title.viewCertTitle}
                                  onClick={() => {
                                    playUiSound("paper_choice", { muted: sfxMuted });
                                    openPastRunCertificate(run);
                                  }}
                                  className="min-h-7 px-2 py-0.5 rounded border border-[#1f2421]/45 bg-[#fffdf8] hover:bg-[#fcf4df] font-bureau text-[11px] font-bold text-[#1f2421] inline-flex items-center gap-1 cursor-pointer transition-colors"
                                >
                                  <FileCheck2
                                    className="w-3 h-3 text-[#1f5c53] shrink-0"
                                    aria-hidden="true"
                                  />
                                  <span>{ui.title.viewCertBtn}</span>
                                </button>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-x-3.5 gap-y-1 font-bureau font-bold text-[#373f3a] tabular-nums">
                              <span>⏱ {formatDurationMonthsEs(run.months_survived, locale)}</span>
                              <span>
                                💶 {ui.title.hallCashPrefix}: {formatEuros(run.final_money, locale)}
                              </span>
                              <span>
                                🧾 {ui.title.hallBilledPrefix}:{" "}
                                {formatEuros(run.lifetime_billed, locale)}
                              </span>
                              {runSeed && (
                                <span className="text-[#4a524e] break-all">
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
                              {isEn ? `"${cleanQuote}"` : `«${cleanQuote}»`}
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
                        className={`rounded-lg border p-2.5 sm:p-3 flex items-start justify-between gap-3 ${
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
                            unlockedAt
                              ? "bg-[#1f5c53] text-[#fffdf8]"
                              : "bg-[#efe4ce] text-[#373f3a]"
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
      </div>

      {/* Overwrite Active Run Confirmation Modal */}
      {confirmOverwriteOpen && hasResumableRun && activeRun && resumableCalendar && (
        <ConfirmOverwriteModal
          strings={ui.title.confirmOverwriteRun}
          calendarLabel={resumableCalendar.label}
          formattedCash={formatEuros(activeRun.indicators.money, locale)}
          onConfirm={executeStartNewRun}
          onCancel={() => setConfirmOverwriteOpen(false)}
        />
      )}
    </main>
  );
}
