import { describe, expect, it } from "vitest";
import { validateAssets } from "../../scripts/validate-assets.ts";
import { loadAndValidateContent } from "../../scripts/validate-content.ts";
import {
  applyPlayerChoice,
  canDeferQuarterlyTax,
  dismissAnnualSummary,
  getActiveEvent,
  resolveVictoryPrompt,
  settleQuarter,
  startNewRun,
} from "../../src/engine/index.ts";

describe("Live repository assets & YAML content catalog validation", () => {
  it("validates assets/manifest.json and all SVG files on disk", () => {
    const result = validateAssets(process.cwd());
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.manifest).not.toBeNull();
  });

  it("validates balance.yaml, characters, and events with zero schema or graph errors", () => {
    const result = loadAndValidateContent(process.cwd());
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
    expect(Object.keys(result.characters).length).toBeGreaterThanOrEqual(6);
    expect(result.events.length).toBeGreaterThanOrEqual(6);
  });

  it("plays a multi-year seeded run on the live content catalog without errors", () => {
    const validated = loadAndValidateContent(process.cwd());
    expect(validated.ok).toBe(true);

    const catalog = {
      balance: validated.balance!,
      characters: validated.characters,
      events: validated.events,
      manifest: validated.manifest!,
    };

    let { state } = startNewRun(catalog, { seed: "LIVE-CONTENT-SMOKE" });
    let steps = 0;

    while (state.phase !== "game_over" && state.month <= 24) {
      steps += 1;
      expect(steps).toBeLessThan(500);

      if (state.phase === "event_resolution") {
        const active = getActiveEvent(state, catalog);
        expect(active).not.toBeNull();
        const eligibleChoice = active!.choices.find((c) => c.eligible);
        expect(eligibleChoice).toBeDefined();
        state = applyPlayerChoice(state, catalog, eligibleChoice!.choice.id).state;
      } else if (state.phase === "quarterly_tax") {
        const mode =
          state.indicators.money < state.finances.accrued_tax_liability &&
          canDeferQuarterlyTax(state)
            ? "defer"
            : "pay";
        state = settleQuarter(state, catalog, mode).state;
      } else if (state.phase === "victory_prompt") {
        state = resolveVictoryPrompt(state, catalog, "continue").state;
      } else if (state.phase === "annual_summary") {
        state = dismissAnnualSummary(state, catalog).state;
      }
    }

    expect(state.month).toBeGreaterThan(1);
  });
});
