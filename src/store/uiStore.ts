import { create } from "zustand";

export type MobileWorkspaceTab = "despacho" | "cuentas" | "entorno" | "historial";
export type TitleSubTab = "hall_of_fame" | "achievements";
export type ScreenView = "title" | "game";

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
  toast: ToastNotice | null;
  setScreenView: (view: ScreenView) => void;
  setActiveMobileTab: (tab: MobileWorkspaceTab) => void;
  setActiveTitleTab: (tab: TitleSubTab) => void;
  setAbandonModalOpen: (open: boolean) => void;
  setReducedMotionOverride: (value: boolean | null) => void;
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
  toast: null,

  setScreenView: (screenView) => set({ screenView }),
  setActiveMobileTab: (activeMobileTab) => set({ activeMobileTab }),
  setActiveTitleTab: (activeTitleTab) => set({ activeTitleTab }),
  setAbandonModalOpen: (abandonModalOpen) => set({ abandonModalOpen }),
  setReducedMotionOverride: (reducedMotionOverride) => set({ reducedMotionOverride }),
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
