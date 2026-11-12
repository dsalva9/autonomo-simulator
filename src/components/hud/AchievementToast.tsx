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

  const ui = getUiStrings(locale);
  const lastPlayedSignatureRef = useRef<string>("");

  const queueSignature = newlyUnlockedAchievements.join(",");

  const isPhaseModalOpen =
    activeRun !== null &&
    pendingOutcome === null &&
    (activeRun.phase === "quarterly_tax" ||
      activeRun.phase === "victory_prompt" ||
      activeRun.phase === "annual_summary");
  const pauseAutoDismiss = abandonModalOpen || isPhaseModalOpen;

  const isInActiveGameDesk =
    activeRun !== null && (activeRun.ending === null || pendingOutcome !== null);

  useEffect(() => {
    if (!queueSignature) {
      lastPlayedSignatureRef.current = "";
      return;
    }

    if (lastPlayedSignatureRef.current !== queueSignature) {
      lastPlayedSignatureRef.current = queueSignature;
      playUiSound("achievement_seal", { muted: sfxMuted });
    }

    if (pauseAutoDismiss) {
      return;
    }

    const timer = window.setTimeout(() => {
      clearUnlockedToastQueue();
    }, 4500);
    return () => window.clearTimeout(timer);
  }, [queueSignature, sfxMuted, pauseAutoDismiss, clearUnlockedToastQueue]);

  if (newlyUnlockedAchievements.length === 0) {
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

  // On desktop (>=1280px): bottom-right corner clear of center stage & EndRunScreen headings.
  // On mobile/tablet (<1280px): below HUD during active desk play; bottom-anchored on EndRunScreen/TitleScreen so h1 is never occluded.
  const positionClasses = isInActiveGameDesk
    ? "top-[calc(var(--hud-height,7.25rem)+0.35rem)] left-3 right-3 mx-auto xl:top-auto xl:left-auto xl:mx-0 xl:bottom-4 xl:right-4"
    : "bottom-3 left-3 right-3 mx-auto xl:left-auto xl:mx-0 xl:bottom-4 xl:right-4";

  return (
    <output
      data-testid="achievement-toast"
      aria-live="polite"
      className={`fixed ${positionClasses} z-[60] w-[calc(100vw-1.5rem)] max-w-xs paper-dossier animate-dossier rounded-xl overflow-hidden bg-[#1f5c53] text-[#fffdf8]`}
    >
      <div className="px-3.5 py-2.5 flex items-start justify-between gap-2.5">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-[#fffdf8]/15 border border-[#fce592]/40 flex items-center justify-center shrink-0 mt-0.5">
            <Award className="w-4 h-4 text-[#fce592]" aria-hidden="true" />
          </div>
          <div className="min-w-0 text-xs leading-snug">
            <span className="stamp-badge block text-[10px] text-[#fce592]">
              {unlockedEntries.length > 1
                ? ui.toast.multipleUnlocked(unlockedEntries.length)
                : ui.toast.singleUnlocked(unlockedEntries[0]?.code ?? ui.toast.defaultCode)}
            </span>
            <strong className="font-editorial text-sm font-bold block truncate">
              {unlockedEntries.map((e) => e.title).join(" · ")}
            </strong>
            {unlockedEntries.length === 1 && unlockedEntries[0]?.description && (
              <span className="block text-[11px] text-[#f0faf7] line-clamp-1 mt-0.5">
                {unlockedEntries[0].description}
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={clearUnlockedToastQueue}
          aria-label={ui.toast.dismissAria}
          className="rounded p-1 text-[#fce592] hover:bg-[#fffdf8]/15 shrink-0 cursor-pointer"
        >
          <X className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>
    </output>
  );
}
