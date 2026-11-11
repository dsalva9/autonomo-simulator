export type RuntimePlatform = "web" | "capacitor" | "tauri";

export interface PlatformCapabilities {
  platform: RuntimePlatform;
  canNativeShare: boolean;
  canNativeShareFiles: boolean;
  canClipboardWrite: boolean;
  prefersReducedMotion: boolean;
}

export interface PlatformPort {
  detectPlatform(): RuntimePlatform;
  getCapabilities(): PlatformCapabilities;
  requestPersistentStorage(): Promise<boolean>;
}

interface GlobalWindowWithBridges {
  Capacitor?: { isNativePlatform?: () => boolean };
  __TAURI_INTERNALS__?: unknown;
  __TAURI__?: unknown;
}

export function detectRuntimePlatform(): RuntimePlatform {
  if (typeof window === "undefined") {
    return "web";
  }
  const bridged = window as unknown as GlobalWindowWithBridges;
  if (bridged.__TAURI_INTERNALS__ !== undefined || bridged.__TAURI__ !== undefined) {
    return "tauri";
  }
  if (typeof bridged.Capacitor?.isNativePlatform === "function") {
    if (bridged.Capacitor.isNativePlatform()) {
      return "capacitor";
    }
  }
  return "web";
}

export function createWebPlatformAdapter(): PlatformPort {
  return {
    detectPlatform: detectRuntimePlatform,
    getCapabilities(): PlatformCapabilities {
      const platform = detectRuntimePlatform();
      const hasNavigator = typeof navigator !== "undefined";
      const canNativeShare = hasNavigator && typeof navigator.share === "function";
      let canNativeShareFiles = false;

      if (
        canNativeShare &&
        typeof navigator.canShare === "function" &&
        typeof File === "function"
      ) {
        try {
          const probeFile = new File(["probe"], "probe.png", { type: "image/png" });
          canNativeShareFiles = navigator.canShare({ files: [probeFile] });
        } catch {
          canNativeShareFiles = false;
        }
      }

      const canClipboardWrite =
        hasNavigator &&
        typeof navigator.clipboard !== "undefined" &&
        typeof navigator.clipboard.writeText === "function";

      const prefersReducedMotion =
        typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      return {
        platform,
        canNativeShare,
        canNativeShareFiles,
        canClipboardWrite,
        prefersReducedMotion,
      };
    },
    async requestPersistentStorage(): Promise<boolean> {
      if (
        typeof navigator === "undefined" ||
        !navigator.storage ||
        typeof navigator.storage.persist !== "function"
      ) {
        return false;
      }
      try {
        return await navigator.storage.persist();
      } catch {
        return false;
      }
    },
  };
}

export const defaultPlatformAdapter: PlatformPort = createWebPlatformAdapter();
