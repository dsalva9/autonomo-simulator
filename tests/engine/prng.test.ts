import { describe, expect, it } from "vitest";
import {
  createPrng,
  nextFloat,
  nextInt,
  nextUint32,
  pickWeighted,
} from "../../src/engine/index.ts";

describe("sfc32 PRNG determinism & distribution", () => {
  it("produces identical sequences for identical seeds and across serialized state", () => {
    let prngA = createPrng("AUT-2026-X9K2");
    let prngB = createPrng("AUT-2026-X9K2");

    const seqA: number[] = [];
    const seqB: number[] = [];

    for (let i = 0; i < 20; i += 1) {
      const stepA = nextUint32(prngA);
      prngA = stepA.prng;
      seqA.push(stepA.value);

      if (i === 10) {
        prngB = JSON.parse(JSON.stringify(prngB));
      }
      const stepB = nextUint32(prngB);
      prngB = stepB.prng;
      seqB.push(stepB.value);
    }

    expect(seqA).toEqual(seqB);
  });

  it("diverges cleanly for distinct seeds", () => {
    const a = nextUint32(createPrng("SEED-ALPHA")).value;
    const b = nextUint32(createPrng("SEED-BETA")).value;
    expect(a).not.toBe(b);
  });

  it("generates floats strictly within [0, 1) and bounded integers within [min, max]", () => {
    let prng = createPrng("RANGE-CHECK");
    for (let i = 0; i < 250; i += 1) {
      const f = nextFloat(prng);
      prng = f.prng;
      expect(f.value).toBeGreaterThanOrEqual(0);
      expect(f.value).toBeLessThan(1);

      const n = nextInt(prng, -3, 5);
      prng = n.prng;
      expect(n.value).toBeGreaterThanOrEqual(-3);
      expect(n.value).toBeLessThanOrEqual(5);
      expect(Number.isInteger(n.value)).toBe(true);
    }
  });

  it("selects weighted items proportionally to their weights", () => {
    let prng = createPrng("WEIGHTED-DIST");
    const items = [
      { id: "common", weight: 75 },
      { id: "rare", weight: 25 },
    ];
    let commonHits = 0;
    const trials = 2000;

    for (let i = 0; i < trials; i += 1) {
      const picked = pickWeighted(prng, items);
      prng = picked.prng;
      if (picked.item.id === "common") {
        commonHits += 1;
      }
    }

    const ratio = commonHits / trials;
    expect(ratio).toBeGreaterThan(0.7);
    expect(ratio).toBeLessThan(0.8);
  });
});
