import { Award, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { getLocalizedAchievement } from "../../services/achievements/definitions.ts";
import { playUiSound } from "../../services/audio/soundEffects.ts";
import { getUiStrings } from "../../services/i18n/uiStrings.ts";
import { useGameStore } from "../../store/gameStore.ts";
import { useUIStore } from "../../store/uiStore.ts";

export function AchievementToast() {
  const newlyUnlockedAchievements = useGameStore((s) => s.newlyUnlockedAchievements);
  const clearUnlockedToastQueue = useGameStore((s) => s.clearUnlockedToastQueue);
  const activeRun = useGameStore((s) => s.activeRun);
  const pendingOutcome = useGameStore((s) => s.pendingOutcome);
  const locale = useGameStore((s) => s.profile.settings.locale);
  const sfxMuted = useUIStore((s) => s.sfxMuted);
  const abandonModalOpen = useUIStore((s) => s.abandonModalOpen);
  const confirmOverwriteOpen = useUIStore((s) =>
    Boolean((s as unknown as Record<string, unknown>).confirmOverwriteOpen),
  );

  const ui = getUiStrings(locale);
  const lastPlayedSignatureRef = useRef<string>("");

  const queueSignature = newlyUnlockedAchievements.join(",");

  const isPhaseModalOpen =
    activeRun !== null &&
    pendingOutcome === null &&
    (activeRun.phase === "quarterly_tax" ||
      activeRun.phase === "victory_prompt" ||
      activeRun.phase === "annual_summary");
  const anyModalOpen = abandonModalOpen || confirmOverwriteOpen || isPhaseModalOpen;

  const isInActiveGameDesk =
    activeRun !== null && (activeRun.ending === null || pendingOutcome !== null);

  useEffect(() => {
    if (!queueSignature) {
      lastPlayedSignatureRef.current = "";
      return;
    }

    if (anyModalOpen) {
      return;
    }

    if (lastPlayedSignatureRef.current !== queueSignature) {
      lastPlayedSignatureRef.current = queueSignature;
      playUiSound("achievement_seal", { muted: sfxMuted });
    }

    const timer = window.setTimeout(() => {
      clearUnlockedToastQueue();
    }, 4500);
    return () => window.clearTimeout(timer);
  }, [queueSignature, sfxMuted, anyModalOpen, clearUnlockedToastQueue]);

  if (newlyUnlockedAchievements.length === 0 || anyModalOpen) {
    return null;
  }

  const unlockedEntries = newlyUnlockedAchievements.map(
    (id) =>
      getLocalizedAchievement(id, locale) ?? {
        id,
        code: ui.toast.defaultCode,
        title: id,
        description: "",
      },
  );

  const primaryEntry = unlockedEntries[0];
  const extraUnlockedCount = Math.max(0, unlockedEntries.length - 1);

  // Active desk: slim 1-line pill below HUD on mobile/tablet (<1024px), bottom-right on desktop (>=1024px).
  // EndRunScreen / TitleScreen: top-14 ribbon clear of header locale toggle AND 100% clear of bottom replay/share CTAs.
  const positionClasses = isInActiveGameDesk
    ? "top-[calc(var(--hud-height,6.25rem)+0.25rem)] left-3 right-3 sm:left-auto sm:right-4 sm:w-auto sm:max-w-sm lg:top-auto lg:left-auto lg:bottom-4 lg:right-4 lg:w-[calc(100vw-1.5rem)] lg:max-w-xs"
    : "top-14 right-3 left-3 sm:left-auto sm:w-[calc(100vw-1.5rem)] sm:max-w-sm";

  return (
    <output
      data-testid="achievement-toast"
      aria-live="polite"
      className={`fixed ${positionClasses} z-40 paper-dossier animate-dossier rounded-xl overflow-hidden bg-[#1f5c53] text-[#fffdf8]`}
    >
      <div className="min-h-9 px-2.5 py-1 sm:px-3.5 sm:py-2 flex items-center sm:items-start justify-between gap-2">
        <div className="flex items-center sm:items-start gap-2 min-w-0 flex-1">
          <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-[#fffdf8]/15 border border-[#fce592]/40 flex items-center justify-center shrink-0 sm:mt-0.5">
            <Award className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#fce592]" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1 text-xs leading-snug">
            <span className="hidden sm:block stamp-badge text-[10px] text-[#fce592]">
              {extraUnlockedCount > 0
                ? ui.toast.multipleUnlocked(unlockedEntries.length)
                : ui.toast.singleUnlocked(primaryEntry?.code ?? ui.toast.defaultCode)}
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <strong className="font-editorial text-xs sm:text-sm font-bold text-[#fffdf8] leading-tight break-words">
                {primaryEntry?.title ?? ui.toast.defaultCode}
              </strong>
              {extraUnlockedCount > 0 && (
                <span
                  data-testid="achievement-toast-extra-count"
                  className="font-bureau text-[10px] font-bold leading-none px-1.5 py-0.5 rounded bg-[#fce592] text-[#1f2421] shrink-0 tabular-nums"
                >
                  +{extraUnlockedCount}
                </span>
              )}
            </div>
            {extraUnlockedCount === 0 && primaryEntry?.description && (
              <span className="hidden sm:block text-[11px] text-[#f0faf7] line-clamp-1 mt-0.5">
                {primaryEntry.description}
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={clearUnlockedToastQueue}
          aria-label={ui.toast.dismissAria}
          className="min-h-7 min-w-7 rounded p-1 text-[#fce592] hover:bg-[#fffdf8]/15 flex items-center justify-center shrink-0 cursor-pointer"
        >
          <X className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>
    </output>
  );
}
