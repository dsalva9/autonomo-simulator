import type { PrngState } from "./types.ts";

function cyrb128(seed: string): [number, number, number, number] {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;

  for (let i = 0; i < seed.length; i += 1) {
    const k = seed.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }

  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);

  const s1 = (h1 ^ h2 ^ h3 ^ h4) >>> 0;
  const s2 = (h2 ^ h1) >>> 0;
  const s3 = (h3 ^ h1) >>> 0;
  const s4 = (h4 ^ h1) >>> 0;

  if (s1 === 0 && s2 === 0 && s3 === 0 && s4 === 0) {
    return [0x9e3779b9, 0x243f6a88, 0xb7e15162, 0xdeadbeef];
  }

  return [s1, s2, s3, s4];
}

export function createPrng(seed: string): PrngState {
  const normalizedSeed = seed.trim().length > 0 ? seed.trim() : "AUT-DEFAULT-SEED";
  let prng: PrngState = {
    seed: normalizedSeed,
    state: cyrb128(normalizedSeed),
  };

  for (let i = 0; i < 15; i += 1) {
    prng = nextUint32(prng).prng;
  }

  return prng;
}

export function nextUint32(prng: PrngState): { value: number; prng: PrngState } {
  let [a, b, c, d] = prng.state;
  a >>>= 0;
  b >>>= 0;
  c >>>= 0;
  d >>>= 0;

  const t = (((a + b) | 0) + d) | 0;
  d = (d + 1) | 0;
  a = b ^ (b >>> 9);
  b = (c + (c << 3)) | 0;
  c = (c << 21) | (c >>> 11);
  c = (c + t) | 0;

  return {
    value: t >>> 0,
    prng: {
      seed: prng.seed,
      state: [a >>> 0, b >>> 0, c >>> 0, d >>> 0],
    },
  };
}

export function nextFloat(prng: PrngState): { value: number; prng: PrngState } {
  const step = nextUint32(prng);
  return {
    value: step.value / 4294967296,
    prng: step.prng,
  };
}

export function nextInt(
  prng: PrngState,
  minInclusive: number,
  maxInclusive: number,
): { value: number; prng: PrngState } {
  const low = Math.ceil(Math.min(minInclusive, maxInclusive));
  const high = Math.floor(Math.max(minInclusive, maxInclusive));
  if (low === high) {
    return { value: low, prng };
  }
  const step = nextFloat(prng);
  const span = high - low + 1;
  return {
    value: low + Math.floor(step.value * span),
    prng: step.prng,
  };
}

export function pickWeighted<T extends { weight: number }>(
  prng: PrngState,
  items: readonly T[],
): { item: T; index: number; prng: PrngState } {
  if (items.length === 0) {
    throw new Error("pickWeighted requires a non-empty candidate array.");
  }

  let totalWeight = 0;
  for (const item of items) {
    if (item.weight > 0) {
      totalWeight += item.weight;
    }
  }

  if (totalWeight <= 0) {
    return { item: items[0], index: 0, prng };
  }

  const roll = nextFloat(prng);
  let threshold = roll.value * totalWeight;

  for (let i = 0; i < items.length; i += 1) {
    const candidate = items[i];
    if (candidate.weight <= 0) {
      continue;
    }
    threshold -= candidate.weight;
    if (threshold <= 0) {
      return { item: candidate, index: i, prng: roll.prng };
    }
  }

  const lastPositiveIndex = findLastPositiveWeightIndex(items);
  return {
    item: items[lastPositiveIndex],
    index: lastPositiveIndex,
    prng: roll.prng,
  };
}

function findLastPositiveWeightIndex<T extends { weight: number }>(items: readonly T[]): number {
  for (let i = items.length - 1; i >= 0; i -= 1) {
    if (items[i].weight > 0) {
      return i;
    }
  }
  return 0;
}
