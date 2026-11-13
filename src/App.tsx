import { useEffect, useRef } from "react";
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
  const viewingCertificateRun = useGameStore((s) => s.viewingCertificateRun);
  const pendingOutcome = useGameStore((s) => s.pendingOutcome);
  const locale = useGameStore((s) => s.profile.settings.locale);

  const screenView = useUIStore((s) => s.screenView);
  const confirmOverwriteOpen = useUIStore((s) => s.confirmOverwriteOpen);
  const reducedMotionOverride = useUIStore((s) => s.reducedMotionOverride);

  const normalizedLocale = normalizeLocale(locale);
  const ui = getUiStrings(normalizedLocale);

  const visibleState = getVisibleGameState({
    activeRun,
    outcomePreviewState,
    viewingCertificateRun,
  });
  const isViewingArchivedCertificate = viewingCertificateRun !== null;
  const inGameView = hydrated && screenView === "game" && visibleState !== null;
  const handlingPopStateRef = useRef(false);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = normalizedLocale === "en" ? "en" : "es";
    }
  }, [normalizedLocale]);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined" || !window.history) {
      return;
    }

    if (handlingPopStateRef.current) {
      handlingPopStateRef.current = false;
      return;
    }

    try {
      const currentHistState =
        typeof window.history.state === "object" && window.history.state !== null
          ? (window.history.state as Record<string, unknown>)
          : {};

      if (currentHistState.autonomoSlot !== "root" && currentHistState.autonomoSlot !== "leaf") {
        window.history.replaceState(
          {
            ...currentHistState,
            autonomoView: "title",
            autonomoSlot: "root",
            autonomoModal: null,
          },
          "",
        );
        if (inGameView) {
          window.history.pushState(
            {
              autonomoView: "game",
              autonomoSlot: "leaf",
              autonomoModal: null,
            },
            "",
          );
        } else if (confirmOverwriteOpen) {
          window.history.pushState(
            {
              autonomoView: "title",
              autonomoSlot: "leaf",
              autonomoModal: "confirm-overwrite",
            },
            "",
          );
        }
        return;
      }

      if (inGameView) {
        const nextGameState = {
          ...currentHistState,
          autonomoView: "game",
          autonomoSlot: "leaf",
          autonomoModal: null,
        };
        if (currentHistState.autonomoSlot === "leaf") {
          if (currentHistState.autonomoView !== "game" || currentHistState.autonomoModal !== null) {
            window.history.replaceState(nextGameState, "");
          }
        } else {
          window.history.pushState(nextGameState, "");
        }
      } else if (confirmOverwriteOpen) {
        const nextModalState = {
          ...currentHistState,
          autonomoView: "title",
          autonomoSlot: "leaf",
          autonomoModal: "confirm-overwrite",
        };
        if (currentHistState.autonomoSlot === "leaf") {
          if (
            currentHistState.autonomoView !== "title" ||
            currentHistState.autonomoModal !== "confirm-overwrite"
          ) {
            window.history.replaceState(nextModalState, "");
          }
        } else {
          window.history.pushState(nextModalState, "");
        }
      } else if (
        currentHistState.autonomoSlot === "leaf" &&
        (currentHistState.autonomoView !== "title" || currentHistState.autonomoModal !== null)
      ) {
        window.history.replaceState(
          {
            ...currentHistState,
            autonomoView: "title",
            autonomoSlot: "leaf",
            autonomoModal: null,
          },
          "",
        );
      }
    } catch {
      // Ignore history API restrictions in restricted frames/environments
    }
  }, [hydrated, inGameView, confirmOverwriteOpen]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handlePopState = (event: PopStateEvent) => {
      const uiState = useUIStore.getState();
      const gameState = useGameStore.getState();
      const targetHistState =
        typeof event.state === "object" && event.state !== null
          ? (event.state as Record<string, unknown>)
          : {};

      if (uiState.abandonModalOpen) {
        uiState.setAbandonModalOpen(false);
        try {
          window.history.pushState(
            {
              ...targetHistState,
              autonomoView: "game",
              autonomoSlot: "leaf",
              autonomoModal: null,
            },
            "",
          );
        } catch {
          // Ignore
        }
        return;
      }

      if (uiState.confirmOverwriteOpen) {
        handlingPopStateRef.current = true;
        uiState.setConfirmOverwriteOpen(false);
        return;
      }

      if (uiState.screenView === "game" && targetHistState.autonomoView !== "game") {
        handlingPopStateRef.current = true;
        gameState.returnToTitle();
        return;
      }

      if (uiState.screenView === "title" && targetHistState.autonomoView === "game") {
        if (gameState.activeRun !== null) {
          handlingPopStateRef.current = true;
          gameState.continueRun();
        } else if (gameState.profile.hall_of_fame.length > 0) {
          const latestArchived = gameState.profile.hall_of_fame[0];
          if (latestArchived) {
            handlingPopStateRef.current = true;
            gameState.openPastRunCertificate(latestArchived);
          }
        }
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

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
      ) : visibleState.ending !== null &&
        (isViewingArchivedCertificate || pendingOutcome === null) ? (
        <EndRunScreen state={visibleState} />
      ) : (
        <GameScreen state={visibleState} />
      )}
    </div>
  );
}

export default App;
