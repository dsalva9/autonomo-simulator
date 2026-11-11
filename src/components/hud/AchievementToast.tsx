import { Award, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { playUiSound } from "../../services/audio/soundEffects.ts";
import { ACHIEVEMENT_CATALOG } from "../../services/storage/index.ts";
import { useGameStore } from "../../store/gameStore.ts";
import { useUIStore } from "../../store/uiStore.ts";

export function AchievementToast() {
  const newlyUnlockedAchievements = useGameStore((s) => s.newlyUnlockedAchievements);
  const clearUnlockedToastQueue = useGameStore((s) => s.clearUnlockedToastQueue);
  const sfxMuted = useUIStore((s) => s.sfxMuted);

  const lastPlayedSignatureRef = useRef<string>("");

  const queueSignature = newlyUnlockedAchievements.join(",");

  useEffect(() => {
    if (!queueSignature) {
      lastPlayedSignatureRef.current = "";
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
  }, [queueSignature, sfxMuted, clearUnlockedToastQueue]);

  if (newlyUnlockedAchievements.length === 0) {
    return null;
  }

  const unlockedEntries = newlyUnlockedAchievements.map(
    (id) =>
      ACHIEVEMENT_CATALOG.find((a) => a.id === id) ?? {
        id,
        code: "SELLO",
        title: id,
        description: "",
      },
  );

  return (
    <output
      data-testid="achievement-toast"
      aria-live="polite"
      className="fixed bottom-20 lg:bottom-5 right-3 sm:right-5 z-40 w-[calc(100vw-1.5rem)] max-w-sm paper-dossier animate-dossier rounded-xl overflow-hidden bg-[#1f5c53] text-[#fffdf8]"
    >
      <div className="px-3.5 py-2.5 flex items-start justify-between gap-2.5">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-[#fffdf8]/15 border border-[#fce592]/40 flex items-center justify-center shrink-0 mt-0.5">
            <Award className="w-4 h-4 text-[#fce592]" aria-hidden="true" />
          </div>
          <div className="min-w-0 text-xs leading-snug">
            <span className="stamp-badge block text-[10px] text-[#fce592]">
              {unlockedEntries.length > 1
                ? `${unlockedEntries.length} SELLOS DESBLOQUEADOS`
                : `SELLO DESBLOQUEADO · ${unlockedEntries[0]?.code}`}
            </span>
            <strong className="font-editorial text-sm font-bold block truncate">
              {unlockedEntries.map((e) => e.title).join(" · ")}
            </strong>
            {unlockedEntries.length === 1 && unlockedEntries[0]?.description && (
              <span className="block text-[11px] text-[#e8f5f1]/90 line-clamp-1 mt-0.5">
                {unlockedEntries[0].description}
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={clearUnlockedToastQueue}
          aria-label="Cerrar aviso de logro"
          className="rounded p-1 text-[#fce592] hover:bg-[#fffdf8]/15 shrink-0 cursor-pointer"
        >
          <X className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>
    </output>
  );
}
