export type UiSoundKind =
  | "paper_choice"
  | "stamp_thud"
  | "coin_gain"
  | "cash_loss"
  | "trimestre_bell"
  | "achievement_seal";

export const UI_SOUND_KINDS: readonly UiSoundKind[] = [
  "paper_choice",
  "stamp_thud",
  "coin_gain",
  "cash_loss",
  "trimestre_bell",
  "achievement_seal",
] as const;

export const SFX_MUTED_STORAGE_KEY = "autonomo:sfx_muted";

export interface PlayUiSoundOptions {
  muted?: boolean;
  audioContext?: BaseAudioContext | null;
}

type AudioContextConstructor = new () => AudioContext;

let sharedAudioContext: AudioContext | null = null;

export function isSfxMutedInStorage(): boolean {
  try {
    if (typeof localStorage !== "undefined" && typeof localStorage.getItem === "function") {
      return localStorage.getItem(SFX_MUTED_STORAGE_KEY) === "true";
    }
  } catch {
    // Ignore sandboxed storage access errors
  }
  return false;
}

function resolveAudioContextConstructor(): AudioContextConstructor | null {
  const g = globalThis as typeof globalThis & {
    AudioContext?: AudioContextConstructor;
    webkitAudioContext?: AudioContextConstructor;
  };
  if (typeof g.AudioContext === "function") {
    return g.AudioContext;
  }
  if (typeof g.webkitAudioContext === "function") {
    return g.webkitAudioContext;
  }
  return null;
}

function getOrCreateAudioContext(
  explicitContext?: BaseAudioContext | null,
): BaseAudioContext | null {
  if (explicitContext !== undefined) {
    return explicitContext;
  }

  if (sharedAudioContext && sharedAudioContext.state !== "closed") {
    return sharedAudioContext;
  }

  const Ctor = resolveAudioContextConstructor();
  if (!Ctor) {
    return null;
  }

  try {
    sharedAudioContext = new Ctor();
    return sharedAudioContext;
  } catch {
    sharedAudioContext = null;
    return null;
  }
}

export function resetSharedAudioContextForTests(): void {
  if (sharedAudioContext && typeof sharedAudioContext.close === "function") {
    void Promise.resolve(sharedAudioContext.close()).catch(() => {});
  }
  sharedAudioContext = null;
}

function scheduleTone(
  ctx: BaseAudioContext,
  params: {
    type: OscillatorType;
    startFreq: number;
    endFreq?: number;
    startTime: number;
    duration: number;
    peakGain: number;
  },
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = params.type;
  osc.frequency.setValueAtTime(params.startFreq, params.startTime);
  if (params.endFreq !== undefined && params.endFreq !== params.startFreq) {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(20, params.endFreq),
      params.startTime + params.duration,
    );
  }

  gain.gain.setValueAtTime(0.0001, params.startTime);
  gain.gain.linearRampToValueAtTime(
    params.peakGain,
    params.startTime + Math.min(0.012, params.duration * 0.25),
  );
  gain.gain.exponentialRampToValueAtTime(0.0001, params.startTime + params.duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(params.startTime);
  osc.stop(params.startTime + params.duration + 0.005);
}

function schedulePaperRustle(ctx: BaseAudioContext, startTime: number): boolean {
  if (
    typeof ctx.createBuffer !== "function" ||
    typeof ctx.createBufferSource !== "function" ||
    typeof ctx.createBiquadFilter !== "function"
  ) {
    return false;
  }

  const durationSec = 0.055;
  const sampleRate = ctx.sampleRate || 44100;
  const frameCount = Math.max(64, Math.floor(sampleRate * durationSec));
  const buffer = ctx.createBuffer(1, frameCount, sampleRate);
  const channel = buffer.getChannelData(0);

  // Deterministic pseudo-noise burst so audio synthesis stays crisp and repeatable
  let lfsr = 0xace1;
  for (let i = 0; i < frameCount; i += 1) {
    const bit = ((lfsr >> 0) ^ (lfsr >> 2) ^ (lfsr >> 3) ^ (lfsr >> 5)) & 1;
    lfsr = (lfsr >> 1) | (bit << 15);
    const envelope = 1 - i / frameCount;
    channel[i] = (lfsr / 32768 - 1) * envelope;
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(1650, startTime);
  filter.Q.setValueAtTime(1.4, startTime);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.06, startTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + durationSec);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  source.start(startTime);
  source.stop(startTime + durationSec);
  return true;
}

/**
 * Synthesizes zero-asset procedural Web Audio bureaucratic micro-SFX.
 * Safe no-op in SSR, headless/autoplay-blocked browsers, or when muted.
 */
export function playUiSound(kind: UiSoundKind, options?: PlayUiSoundOptions): boolean {
  const isMuted = options?.muted ?? isSfxMutedInStorage();
  if (isMuted) {
    return false;
  }

  const ctx = getOrCreateAudioContext(options?.audioContext);
  if (!ctx) {
    return false;
  }

  try {
    const maybeResumable = ctx as AudioContext;
    if (maybeResumable.state === "suspended" && typeof maybeResumable.resume === "function") {
      void Promise.resolve(maybeResumable.resume()).catch(() => {});
    }

    const now = Math.max(0, ctx.currentTime || 0);

    switch (kind) {
      case "paper_choice": {
        schedulePaperRustle(ctx, now);
        scheduleTone(ctx, {
          type: "triangle",
          startFreq: 580,
          endFreq: 340,
          startTime: now,
          duration: 0.042,
          peakGain: 0.055,
        });
        break;
      }

      case "stamp_thud": {
        // Low rubber-stamp desk thump + crisp ink contact transient
        scheduleTone(ctx, {
          type: "sine",
          startFreq: 138,
          endFreq: 46,
          startTime: now,
          duration: 0.115,
          peakGain: 0.12,
        });
        scheduleTone(ctx, {
          type: "triangle",
          startFreq: 310,
          endFreq: 105,
          startTime: now,
          duration: 0.038,
          peakGain: 0.065,
        });
        break;
      }

      case "coin_gain": {
        // Two-note ascending chime (B5 -> E6)
        scheduleTone(ctx, {
          type: "sine",
          startFreq: 987.77,
          startTime: now,
          duration: 0.065,
          peakGain: 0.075,
        });
        scheduleTone(ctx, {
          type: "sine",
          startFreq: 1318.51,
          startTime: now + 0.055,
          duration: 0.135,
          peakGain: 0.085,
        });
        break;
      }

      case "cash_loss": {
        // Dry two-step descending ledger debit (E4 -> A3)
        scheduleTone(ctx, {
          type: "triangle",
          startFreq: 329.63,
          endFreq: 290,
          startTime: now,
          duration: 0.075,
          peakGain: 0.07,
        });
        scheduleTone(ctx, {
          type: "triangle",
          startFreq: 220,
          endFreq: 185,
          startTime: now + 0.068,
          duration: 0.12,
          peakGain: 0.075,
        });
        break;
      }

      case "trimestre_bell": {
        // Bureaucratic counter desk-bell (A5 + overtone shimmer)
        scheduleTone(ctx, {
          type: "sine",
          startFreq: 880,
          startTime: now,
          duration: 0.24,
          peakGain: 0.085,
        });
        scheduleTone(ctx, {
          type: "sine",
          startFreq: 1760,
          startTime: now,
          duration: 0.15,
          peakGain: 0.04,
        });
        break;
      }

      case "achievement_seal": {
        // Celebratory three-note official seal arpeggio (C5 -> E5 -> G5 -> C6)
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((freq, idx) => {
          scheduleTone(ctx, {
            type: "triangle",
            startFreq: freq,
            startTime: now + idx * 0.055,
            duration: idx === notes.length - 1 ? 0.18 : 0.075,
            peakGain: 0.075,
          });
        });
        break;
      }
    }

    return true;
  } catch {
    return false;
  }
}
