import type { EndingId, GameState } from "../../engine/index.ts";
import { type SupportedLocale, normalizeLocale } from "../i18n/resolveEventText.ts";

export type AnalyticsLocale = "es" | "en";
export type PlaytimeBucket = "<1m" | "1-3m" | "3-10m" | "10-20m" | "20m+";
export type RunMilestoneId = "year_1" | "year_3" | "year_5" | "year_10_hero" | "rich_150k";
export type ShareMethodAnalytics = "copy" | "download" | "native";
export type KofiPlacement = "landing" | "endrun" | "victory" | "annual";

export type AnalyticsProperties = Record<string, string | number | boolean>;
export type AnalyticsTransport = (name: string, properties: AnalyticsProperties) => void;

interface UmamiGlobal {
  track?: (eventName: string, data?: AnalyticsProperties) => void;
}

export const DEFAULT_UMAMI_SCRIPT_URL = "https://cloud.umami.is/script.js";
export const ALLOWED_ANALYTICS_HOSTS = new Set([
  "autonomo-simulator.com",
  "www.autonomo-simulator.com",
  "autonomo-simulator.vercel.app",
]);

const UMAMI_SCRIPT_ID = "autonomo-umami-script";
const MIN_PLAY_SESSION_SECONDS = 10;
const MAX_QUEUED_EVENTS = 20;

let customTransport: AnalyticsTransport | null = null;
let configOverride: { websiteId?: string; scriptUrl?: string } | null = null;
let clockNow: () => number = () => Date.now();
let scriptLoadFailed = false;
const queuedEvents: Array<{ name: string; properties: AnalyticsProperties }> = [];

interface PlayTrackerState {
  inGameplay: boolean;
  isDocumentVisible: boolean;
  activeStartedAtMs: number | null;
  sessionActiveSeconds: number;
  sessionTurns: number;
  sessionMaxMonth: number;
  locale: AnalyticsLocale;
  currentRunId: string | null;
  runActiveSeconds: number;
  recordedMilestonesByRun: Map<string, Set<RunMilestoneId>>;
  endedRunIds: Set<string>;
}

const tracker: PlayTrackerState = {
  inGameplay: false,
  isDocumentVisible: true,
  activeStartedAtMs: null,
  sessionActiveSeconds: 0,
  sessionTurns: 0,
  sessionMaxMonth: 0,
  locale: "es",
  currentRunId: null,
  runActiveSeconds: 0,
  recordedMilestonesByRun: new Map(),
  endedRunIds: new Set(),
};

function toAnalyticsLocale(locale?: SupportedLocale): AnalyticsLocale {
  return normalizeLocale(locale) === "en" ? "en" : "es";
}

export function resolveUmamiConfig(): { websiteId: string; scriptUrl: string } {
  const rawWebsiteId =
    configOverride?.websiteId !== undefined
      ? configOverride.websiteId
      : (import.meta.env?.VITE_UMAMI_WEBSITE_ID ?? "");
  const rawScriptUrl =
    configOverride?.scriptUrl !== undefined
      ? configOverride.scriptUrl
      : (import.meta.env?.VITE_UMAMI_SCRIPT_URL ?? "");

  const websiteId = typeof rawWebsiteId === "string" ? rawWebsiteId.trim() : "";
  const scriptUrl =
    typeof rawScriptUrl === "string" && rawScriptUrl.trim().length > 0
      ? rawScriptUrl.trim()
      : DEFAULT_UMAMI_SCRIPT_URL;

  return { websiteId, scriptUrl };
}

export function formatPlaytimeBucket(seconds: number): PlaytimeBucket {
  if (seconds < 60) {
    return "<1m";
  }
  if (seconds < 180) {
    return "1-3m";
  }
  if (seconds < 600) {
    return "3-10m";
  }
  if (seconds < 1200) {
    return "10-20m";
  }
  return "20m+";
}

export function isAnalyticsEnabled(env?: {
  protocol?: string;
  hostname?: string;
  webdriver?: boolean;
  websiteId?: string;
}): boolean {
  if (customTransport !== null) {
    return true;
  }

  const websiteId = (env?.websiteId ?? resolveUmamiConfig().websiteId).trim();
  if (!websiteId) {
    return false;
  }

  const protocol =
    env?.protocol ?? (typeof window !== "undefined" ? window.location?.protocol : "");
  const hostname =
    env?.hostname ?? (typeof window !== "undefined" ? window.location?.hostname : "");
  const webdriver =
    env?.webdriver ?? (typeof navigator !== "undefined" ? Boolean(navigator.webdriver) : false);

  if (webdriver) {
    return false;
  }
  if (protocol !== "https:") {
    return false;
  }
  return Boolean(hostname && ALLOWED_ANALYTICS_HOSTS.has(hostname.toLowerCase()));
}

function getUmamiGlobal(): UmamiGlobal | null {
  if (typeof window === "undefined") {
    return null;
  }
  const maybe = (window as unknown as { umami?: UmamiGlobal }).umami;
  return maybe && typeof maybe.track === "function" ? maybe : null;
}

function flushQueuedEvents(): void {
  const umami = getUmamiGlobal();
  if (!umami?.track || queuedEvents.length === 0) {
    return;
  }
  while (queuedEvents.length > 0) {
    const item = queuedEvents.shift();
    if (!item) {
      continue;
    }
    try {
      umami.track(item.name, item.properties);
    } catch {
      // Ignore tracker runtime errors
    }
  }
}

/**
 * Lazily injects the cookieless Umami tracking script (~2 KB) in production when
 * `VITE_UMAMI_WEBSITE_ID` is configured. Safely no-ops on localhost, itch.io, and headless bots.
 */
export function initUmamiAnalytics(): boolean {
  if (typeof document === "undefined") {
    return false;
  }
  const { websiteId, scriptUrl } = resolveUmamiConfig();
  if (!websiteId || !isAnalyticsEnabled({ websiteId })) {
    return false;
  }
  if (document.getElementById(UMAMI_SCRIPT_ID)) {
    flushQueuedEvents();
    return true;
  }

  const script = document.createElement("script");
  script.id = UMAMI_SCRIPT_ID;
  script.defer = true;
  script.src = scriptUrl;
  script.setAttribute("data-website-id", websiteId);
  script.setAttribute("data-domains", "autonomo-simulator.com,www.autonomo-simulator.com");
  script.setAttribute("data-do-not-track", "true");
  script.onload = () => {
    scriptLoadFailed = false;
    flushQueuedEvents();
  };
  script.onerror = () => {
    scriptLoadFailed = true;
    queuedEvents.length = 0;
  };
  document.head.appendChild(script);
  return true;
}

function sendEvent(name: string, properties: AnalyticsProperties): void {
  if (!isAnalyticsEnabled()) {
    return;
  }
  try {
    if (customTransport) {
      customTransport(name, properties);
      return;
    }
    const umami = getUmamiGlobal();
    if (umami?.track) {
      umami.track(name, properties);
      return;
    }
    if (!scriptLoadFailed && queuedEvents.length < MAX_QUEUED_EVENTS) {
      queuedEvents.push({ name, properties });
    }
  } catch {
    // Analytics must never interrupt gameplay or throw console errors
  }
}

function accumulateElapsedTime(): void {
  if (tracker.activeStartedAtMs === null) {
    return;
  }
  const now = clockNow();
  const deltaSec = Math.max(0, (now - tracker.activeStartedAtMs) / 1000);
  // Guard against clock jumps / laptop sleep spikes (> 5 min single jump)
  const clampedDeltaSec = Math.min(deltaSec, 300);
  tracker.sessionActiveSeconds += clampedDeltaSec;
  if (tracker.currentRunId !== null) {
    tracker.runActiveSeconds += clampedDeltaSec;
  }
  tracker.activeStartedAtMs = now;
}

function syncActiveClock(): void {
  const shouldTick = tracker.inGameplay && tracker.isDocumentVisible;
  if (shouldTick) {
    if (tracker.activeStartedAtMs === null) {
      tracker.activeStartedAtMs = clockNow();
    }
  } else if (tracker.activeStartedAtMs !== null) {
    accumulateElapsedTime();
    tracker.activeStartedAtMs = null;
  }
}

export function setGameplayActiveContext(options: {
  inGameplay: boolean;
  runId?: string | null;
  month?: number;
  locale?: SupportedLocale;
}): void {
  accumulateElapsedTime();
  tracker.inGameplay = options.inGameplay;
  if (options.locale !== undefined) {
    tracker.locale = toAnalyticsLocale(options.locale);
  }
  if (options.runId !== undefined && options.runId !== tracker.currentRunId) {
    tracker.currentRunId = options.runId;
    tracker.runActiveSeconds = 0;
  }
  if (options.month !== undefined && options.month > tracker.sessionMaxMonth) {
    tracker.sessionMaxMonth = options.month;
  }
  syncActiveClock();
}

export function setDocumentVisibilityState(isVisible: boolean): void {
  if (!isVisible) {
    accumulateElapsedTime();
    tracker.isDocumentVisible = false;
    tracker.activeStartedAtMs = null;
    flushPlaySession();
    return;
  }
  tracker.isDocumentVisible = true;
  syncActiveClock();
}

export function flushPlaySession(): void {
  accumulateElapsedTime();
  if (tracker.sessionActiveSeconds < MIN_PLAY_SESSION_SECONDS) {
    return;
  }

  const seconds = Math.round(tracker.sessionActiveSeconds);
  sendEvent("play_session", {
    play_bucket: formatPlaytimeBucket(seconds),
    play_minutes: Math.max(0, Math.round(seconds / 60)),
    max_month: tracker.sessionMaxMonth,
    turns: tracker.sessionTurns,
    locale: tracker.locale,
  });

  // Reset stretch counters so returning to the tab does not double-count previous seconds
  tracker.sessionActiveSeconds = 0;
  tracker.sessionTurns = 0;
}

export function attachPlaySessionLifecycleListeners(): () => void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return () => {};
  }

  tracker.isDocumentVisible = document.visibilityState !== "hidden";
  syncActiveClock();

  const onVisibilityChange = () => {
    setDocumentVisibilityState(document.visibilityState !== "hidden");
  };
  const onPageHide = () => {
    setDocumentVisibilityState(false);
  };

  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("pagehide", onPageHide);

  return () => {
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("pagehide", onPageHide);
  };
}

export function trackDashboardEntered(options: {
  locale?: SupportedLocale;
  hasActiveRun: boolean;
}): void {
  sendEvent("dashboard_entered", {
    locale: toAnalyticsLocale(options.locale),
    has_active_run: options.hasActiveRun,
  });
}

export function trackRunStarted(options: {
  runId: string;
  locale?: SupportedLocale;
  customSeed: boolean;
  fastPacing: boolean;
}): void {
  tracker.currentRunId = options.runId;
  tracker.runActiveSeconds = 0;
  tracker.locale = toAnalyticsLocale(options.locale);
  tracker.sessionMaxMonth = Math.max(tracker.sessionMaxMonth, 1);
  if (!tracker.recordedMilestonesByRun.has(options.runId)) {
    tracker.recordedMilestonesByRun.set(options.runId, new Set());
  }

  sendEvent("run_started", {
    locale: tracker.locale,
    custom_seed: options.customSeed,
    fast_pacing: options.fastPacing,
  });
}

export function recordGameplayTurn(month: number, locale?: SupportedLocale): void {
  accumulateElapsedTime();
  tracker.sessionTurns += 1;
  if (month > tracker.sessionMaxMonth) {
    tracker.sessionMaxMonth = month;
  }
  if (locale !== undefined) {
    tracker.locale = toAnalyticsLocale(locale);
  }
}

export function seedRunProgressSnapshot(state: GameState | null): void {
  if (!state) {
    return;
  }
  tracker.currentRunId = state.run_id;
  tracker.runActiveSeconds = 0;

  let seenMilestones = tracker.recordedMilestonesByRun.get(state.run_id);
  if (!seenMilestones) {
    seenMilestones = new Set<RunMilestoneId>();
    tracker.recordedMilestonesByRun.set(state.run_id, seenMilestones);
  }
  if (state.month >= 12) seenMilestones.add("year_1");
  if (state.month >= 36) seenMilestones.add("year_3");
  if (state.month >= 60) seenMilestones.add("year_5");
  if (state.earned_victories.includes("hero_120m")) seenMilestones.add("year_10_hero");
  if (state.earned_victories.includes("rich_150k")) seenMilestones.add("rich_150k");
  if (state.ending !== null) {
    tracker.endedRunIds.add(state.run_id);
  }
}

export function trackRunProgress(state: GameState, locale?: SupportedLocale): void {
  accumulateElapsedTime();
  const normalizedLocale = toAnalyticsLocale(locale);
  tracker.locale = normalizedLocale;
  if (state.month > tracker.sessionMaxMonth) {
    tracker.sessionMaxMonth = state.month;
  }

  if (tracker.currentRunId !== state.run_id) {
    tracker.currentRunId = state.run_id;
    tracker.runActiveSeconds = 0;
  }

  let seenMilestones = tracker.recordedMilestonesByRun.get(state.run_id);
  if (!seenMilestones) {
    seenMilestones = new Set<RunMilestoneId>();
    tracker.recordedMilestonesByRun.set(state.run_id, seenMilestones);
  }

  const runSeconds = Math.round(tracker.runActiveSeconds);
  const milestoneChecks: Array<[RunMilestoneId, boolean]> = [
    ["year_1", state.month >= 12],
    ["year_3", state.month >= 36],
    ["year_5", state.month >= 60],
    ["year_10_hero", state.earned_victories.includes("hero_120m")],
    ["rich_150k", state.earned_victories.includes("rich_150k")],
  ];

  for (const [milestoneId, achieved] of milestoneChecks) {
    if (achieved && !seenMilestones.has(milestoneId)) {
      seenMilestones.add(milestoneId);
      sendEvent("run_milestone", {
        milestone: milestoneId,
        month: state.month,
        play_bucket: formatPlaytimeBucket(runSeconds),
        locale: normalizedLocale,
      });
    }
  }

  if (state.ending !== null && !tracker.endedRunIds.has(state.run_id)) {
    tracker.endedRunIds.add(state.run_id);
    sendEvent("run_ended", {
      ending_id: state.ending.id,
      months_survived: state.ending.month,
      play_bucket: formatPlaytimeBucket(runSeconds),
      play_minutes: Math.max(0, Math.round(runSeconds / 60)),
      endless: state.endless_mode,
      locale: normalizedLocale,
    });
  }
}

export function trackResultShared(options: {
  method: ShareMethodAnalytics;
  endingId: EndingId;
  locale?: SupportedLocale;
}): void {
  sendEvent("result_shared", {
    method: options.method,
    ending_id: options.endingId,
    locale: toAnalyticsLocale(options.locale),
  });
}

export function trackKofiClicked(options: {
  context: KofiPlacement;
  locale?: SupportedLocale;
}): void {
  sendEvent("kofi_clicked", {
    context: options.context,
    locale: toAnalyticsLocale(options.locale),
  });
}

export function setAnalyticsTestHooks(options: {
  transport?: AnalyticsTransport | null;
  config?: { websiteId?: string; scriptUrl?: string } | null;
  now?: (() => number) | null;
  resetState?: boolean;
}): void {
  if (options.transport !== undefined) {
    customTransport = options.transport;
  }
  if (options.config !== undefined) {
    configOverride = options.config;
  }
  if (options.now !== undefined) {
    clockNow = options.now ?? (() => Date.now());
  }
  if (options.resetState) {
    scriptLoadFailed = false;
    queuedEvents.length = 0;
    tracker.inGameplay = false;
    tracker.isDocumentVisible = true;
    tracker.activeStartedAtMs = null;
    tracker.sessionActiveSeconds = 0;
    tracker.sessionTurns = 0;
    tracker.sessionMaxMonth = 0;
    tracker.locale = "es";
    tracker.currentRunId = null;
    tracker.runActiveSeconds = 0;
    tracker.recordedMilestonesByRun.clear();
    tracker.endedRunIds.clear();
  }
}
