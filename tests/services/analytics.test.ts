import { afterEach, describe, expect, it } from "vitest";
import { type GameState, startNewRun } from "../../src/engine/index.ts";
import {
  type AnalyticsProperties,
  DEFAULT_UMAMI_SCRIPT_URL,
  flushPlaySession,
  formatPlaytimeBucket,
  initUmamiAnalytics,
  isAnalyticsEnabled,
  recordGameplayTurn,
  seedRunProgressSnapshot,
  setAnalyticsTestHooks,
  setDocumentVisibilityState,
  setGameplayActiveContext,
  trackDashboardEntered,
  trackKofiClicked,
  trackResultShared,
  trackRunProgress,
  trackRunStarted,
} from "../../src/services/analytics/umamiAnalytics.ts";
import { compiledCatalog } from "../../src/services/content/catalog.ts";

describe("Cookieless Umami Analytics & Foreground Playtime Tracker (umamiAnalytics.ts)", () => {
  afterEach(() => {
    setAnalyticsTestHooks({ transport: null, config: null, now: null, resetState: true });
  });

  it("gates analytics strictly to https production hosts, non-webdriver browsers, and configured website IDs", () => {
    setAnalyticsTestHooks({ transport: null, config: { websiteId: "" }, resetState: true });
    expect(
      isAnalyticsEnabled({
        protocol: "https:",
        hostname: "autonomo-simulator.com",
        webdriver: false,
      }),
    ).toBe(false);

    expect(
      isAnalyticsEnabled({
        protocol: "https:",
        hostname: "autonomo-simulator.com",
        webdriver: false,
        websiteId: "site-uuid-123",
      }),
    ).toBe(true);

    expect(
      isAnalyticsEnabled({
        protocol: "https:",
        hostname: "www.autonomo-simulator.com",
        webdriver: false,
        websiteId: "site-uuid-123",
      }),
    ).toBe(true);

    // Block automated browsers (Playwright), localhost, http, and itch.io embeds
    expect(
      isAnalyticsEnabled({
        protocol: "https:",
        hostname: "autonomo-simulator.com",
        webdriver: true,
        websiteId: "site-uuid-123",
      }),
    ).toBe(false);
    expect(
      isAnalyticsEnabled({
        protocol: "http:",
        hostname: "localhost",
        webdriver: false,
        websiteId: "site-uuid-123",
      }),
    ).toBe(false);
    expect(
      isAnalyticsEnabled({
        protocol: "https:",
        hostname: "html-classic.itch.zone",
        webdriver: false,
        websiteId: "site-uuid-123",
      }),
    ).toBe(false);
  });

  it("formats active playtime into clean Umami-friendly buckets", () => {
    expect(formatPlaytimeBucket(0)).toBe("<1m");
    expect(formatPlaytimeBucket(59)).toBe("<1m");
    expect(formatPlaytimeBucket(60)).toBe("1-3m");
    expect(formatPlaytimeBucket(179)).toBe("1-3m");
    expect(formatPlaytimeBucket(180)).toBe("3-10m");
    expect(formatPlaytimeBucket(599)).toBe("3-10m");
    expect(formatPlaytimeBucket(600)).toBe("10-20m");
    expect(formatPlaytimeBucket(1199)).toBe("10-20m");
    expect(formatPlaytimeBucket(1200)).toBe("20m+");
  });

  it("tracks foreground playtime accurately across visibility pauses, resets after flush, and ignores <10s bounces", () => {
    const sent: Array<{ name: string; properties: AnalyticsProperties }> = [];
    let fakeNow = 1_000_000;
    setAnalyticsTestHooks({
      transport: (name, properties) => sent.push({ name, properties }),
      now: () => fakeNow,
      resetState: true,
    });

    // Short 5s bounce should NOT emit play_session
    setGameplayActiveContext({ inGameplay: true, runId: "run_1", month: 1, locale: "es-ES" });
    fakeNow += 5_000;
    flushPlaySession();
    expect(sent).toHaveLength(0);

    // Play 45s actively, take 3 turns, hide tab for 10 minutes (background time must NOT count), then resume for 90s
    fakeNow += 45_000; // total active = 50s
    recordGameplayTurn(2, "es-ES");
    recordGameplayTurn(3, "es-ES");
    recordGameplayTurn(4, "es-ES");

    // Hiding tab flushes the first 50s stretch and pauses the clock
    setDocumentVisibilityState(false);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toEqual({
      name: "play_session",
      properties: {
        play_bucket: "<1m",
        play_minutes: 1,
        max_month: 4,
        turns: 3,
        locale: "es",
      },
    });

    // Tab stays hidden for 10 minutes — must NOT accumulate playtime or double-fire
    fakeNow += 600_000;
    flushPlaySession();
    expect(sent).toHaveLength(1);

    // Return to tab and play 3.5 minutes (210s)
    setDocumentVisibilityState(true);
    fakeNow += 210_000;
    recordGameplayTurn(12, "en");
    flushPlaySession();
    expect(sent).toHaveLength(2);
    expect(sent[1]).toEqual({
      name: "play_session",
      properties: {
        play_bucket: "3-10m",
        play_minutes: 4,
        max_month: 12,
        turns: 1,
        locale: "en",
      },
    });
  });

  it("deduplicates run milestones and endings per run_id, respects hydrated snapshots, and sends zero PII", () => {
    const sent: Array<{ name: string; properties: AnalyticsProperties }> = [];
    let fakeNow = 2_000_000;
    setAnalyticsTestHooks({
      transport: (name, properties) => sent.push({ name, properties }),
      now: () => fakeNow,
      resetState: true,
    });

    const { state } = startNewRun(compiledCatalog, { seed: "FC-SHUR-2026", runId: "run_a" });

    trackDashboardEntered({ locale: "es-ES", hasActiveRun: false });
    trackRunStarted({ runId: state.run_id, locale: "es-ES", customSeed: true, fastPacing: false });
    setGameplayActiveContext({ inGameplay: true, runId: state.run_id, month: 1, locale: "es-ES" });

    // Advance 4 minutes -> reach Month 12 (year_1)
    fakeNow += 240_000;
    const m12State: GameState = { ...state, month: 12 };
    trackRunProgress(m12State, "es-ES");
    trackRunProgress(m12State, "es-ES"); // duplicate sync must not re-fire year_1

    // Reach Month 120 Hero + 150k + ended
    fakeNow += 180_000;
    const endedState: GameState = {
      ...state,
      month: 120,
      endless_mode: false,
      earned_victories: ["hero_120m", "rich_150k"],
      ending: { id: "retired_rich", month: 120, summary_quote: "Ricachón" },
    };
    trackRunProgress(endedState, "es-ES");
    trackRunProgress(endedState, "es-ES"); // duplicate sync must not re-fire run_ended

    trackResultShared({ method: "download", endingId: "retired_rich", locale: "es-ES" });
    trackKofiClicked({ context: "victory", locale: "es-ES" });

    const names = sent.map((e) => e.name);
    expect(names).toEqual([
      "dashboard_entered",
      "run_started",
      "run_milestone", // year_1
      "run_milestone", // year_3
      "run_milestone", // year_5
      "run_milestone", // year_10_hero
      "run_milestone", // rich_150k
      "run_ended",
      "result_shared",
      "kofi_clicked",
    ]);

    // Verify raw seed string is never leaked as PII in run_started
    const runStarted = sent.find((e) => e.name === "run_started");
    expect(runStarted?.properties).toEqual({
      locale: "es",
      custom_seed: true,
      fast_pacing: false,
    });
    expect(JSON.stringify(sent)).not.toContain("FC-SHUR-2026");

    const runEnded = sent.find((e) => e.name === "run_ended");
    expect(runEnded?.properties).toEqual({
      ending_id: "retired_rich",
      months_survived: 120,
      play_bucket: "3-10m",
      play_minutes: 7,
      endless: false,
      locale: "es",
    });

    // Hydrated mid-run save at Month 40 should NOT re-fire year_1 or year_3 when playing Month 41
    const resumedRun: GameState = { ...state, run_id: "run_resumed", month: 40 };
    seedRunProgressSnapshot(resumedRun);
    const countBeforeResume = sent.length;
    trackRunProgress({ ...resumedRun, month: 41 }, "en");
    expect(sent).toHaveLength(countBeforeResume);
  });

  it("lazily injects the Umami defer script once and flushes pre-load queued events on onload", () => {
    const appended: Array<{
      id: string;
      defer: boolean;
      src: string;
      attrs: Record<string, string>;
      onload: (() => void) | null;
      onerror: (() => void) | null;
    }> = [];
    const trackedViaWindow: Array<{ name: string; properties?: AnalyticsProperties }> = [];

    const origWindow = globalThis.window;
    const origDocument = globalThis.document;
    const origNavigator = globalThis.navigator;

    try {
      setAnalyticsTestHooks({
        transport: null,
        config: { websiteId: "umami-uuid-001" },
        resetState: true,
      });

      const fakeWindow = {
        location: { protocol: "https:", hostname: "autonomo-simulator.com" },
        umami: undefined as
          | { track: (name: string, props?: AnalyticsProperties) => void }
          | undefined,
      };
      const fakeDoc = {
        getElementById: (id: string) => appended.find((s) => s.id === id) ?? null,
        createElement: () => {
          const el = {
            id: "",
            defer: false,
            src: "",
            attrs: {} as Record<string, string>,
            onload: null as (() => void) | null,
            onerror: null as (() => void) | null,
            setAttribute(k: string, v: string) {
              this.attrs[k] = v;
            },
          };
          return el;
        },
        head: {
          appendChild: (el: (typeof appended)[number]) => appended.push(el),
        },
      };

      Object.defineProperty(globalThis, "window", { configurable: true, value: fakeWindow });
      Object.defineProperty(globalThis, "document", { configurable: true, value: fakeDoc });
      Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        value: { webdriver: false },
      });

      expect(initUmamiAnalytics()).toBe(true);
      expect(initUmamiAnalytics()).toBe(true); // idempotent: never inserts duplicate script
      expect(appended).toHaveLength(1);
      expect(appended[0]!.src).toBe(DEFAULT_UMAMI_SCRIPT_URL);
      expect(appended[0]!.defer).toBe(true);
      expect(appended[0]!.attrs["data-website-id"]).toBe("umami-uuid-001");
      expect(appended[0]!.attrs["data-do-not-track"]).toBe("true");

      // Fire event before script finishes loading -> queued cleanly
      trackKofiClicked({ context: "landing", locale: "es-ES" });
      expect(trackedViaWindow).toHaveLength(0);

      // Script finishes loading -> window.umami attaches and queued event flushes automatically
      fakeWindow.umami = {
        track: (name, properties) => trackedViaWindow.push({ name, properties }),
      };
      appended[0]!.onload?.();
      expect(trackedViaWindow).toEqual([
        { name: "kofi_clicked", properties: { context: "landing", locale: "es" } },
      ]);
    } finally {
      Object.defineProperty(globalThis, "window", { configurable: true, value: origWindow });
      Object.defineProperty(globalThis, "document", { configurable: true, value: origDocument });
      Object.defineProperty(globalThis, "navigator", { configurable: true, value: origNavigator });
    }
  });
});
