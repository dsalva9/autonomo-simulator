import { Award } from "lucide-react";
import { useEffect } from "react";
import { EndRunScreen } from "./screens/EndRunScreen.tsx";
import { GameScreen } from "./screens/GameScreen.tsx";
import { TitleScreen } from "./screens/TitleScreen.tsx";
import { ACHIEVEMENT_CATALOG } from "./services/storage/index.ts";
import { useGameStore } from "./store/gameStore.ts";
import { useUIStore } from "./store/uiStore.ts";

export function App() {
  const hydrated = useGameStore((s) => s.hydrated);
  const hydrate = useGameStore((s) => s.hydrate);
  const activeRun = useGameStore((s) => s.activeRun);
  const pendingOutcome = useGameStore((s) => s.pendingOutcome);
  const newlyUnlockedAchievements = useGameStore((s) => s.newlyUnlockedAchievements);
  const clearUnlockedToastQueue = useGameStore((s) => s.clearUnlockedToastQueue);

  const screenView = useUIStore((s) => s.screenView);
  const reducedMotionOverride = useUIStore((s) => s.reducedMotionOverride);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (newlyUnlockedAchievements.length === 0) {
      return;
    }
    const timer = window.setTimeout(() => {
      clearUnlockedToastQueue();
    }, 4500);
    return () => window.clearTimeout(timer);
  }, [newlyUnlockedAchievements, clearUnlockedToastQueue]);

  const unlockedAchievementLabels = newlyUnlockedAchievements
    .map((id) => ACHIEVEMENT_CATALOG.find((a) => a.id === id)?.title ?? id)
    .join(" · ");

  return (
    <div
      data-reduced-motion={reducedMotionOverride === true ? "true" : undefined}
      className="min-h-screen text-[#1f2421]"
    >
      {/* Achievement Unlock Banner */}
      {newlyUnlockedAchievements.length > 0 && (
        <output
          data-testid="achievement-toast"
          aria-live="polite"
          className="fixed bottom-20 lg:bottom-6 right-4 z-40 paper-dossier rounded-xl bg-[#1f5c53] text-[#fffdf8] px-4 py-3 flex items-center gap-2.5 shadow-lg max-w-sm"
        >
          <Award className="w-5 h-5 text-[#fce592] shrink-0" aria-hidden="true" />
          <div className="text-xs">
            <span className="stamp-badge block text-[10px] text-[#fce592]">SELLO DESBLOQUEADO</span>
            <strong className="font-bold">{unlockedAchievementLabels}</strong>
          </div>
        </output>
      )}

      {!hydrated ? (
        <main className="min-h-screen flex items-center justify-center p-6">
          <div className="paper-dossier rounded-xl p-6 text-center space-y-2">
            <p className="stamp-badge text-xs text-[#8f510d]">MODELO 036 · CARGANDO</p>
            <h1 className="font-editorial text-xl font-bold">Abriendo carpeta fiscal...</h1>
          </div>
        </main>
      ) : screenView === "title" || !activeRun ? (
        <TitleScreen />
      ) : activeRun.ending !== null && pendingOutcome === null ? (
        <EndRunScreen state={activeRun} />
      ) : (
        <GameScreen state={activeRun} />
      )}
    </div>
  );
}

export default App;
