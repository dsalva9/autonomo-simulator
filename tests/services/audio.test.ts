import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SFX_MUTED_STORAGE_KEY,
  UI_SOUND_KINDS,
  playUiSound,
  resetSharedAudioContextForTests,
} from "../../src/services/audio/soundEffects.ts";
import { registerServiceWorker } from "../../src/services/pwa/registerServiceWorker.ts";

interface MockAudioStats {
  oscillatorsStarted: number;
  buffersStarted: number;
  filtersCreated: number;
  resumedCount: number;
  frequencies: number[];
}

function createMockAudioContext(state: AudioContextState = "running"): {
  ctx: BaseAudioContext;
  stats: MockAudioStats;
} {
  const stats: MockAudioStats = {
    oscillatorsStarted: 0,
    buffersStarted: 0,
    filtersCreated: 0,
    resumedCount: 0,
    frequencies: [],
  };

  const makeParam = () => ({
    setValueAtTime: vi.fn((val: number) => {
      if (val >= 40) {
        stats.frequencies.push(val);
      }
    }),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  });

  const ctx = {
    state,
    currentTime: 1.25,
    sampleRate: 44100,
    destination: {},
    resume: vi.fn(async () => {
      stats.resumedCount += 1;
    }),
    close: vi.fn(async () => {}),
    createGain: vi.fn(() => ({
      gain: makeParam(),
      connect: vi.fn(),
    })),
    createOscillator: vi.fn(() => ({
      type: "sine",
      frequency: makeParam(),
      connect: vi.fn(),
      start: vi.fn(() => {
        stats.oscillatorsStarted += 1;
      }),
      stop: vi.fn(),
    })),
    createBuffer: vi.fn((_channels: number, length: number) => ({
      getChannelData: () => new Float32Array(length),
    })),
    createBufferSource: vi.fn(() => ({
      buffer: null,
      connect: vi.fn(),
      start: vi.fn(() => {
        stats.buffersStarted += 1;
      }),
      stop: vi.fn(),
    })),
    createBiquadFilter: vi.fn(() => {
      stats.filtersCreated += 1;
      return {
        type: "bandpass",
        frequency: makeParam(),
        Q: makeParam(),
        connect: vi.fn(),
      };
    }),
  } as unknown as BaseAudioContext;

  return { ctx, stats };
}

describe("Procedural Web Audio Micro-SFX & PWA Service Worker Registration", () => {
  afterEach(() => {
    resetSharedAudioContextForTests();
    vi.restoreAllMocks();
  });

  it("synthesizes every UiSoundKind via AudioContext without external audio assets", () => {
    expect(UI_SOUND_KINDS).toEqual([
      "paper_choice",
      "stamp_thud",
      "coin_gain",
      "cash_loss",
      "trimestre_bell",
      "achievement_seal",
    ]);

    for (const kind of UI_SOUND_KINDS) {
      const { ctx, stats } = createMockAudioContext("suspended");
      const played = playUiSound(kind, { muted: false, audioContext: ctx });

      expect(played).toBe(true);
      expect(stats.resumedCount).toBe(1);
      expect(stats.oscillatorsStarted).toBeGreaterThanOrEqual(1);

      if (kind === "paper_choice") {
        expect(stats.buffersStarted).toBe(1);
        expect(stats.filtersCreated).toBe(1);
      }
      if (kind === "achievement_seal") {
        expect(stats.oscillatorsStarted).toBe(4);
      }
    }
  });

  it("acts as a safe silent no-op when muted, in SSR/headless environments, or when AudioContext throws", () => {
    const { ctx, stats } = createMockAudioContext();
    expect(playUiSound("stamp_thud", { muted: true, audioContext: ctx })).toBe(false);
    expect(stats.oscillatorsStarted).toBe(0);

    // Headless environment with null AudioContext
    expect(playUiSound("coin_gain", { muted: false, audioContext: null })).toBe(false);

    // Respects persisted localStorage mute flag unless explicitly overridden
    const originalStorage = globalThis.localStorage;
    try {
      Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        value: {
          getItem: (key: string) => (key === SFX_MUTED_STORAGE_KEY ? "true" : null),
        },
      });
      expect(playUiSound("trimestre_bell", { audioContext: ctx })).toBe(false);
      expect(stats.oscillatorsStarted).toBe(0);

      expect(playUiSound("trimestre_bell", { muted: false, audioContext: ctx })).toBe(true);
      expect(stats.oscillatorsStarted).toBeGreaterThan(0);
    } finally {
      Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        value: originalStorage,
      });
    }

    // Broken / autoplay-blocked oscillator start never throws
    const throwingCtx = {
      currentTime: 0,
      destination: {},
      createOscillator: () => {
        throw new Error("Autoplay blocked");
      },
      createGain: () => ({}),
    } as unknown as BaseAudioContext;
    expect(() =>
      playUiSound("cash_loss", { muted: false, audioContext: throwingCtx }),
    ).not.toThrow();
    expect(playUiSound("cash_loss", { muted: false, audioContext: throwingCtx })).toBe(false);
  });

  it("registers ./sw.js cleanly on HTTPS / localhost when enabled and no-ops in Vitest/dev or non-secure origins", async () => {
    // Default Vitest environment (MODE === "test") is a silent no-op
    expect(await registerServiceWorker()).toBeNull();

    const originalWindow = globalThis.window;
    const originalNavigator = globalThis.navigator;
    try {
      const fakeRegistration = { scope: "https://autonomo-simulator.vercel.app/" };
      const registerSpy = vi.fn(async () => fakeRegistration);

      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: {
          location: {
            protocol: "https:",
            hostname: "autonomo-simulator.vercel.app",
          },
          addEventListener: vi.fn(),
        },
      });
      Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        value: {
          serviceWorker: {
            register: registerSpy,
          },
        },
      });

      const reg = await registerServiceWorker({ enabled: true, immediate: true });
      expect(reg).toBe(fakeRegistration);
      expect(registerSpy).toHaveBeenCalledWith("./sw.js", { scope: "./" });

      // file:// protocol is skipped without calling register()
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: {
          location: {
            protocol: "file:",
            hostname: "",
          },
        },
      });
      expect(await registerServiceWorker({ enabled: true, immediate: true })).toBeNull();
      expect(registerSpy).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: originalWindow,
      });
      Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        value: originalNavigator,
      });
    }
  });
});
