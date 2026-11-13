import { Award, Copy, Download, Home, RotateCcw, Share2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { GameState } from "../engine/index.ts";
import { playUiSound } from "../services/audio/soundEffects.ts";
import { compiledCatalog, resolveEndingIllustrationAsset } from "../services/content/catalog.ts";
import {
  getEndingMetadata,
  getVictoryBadgeLabel,
  resolveLocalizedEndingQuote,
} from "../services/endings/endingMetadata.ts";
import {
  formatDurationMonthsEs,
  formatEuros,
  normalizeLocale,
} from "../services/i18n/resolveEventText.ts";
import { getUiStrings } from "../services/i18n/uiStrings.ts";
import {
  copyShareText,
  createShareSummaryFromState,
  downloadShareCardPng,
  loadAndRenderShareCard,
  shareRunResult,
  stripOuterQuotes,
} from "../services/share/shareResult.ts";
import { useGameStore } from "../store/gameStore.ts";
import { useUIStore } from "../store/uiStore.ts";

export interface EndRunScreenProps {
  state: GameState;
}

export function EndRunScreen({ state }: EndRunScreenProps) {
  const startRun = useGameStore((s) => s.startRun);
  const returnToTitle = useGameStore((s) => s.returnToTitle);
  const viewingCertificateRun = useGameStore((s) => s.viewingCertificateRun);
  const activeRun = useGameStore((s) => s.activeRun);
  const rawLocale = useGameStore((s) => s.profile.settings.locale);
  const toggleLocalePreference = useGameStore((s) => s.toggleLocalePreference);
  const sfxMuted = useUIStore((s) => s.sfxMuted);
  const setConfirmOverwriteOpen = useUIStore((s) => s.setConfirmOverwriteOpen);

  const locale = normalizeLocale(rawLocale);
  const isEn = locale === "en";
  const ui = getUiStrings(locale);

  const screenRef = useRef<HTMLElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const hasActiveResumableRun =
    viewingCertificateRun !== null &&
    activeRun !== null &&
    activeRun.phase !== "game_over" &&
    activeRun.ending === null;

  const shareSummary = useMemo(() => createShareSummaryFromState(state), [state]);
  const endingMeta = getEndingMetadata(shareSummary.endingId, locale);
  const localizedQuote = resolveLocalizedEndingQuote(
    shareSummary.endingId,
    shareSummary.summaryQuote,
    locale,
    state,
  );
  const cleanQuote = stripOuterQuotes(localizedQuote);

  const endingIllustration = useMemo(
    () => resolveEndingIllustrationAsset(compiledCatalog.manifest, shareSummary.endingId),
    [shareSummary.endingId],
  );

  useEffect(() => {
    let cancelled = false;
    if (canvasRef.current) {
      void loadAndRenderShareCard(
        canvasRef.current,
        shareSummary,
        endingIllustration?.url,
        locale,
        { isCancelled: () => cancelled },
      );
    }
    return () => {
      cancelled = true;
    };
  }, [shareSummary, endingIllustration?.url, locale]);

  const handleStartNewRun = () => {
    if (hasActiveResumableRun) {
      returnToTitle();
      setConfirmOverwriteOpen(true);
      return;
    }
    void startRun();
  };

  const handleToggleLocale = () => {
    playUiSound("paper_choice", { muted: sfxMuted });
    setFeedback(null);
    void toggleLocalePreference();
  };

  const handleCopyText = async () => {
    const ok = await copyShareText(shareSummary, locale);
    setFeedback(ok ? ui.endRun.feedbackCopied : ui.endRun.feedbackCopyFailed);
  };

  const handleDownloadPng = async () => {
    if (!canvasRef.current) return;
    const filename = `certificado-autonomo-${shareSummary.monthsSurvived}m.png`;
    const ok = await downloadShareCardPng(canvasRef.current, filename);
    setFeedback(ok ? ui.endRun.feedbackDownloaded(filename) : ui.endRun.feedbackDownloadFailed);
  };

  const handleNativeShare = async () => {
    const res = await shareRunResult(shareSummary, canvasRef.current, locale);
    if (res.ok) {
      setFeedback(
        res.method === "clipboard" ? ui.endRun.feedbackClipboardFallback : ui.endRun.feedbackShared,
      );
    }
  };

  const actionsRef = useRef({
    startNewRun: handleStartNewRun,
    returnToTitle,
    copyText: () => void handleCopyText(),
    downloadPng: () => void handleDownloadPng(),
    nativeShare: () => void handleNativeShare(),
    toggleLocale: handleToggleLocale,
  });
  actionsRef.current = {
    startNewRun: handleStartNewRun,
    returnToTitle,
    copyText: () => void handleCopyText(),
    downloadPng: () => void handleDownloadPng(),
    nativeShare: () => void handleNativeShare(),
    toggleLocale: handleToggleLocale,
  };

  useEffect(() => {
    screenRef.current
      ?.querySelector<HTMLButtonElement>('[data-testid="end-new-run-btn"]')
      ?.focus({ preventScroll: true });
  }, []);

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

      if (
        event.key === "ArrowRight" ||
        event.key === "ArrowDown" ||
        event.key === "ArrowLeft" ||
        event.key === "ArrowUp"
      ) {
        const buttons = Array.from(
          screenRef.current?.querySelectorAll<HTMLButtonElement>(
            '[data-end-action="true"]:not(:disabled)',
          ) ?? [],
        );
        if (buttons.length > 0) {
          event.preventDefault();
          const active = document.activeElement as HTMLButtonElement | null;
          const currentIndex = active ? buttons.indexOf(active) : -1;
          const moveForward = event.key === "ArrowRight" || event.key === "ArrowDown";
          const nextIndex = moveForward
            ? currentIndex < 0
              ? 0
              : (currentIndex + 1) % buttons.length
            : currentIndex <= 0
              ? buttons.length - 1
              : currentIndex - 1;
          buttons[nextIndex]?.focus({ preventScroll: true });
        }
        return;
      }

      if (event.key === "Enter") {
        if (target && (target.tagName === "BUTTON" || target.tagName === "A")) {
          return;
        }
        event.preventDefault();
        actionsRef.current.startNewRun();
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        actionsRef.current.returnToTitle();
        return;
      }

      const key = event.key.toLowerCase();
      if (key === "n") {
        event.preventDefault();
        actionsRef.current.startNewRun();
      } else if (key === "i") {
        event.preventDefault();
        actionsRef.current.returnToTitle();
      } else if (key === "c") {
        event.preventDefault();
        actionsRef.current.copyText();
      } else if (key === "d") {
        event.preventDefault();
        actionsRef.current.downloadPng();
      } else if (key === "s") {
        event.preventDefault();
        actionsRef.current.nativeShare();
      } else if (key === "l") {
        event.preventDefault();
        actionsRef.current.toggleLocale();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const bannerHeaderBg =
    endingMeta.tone === "victory"
      ? "bg-[#1f5c53]"
      : endingMeta.tone === "abandon"
        ? "bg-[#264e7a]"
        : "bg-[#9e221b]";

  return (
    <main
      ref={screenRef}
      data-testid="end-run-screen"
      className="end-run-shell w-full max-w-[1360px] mx-auto px-3.5 sm:px-5 py-2 sm:py-2.5 lg:py-3 min-h-dvh lg:h-dvh lg:max-h-dvh lg:overflow-hidden [@media(max-height:559px)]:!h-auto [@media(max-height:559px)]:!max-h-none [@media(max-height:559px)]:!overflow-visible flex flex-col"
    >
      <section className="paper-dossier rounded-2xl overflow-hidden flex-1 min-h-0 flex flex-col">
        <div
          className={`end-run-header ${bannerHeaderBg} text-[#fffdf8] px-3.5 sm:px-5 py-1.5 sm:py-2 border-b-2 border-[#1f2421] flex flex-wrap items-center justify-between gap-2 shrink-0`}
        >
          <span className="stamp-badge text-[11px] sm:text-xs text-[#fce592]">
            {endingMeta.code}
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <span className="stamp-badge text-[11px] sm:text-xs px-2.5 py-0.5 rounded bg-[#1f2421] text-[#fffdf8]">
              {endingMeta.stampText}
            </span>
            <button
              type="button"
              data-testid="locale-toggle-btn"
              aria-label={ui.localeToggle.ariaLabel}
              title={ui.localeToggle.title}
              onClick={handleToggleLocale}
              className="h-7 px-2 rounded-md border border-[#fce592]/65 bg-[#1f2421] hover:bg-[#2d3430] text-[#fffdf8] font-bureau text-[11px] font-bold inline-flex items-center justify-center shrink-0 cursor-pointer transition-colors"
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

        <div className="end-run-body flex-1 min-h-0 p-3 sm:p-4 xl:p-5 grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-4 xl:gap-5 lg:items-stretch lg:overflow-y-auto dossier-scroll">
          {/* Left: Epitaph Narrative, Illustration, Stats & Actions */}
          <div className="end-run-left-stack lg:col-span-7 flex flex-col justify-between gap-2">
            <div className="space-y-2">
              <div className="space-y-0.5">
                <h1
                  data-testid="end-run-title"
                  className="font-editorial text-xl sm:text-2xl xl:text-3xl font-bold text-[#1f2421] leading-tight"
                >
                  {endingMeta.title}
                </h1>
                <p className="text-xs sm:text-sm text-[#373f3a] leading-snug">
                  {endingMeta.subtitle}
                </p>
              </div>

              {endingIllustration && (
                <img
                  data-testid="end-run-illustration"
                  data-asset-id={endingIllustration.id}
                  src={endingIllustration.url}
                  alt={endingMeta.title}
                  width={endingIllustration.width}
                  height={endingIllustration.height}
                  decoding="async"
                  className={`end-run-illustration w-full h-28 sm:h-36 lg:h-36 xl:h-44 object-cover rounded-xl border-2 border-[#1f2421] bg-[#f6efe0] shadow-[3px_3px_0px_0px_rgba(31,36,33,0.88)] ${
                    endingIllustration.render_mode === "pixel_art"
                      ? "render-pixel-art"
                      : "render-vector-hd"
                  }`}
                />
              )}

              <blockquote
                data-testid="end-run-quote"
                className="end-run-quote rounded-xl border border-[#1f2421]/35 bg-[#f6efe0] px-3 sm:px-3.5 py-1.5 sm:py-2 font-editorial italic text-[13.5px] sm:text-sm xl:text-base text-[#1f2421] leading-snug"
              >
                {isEn ? `"${cleanQuote}"` : `«${cleanQuote}»`}
              </blockquote>

              {/* Aligned Responsive Tabular Stats Grid (2x2 on mobile, non-truncating 4-col strip on sm+) */}
              <div className="grid grid-cols-2 sm:grid-cols-[1.25fr_1fr_1fr_1fr] gap-1.5 sm:gap-2 text-xs">
                <div className="rounded-lg border border-[#1f2421]/25 bg-[#fffdf8] p-1.5 sm:p-2 min-w-0">
                  <span className="text-[#4a524e] block text-[10px] sm:text-[11px] leading-tight break-words">
                    {ui.endRun.timeSurvivedLabel}
                  </span>
                  <strong
                    data-testid="end-run-duration"
                    className="font-bureau text-xs sm:text-[13px] leading-tight text-[#1f2421] tabular-nums block break-words"
                  >
                    {formatDurationMonthsEs(shareSummary.monthsSurvived, locale)}
                  </strong>
                </div>
                <div className="rounded-lg border border-[#1f2421]/25 bg-[#fffdf8] p-1.5 sm:p-2 min-w-0">
                  <span className="text-[#4a524e] block text-[10px] sm:text-[11px] leading-tight break-words">
                    {ui.endRun.finalCashLabel}
                  </span>
                  <strong
                    data-testid="end-run-money"
                    className={`font-bureau text-xs sm:text-sm tabular-nums whitespace-nowrap block ${
                      shareSummary.finalMoney < 0 ? "text-[#9e221b]" : "text-[#1f5c53]"
                    }`}
                  >
                    {formatEuros(shareSummary.finalMoney, locale)}
                  </strong>
                </div>
                <div className="rounded-lg border border-[#1f2421]/25 bg-[#fffdf8] p-1.5 sm:p-2 min-w-0">
                  <span className="text-[#4a524e] block text-[10px] sm:text-[11px] leading-tight break-words">
                    {ui.endRun.officialBillingLabel}
                  </span>
                  <strong
                    data-testid="end-run-billed"
                    className="font-bureau text-xs sm:text-sm text-[#264e7a] tabular-nums whitespace-nowrap block"
                  >
                    {formatEuros(shareSummary.lifetimeBilled, locale)}
                  </strong>
                </div>
                <div className="rounded-lg border border-[#1f2421]/25 bg-[#fffdf8] p-1.5 sm:p-2 min-w-0">
                  <span className="text-[#4a524e] block text-[10px] sm:text-[11px] leading-tight break-words">
                    {ui.endRun.seedLabel}
                  </span>
                  <strong
                    title={shareSummary.seed}
                    className="font-bureau text-[11px] sm:text-xs text-[#1f2421] leading-tight block break-all"
                  >
                    {shareSummary.seed}
                  </strong>
                </div>
              </div>

              {/* Earned Victory Badges (preserved even after Endless defeat) */}
              {shareSummary.earnedVictories.length > 0 && (
                <div
                  data-testid="end-run-victory-badges"
                  className="rounded-xl border border-[#1f5c53] bg-[#e8f5f1] p-2 space-y-1"
                >
                  <div className="flex items-center gap-1.5 stamp-badge text-[10px] text-[#1f5c53]">
                    <Award className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    {ui.endRun.victoryBadgesHeading}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {shareSummary.earnedVictories.map((badge) => (
                      <span
                        key={badge}
                        className="font-bureau text-xs font-bold px-2 py-0.5 rounded-md bg-[#1f5c53] text-[#fffdf8]"
                      >
                        ★ {getVictoryBadgeLabel(badge, locale).title}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Primary Replay & Main Menu CTAs FIRST (100% above the fold on 360×780 & desktop), followed by Share Controls */}
            <div className="space-y-2 pt-0.5">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  data-testid="end-new-run-btn"
                  data-end-action="true"
                  title={ui.endRun.newRunTitle}
                  onClick={handleStartNewRun}
                  className="min-h-12 rounded-lg border-2 border-[#1f2421] bg-[#b42b24] hover:bg-[#96221c] text-[#fffdf8] font-bold text-[13.5px] sm:text-sm leading-tight px-2.5 sm:px-4 py-1.5 flex items-center justify-center gap-1.5 sm:gap-2 text-center cursor-pointer transition-colors"
                >
                  <RotateCcw className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{ui.endRun.newRunBtn}</span>
                  <kbd className="hidden xl:inline-block font-bureau text-[11px] px-1.5 py-0.5 rounded bg-[#1f2421]/45 text-[#fffdf8]">
                    N
                  </kbd>
                </button>

                <button
                  type="button"
                  data-testid="end-return-title-btn"
                  data-end-action="true"
                  title={ui.endRun.returnTitleAttr}
                  onClick={returnToTitle}
                  className="min-h-12 rounded-lg border-2 border-[#1f2421] bg-[#efe4ce] hover:bg-[#e5d6ba] text-[#1f2421] font-bold text-[13.5px] sm:text-sm leading-tight px-2.5 sm:px-4 py-1.5 flex items-center justify-center gap-1.5 sm:gap-2 text-center cursor-pointer transition-colors"
                >
                  <Home className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{ui.endRun.returnTitleBtn}</span>
                  <kbd className="hidden xl:inline-block font-bureau text-[11px] px-1.5 py-0.5 rounded bg-[#1f2421]/15 text-[#1f2421]">
                    I / Esc
                  </kbd>
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1.5 border-t border-[#1f2421]/14">
                <button
                  type="button"
                  data-testid="share-native-btn"
                  data-end-action="true"
                  title={ui.endRun.shareTitle}
                  onClick={() => void handleNativeShare()}
                  className="min-h-11 rounded-lg border-2 border-[#1f2421] bg-[#1f5c53] hover:bg-[#174740] text-[#fffdf8] font-bold text-xs sm:text-sm leading-tight px-2 sm:px-3 py-1.5 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 text-center cursor-pointer transition-colors"
                >
                  <Share2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{ui.endRun.shareBtn}</span>
                </button>

                <button
                  type="button"
                  data-testid="copy-summary-btn"
                  data-end-action="true"
                  title={ui.endRun.copyTitle}
                  onClick={() => void handleCopyText()}
                  className="min-h-11 rounded-lg border-2 border-[#1f2421] bg-[#fffdf8] hover:bg-[#fcf4df] text-[#1f2421] font-bold text-xs sm:text-sm leading-tight px-2 sm:px-3 py-1.5 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 text-center cursor-pointer transition-colors"
                >
                  <Copy className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{ui.endRun.copyBtn}</span>
                  <kbd className="hidden xl:inline-block font-bureau text-[11px] px-1.5 py-0.5 rounded bg-[#1f2421]/12 text-[#1f2421]">
                    C
                  </kbd>
                </button>

                <button
                  type="button"
                  data-testid="download-card-btn"
                  data-end-action="true"
                  title={ui.endRun.downloadTitle}
                  onClick={() => void handleDownloadPng()}
                  className="min-h-11 rounded-lg border-2 border-[#1f2421] bg-[#fffdf8] hover:bg-[#fcf4df] text-[#1f2421] font-bold text-xs sm:text-sm leading-tight px-2 sm:px-3 py-1.5 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 text-center cursor-pointer transition-colors"
                >
                  <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{ui.endRun.downloadBtn}</span>
                </button>
              </div>

              {feedback && (
                <p
                  data-testid="share-feedback"
                  aria-live="polite"
                  className="rounded-lg border border-[#1f5c53] bg-[#e8f5f1] px-3 py-1.5 text-xs font-semibold text-[#1f5c53]"
                >
                  {feedback}
                </p>
              )}
            </div>
          </div>

          {/* Right: Live 1080x1350 Illustrated Canvas Certificate Preview */}
          <aside className="lg:col-span-5 paper-dossier-warm rounded-xl overflow-hidden flex flex-col min-h-0">
            <div className="dossier-header shrink-0">
              <span className="stamp-badge text-[11px] text-[#1f2421]">
                {ui.endRun.officialCertBadge}
              </span>
              <span className="font-bureau text-[11px] font-bold text-[#4a524e]">
                1080×1350 PNG
              </span>
            </div>
            <div className="flex-1 min-h-0 p-2.5 sm:p-3 flex items-center justify-center bg-[#efe4ce]/45">
              <canvas
                ref={canvasRef}
                data-testid="share-canvas"
                width={1080}
                height={1350}
                aria-label={ui.endRun.canvasAria}
                className="end-run-canvas w-full max-w-[280px] sm:max-w-xs xl:max-w-sm lg:max-h-full lg:w-auto aspect-[4/5] rounded-lg border-2 border-[#1f2421] shadow-sm bg-[#f6efe0]"
              />
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
