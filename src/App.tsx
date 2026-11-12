import { useEffect } from "react";
import { AchievementToast } from "./components/hud/AchievementToast.tsx";
import { EndRunScreen } from "./screens/EndRunScreen.tsx";
import { GameScreen } from "./screens/GameScreen.tsx";
import { TitleScreen } from "./screens/TitleScreen.tsx";
import { normalizeLocale } from "./services/i18n/resolveEventText.ts";
import { getUiStrings } from "./services/i18n/uiStrings.ts";
import { getVisibleGameState, useGameStore } from "./store/gameStore.ts";
import { useUIStore } from "./store/uiStore.ts";

export function App() {
  const hydrated = useGameStore((s) => s.hydrated);
  const hydrate = useGameStore((s) => s.hydrate);
  const activeRun = useGameStore((s) => s.activeRun);
  const outcomePreviewState = useGameStore((s) => s.outcomePreviewState);
  const pendingOutcome = useGameStore((s) => s.pendingOutcome);
  const locale = useGameStore((s) => s.profile.settings.locale);

  const screenView = useUIStore((s) => s.screenView);
  const reducedMotionOverride = useUIStore((s) => s.reducedMotionOverride);

  const normalizedLocale = normalizeLocale(locale);
  const ui = getUiStrings(normalizedLocale);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = normalizedLocale === "en" ? "en" : "es";
    }
  }, [normalizedLocale]);

  const visibleState = getVisibleGameState({ activeRun, outcomePreviewState });

  return (
    <div
      data-reduced-motion={reducedMotionOverride === true ? "true" : undefined}
      className="min-h-screen text-[#1f2421] overflow-x-clip"
    >
      <AchievementToast />

      {!hydrated ? (
        <main className="min-h-screen flex items-center justify-center p-6">
          <div className="paper-dossier rounded-xl p-6 text-center space-y-2">
            <p className="stamp-badge text-xs text-[#8f510d]">{ui.app.loadingBadge}</p>
            <h1 className="font-editorial text-xl font-bold">{ui.app.loadingTitle}</h1>
          </div>
        </main>
      ) : screenView === "title" || !visibleState ? (
        <TitleScreen />
      ) : visibleState.ending !== null && pendingOutcome === null ? (
        <EndRunScreen state={visibleState} />
      ) : (
        <GameScreen state={visibleState} />
      )}
    </div>
  );
}

export default App;
