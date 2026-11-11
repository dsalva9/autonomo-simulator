export interface RegisterServiceWorkerOptions {
  swUrl?: string;
  scope?: string;
  /**
   * When true, registers immediately rather than waiting for window `load`.
   * Useful in unit tests or post-hydration triggers.
   */
  immediate?: boolean;
  /**
   * Explicit override for environment gating (defaults to production-only).
   */
  enabled?: boolean;
}

function isLocalhostHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]"
  );
}

function isServiceWorkerSupportedContext(enabledOverride?: boolean): boolean {
  if (enabledOverride === false) {
    return false;
  }

  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }

  if (!("serviceWorker" in navigator) || typeof navigator.serviceWorker?.register !== "function") {
    return false;
  }

  const { protocol, hostname } = window.location ?? {};
  const isSecureOrLocal =
    protocol === "https:" ||
    (protocol === "http:" && Boolean(hostname && isLocalhostHost(hostname)));
  if (!isSecureOrLocal) {
    return false;
  }

  if (enabledOverride === true) {
    return true;
  }

  // Skip during Vite HMR dev server & Vitest runs where dist/sw.js precache manifest is not built
  const metaEnv = (import.meta as ImportMeta & { env?: { DEV?: boolean; MODE?: string } }).env;
  if (metaEnv?.DEV || metaEnv?.MODE === "test") {
    return false;
  }

  return true;
}

/**
 * Registers the offline Service Worker (`./sw.js`) in production builds.
 * Gracefully returns `null` without console errors in dev, SSR/Vitest, or unsupported contexts.
 */
export async function registerServiceWorker(
  options: RegisterServiceWorkerOptions = {},
): Promise<ServiceWorkerRegistration | null> {
  if (!isServiceWorkerSupportedContext(options.enabled)) {
    return null;
  }

  const swUrl = options.swUrl ?? "./sw.js";
  const scope = options.scope ?? "./";

  const performRegister = async (): Promise<ServiceWorkerRegistration | null> => {
    try {
      return await navigator.serviceWorker.register(swUrl, { scope });
    } catch {
      return null;
    }
  };

  if (options.immediate || typeof document === "undefined" || document.readyState === "complete") {
    return performRegister();
  }

  return new Promise((resolve) => {
    window.addEventListener(
      "load",
      () => {
        void performRegister().then(resolve);
      },
      { once: true },
    );
  });
}
