import { useEffect, useRef } from "react";
import { AchievementToast } from "./components/hud/AchievementToast.tsx";
import { EndRunScreen } from "./screens/EndRunScreen.tsx";
import { GameScreen } from "./screens/GameScreen.tsx";
import { LandingScreen } from "./screens/LandingScreen.tsx";
import { TitleScreen } from "./screens/TitleScreen.tsx";
import { normalizeLocale } from "./services/i18n/resolveEventText.ts";
import { getUiStrings } from "./services/i18n/uiStrings.ts";
import {
  type SeoPageView,
  parseUrlInitialViewParam,
  parseUrlLocaleParam,
  syncDocumentSeo,
} from "./services/seo/documentSeo.ts";
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
  const setLocalePreference = useGameStore((s) => s.setLocalePreference);

  const screenView = useUIStore((s) => s.screenView);
  const setScreenView = useUIStore((s) => s.setScreenView);
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
  const inLandingView = hydrated && screenView === "landing";
  const inDashboardView = hydrated && !inLandingView && !inGameView;
  const isEndRunView =
    inGameView &&
    visibleState.ending !== null &&
    (isViewingArchivedCertificate || pendingOutcome === null);
  const seoView: SeoPageView = inLandingView
    ? "landing"
    : !inGameView
      ? "title"
      : isEndRunView
        ? "end_run"
        : "game";
  const handlingPopStateRef = useRef(false);
  const appliedUrlParamsRef = useRef(false);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated || appliedUrlParamsRef.current || typeof window === "undefined") {
      return;
    }
    appliedUrlParamsRef.current = true;
    const requestedLocale = parseUrlLocaleParam(window.location.search);
    if (requestedLocale && normalizeLocale(locale) !== normalizeLocale(requestedLocale)) {
      void setLocalePreference(requestedLocale);
    }
    const requestedView = parseUrlInitialViewParam(window.location.search);
    if (requestedView && requestedView !== useUIStore.getState().screenView) {
      setScreenView(requestedView);
    }
  }, [hydrated, locale, setLocalePreference, setScreenView]);

  useEffect(() => {
    syncDocumentSeo({
      view: seoView,
      locale: normalizedLocale,
      state: visibleState,
    });
  }, [seoView, normalizedLocale, visibleState]);

  const prevSeoViewRef = useRef<SeoPageView>(seoView);
  useEffect(() => {
    if (prevSeoViewRef.current !== seoView) {
      prevSeoViewRef.current = seoView;
      if (typeof window !== "undefined" && window.scrollY > 0) {
        window.scrollTo({ top: 0, behavior: "auto" });
      }
    }
  }, [seoView]);

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

      const activeView = inGameView ? "game" : inDashboardView ? "title" : "landing";
      const activeModal = inDashboardView && confirmOverwriteOpen ? "confirm-overwrite" : null;
      const activeSlot =
        activeView === "game" || activeModal !== null
          ? "leaf"
          : activeView === "title"
            ? "dashboard"
            : "root";

      const curSlot = currentHistState.autonomoSlot;
      const curView = currentHistState.autonomoView;
      const curModal = currentHistState.autonomoModal ?? null;

      if (curSlot !== "root" && curSlot !== "dashboard" && curSlot !== "leaf") {
        window.history.replaceState(
          {
            ...currentHistState,
            autonomoView: "landing",
            autonomoSlot: "root",
            autonomoModal: null,
          },
          "",
        );
        if (activeView === "title") {
          window.history.pushState(
            {
              autonomoView: "title",
              autonomoSlot: activeModal ? "leaf" : "dashboard",
              autonomoModal: activeModal,
            },
            "",
          );
        } else if (activeView === "game") {
          window.history.pushState(
            {
              autonomoView: "game",
              autonomoSlot: "leaf",
              autonomoModal: null,
            },
            "",
          );
        }
        return;
      }

      if (curView === activeView && curModal === activeModal) {
        return;
      }

      const nextHistState = {
        ...currentHistState,
        autonomoView: activeView,
        autonomoSlot: activeSlot,
        autonomoModal: activeModal,
      };

      const rank = (slot: unknown) => (slot === "leaf" ? 2 : slot === "dashboard" ? 1 : 0);
      if (rank(activeSlot) > rank(curSlot)) {
        window.history.pushState(nextHistState, "");
      } else {
        window.history.replaceState(nextHistState, "");
      }
    } catch {
      // Ignore history API restrictions in restricted frames/environments
    }
  }, [hydrated, inGameView, inDashboardView, confirmOverwriteOpen]);

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
        if (targetHistState.autonomoView === "landing") {
          uiState.setScreenView("landing");
        }
        return;
      }

      if (uiState.screenView === "title" && targetHistState.autonomoView === "landing") {
        handlingPopStateRef.current = true;
        uiState.setScreenView("landing");
        return;
      }

      if (uiState.screenView === "landing" && targetHistState.autonomoView === "title") {
        handlingPopStateRef.current = true;
        uiState.setScreenView("title");
        return;
      }

      if (
        (uiState.screenView === "title" || uiState.screenView === "landing") &&
        targetHistState.autonomoView === "game"
      ) {
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
      ) : screenView === "landing" ? (
        <LandingScreen />
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
