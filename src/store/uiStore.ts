import { create } from "zustand";

export type MobileWorkspaceTab = "despacho" | "cuentas" | "entorno" | "historial";
export type TitleSubTab = "hall_of_fame" | "achievements";
export type ScreenView = "title" | "game";

export const SFX_MUTED_STORAGE_KEY = "autonomo:sfx_muted";
export const FAST_PACING_STORAGE_KEY = "autonomo:fast_pacing";

function readStoredBoolean(key: string, fallback: boolean): boolean {
  try {
    if (typeof globalThis.localStorage === "undefined") {
      return fallback;
    }
    const raw = globalThis.localStorage.getItem(key);
    if (raw === "true") {
      return true;
    }
    if (raw === "false") {
      return false;
    }
    return fallback;
  } catch {
    return fallback;
  }
}

function writeStoredBoolean(key: string, value: boolean): void {
  try {
    if (typeof globalThis.localStorage === "undefined") {
      return;
    }
    globalThis.localStorage.setItem(key, value ? "true" : "false");
  } catch {
    // Ignore storage quota / private mode / Node SecurityError exceptions
  }
}

export interface ToastNotice {
  id: string;
  message: string;
  tone: "info" | "success" | "warning";
}

export interface UIStoreState {
  screenView: ScreenView;
  activeMobileTab: MobileWorkspaceTab;
  activeTitleTab: TitleSubTab;
  abandonModalOpen: boolean;
  reducedMotionOverride: boolean | null;
  sfxMuted: boolean;
  fastPacing: boolean;
  toast: ToastNotice | null;
  setScreenView: (view: ScreenView) => void;
  setActiveMobileTab: (tab: MobileWorkspaceTab) => void;
  setActiveTitleTab: (tab: TitleSubTab) => void;
  setAbandonModalOpen: (open: boolean) => void;
  setReducedMotionOverride: (value: boolean | null) => void;
  setSfxMuted: (muted: boolean) => void;
  toggleSfxMuted: () => void;
  setFastPacing: (fast: boolean) => void;
  toggleFastPacing: () => void;
  showToast: (message: string, tone?: ToastNotice["tone"]) => void;
  dismissToast: () => void;
  resetForRunEntry: () => void;
}

export const useUIStore = create<UIStoreState>((set) => ({
  screenView: "title",
  activeMobileTab: "despacho",
  activeTitleTab: "hall_of_fame",
  abandonModalOpen: false,
  reducedMotionOverride: null,
  sfxMuted: readStoredBoolean(SFX_MUTED_STORAGE_KEY, false),
  fastPacing: readStoredBoolean(FAST_PACING_STORAGE_KEY, false),
  toast: null,

  setScreenView: (screenView) => set({ screenView }),
  setActiveMobileTab: (activeMobileTab) => set({ activeMobileTab }),
  setActiveTitleTab: (activeTitleTab) => set({ activeTitleTab }),
  setAbandonModalOpen: (abandonModalOpen) => set({ abandonModalOpen }),
  setReducedMotionOverride: (reducedMotionOverride) => set({ reducedMotionOverride }),
  setSfxMuted: (sfxMuted) => {
    writeStoredBoolean(SFX_MUTED_STORAGE_KEY, sfxMuted);
    set({ sfxMuted });
  },
  toggleSfxMuted: () =>
    set((state) => {
      const next = !state.sfxMuted;
      writeStoredBoolean(SFX_MUTED_STORAGE_KEY, next);
      return { sfxMuted: next };
    }),
  setFastPacing: (fastPacing) => {
    writeStoredBoolean(FAST_PACING_STORAGE_KEY, fastPacing);
    set({ fastPacing });
  },
  toggleFastPacing: () =>
    set((state) => {
      const next = !state.fastPacing;
      writeStoredBoolean(FAST_PACING_STORAGE_KEY, next);
      return { fastPacing: next };
    }),
  showToast: (message, tone = "info") =>
    set({
      toast: {
        id: `toast_${Date.now()}`,
        message,
        tone,
      },
    }),
  dismissToast: () => set({ toast: null }),
  resetForRunEntry: () =>
    set({
      screenView: "game",
      activeMobileTab: "despacho",
      abandonModalOpen: false,
    }),
}));
