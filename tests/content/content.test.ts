import { describe, expect, it } from "vitest";
import { validateAssets } from "../../scripts/validate-assets.ts";
import { loadAndValidateContent } from "../../scripts/validate-content.ts";
import {
  type EventCategory,
  applyPlayerChoice,
  canDeferQuarterlyTax,
  dismissAnnualSummary,
  getActiveEvent,
  hasActiveRequirements,
  resolveVictoryPrompt,
  settleQuarter,
  startNewRun,
} from "../../src/engine/index.ts";
import {
  compiledCatalog,
  resolveCharacterPortraitAsset,
} from "../../src/services/content/catalog.ts";

describe("Phase 1 repository assets, manifest & YAML content catalog contracts", () => {
  it("validates assets/manifest.json with 54 entries (45 WebP + 9 SVG, 49 ready + 5 fallbacks)", () => {
    const result = validateAssets(process.cwd());
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.manifest).not.toBeNull();

    const manifest = result.manifest!;
    const entries = Object.entries(manifest.assets);
    expect(entries).toHaveLength(54);

    const webpEntries = entries.filter(([, a]) => a.path.endsWith(".webp"));
    const svgEntries = entries.filter(([, a]) => a.path.endsWith(".svg"));
    expect(webpEntries).toHaveLength(45);
    expect(svgEntries).toHaveLength(9);

    const nonFallbackEntries = entries.filter(([id]) => !id.startsWith("ui_fallback_"));
    const fallbackEntries = entries.filter(([id]) => id.startsWith("ui_fallback_"));
    expect(nonFallbackEntries).toHaveLength(49);
    expect(fallbackEntries).toHaveLength(5);

    for (const [id, asset] of nonFallbackEntries) {
      expect(asset.status, `Expected asset '${id}' to have status 'ready'`).toBe("ready");
      expect(asset.render_mode).toBe("vector_hd");
    }

    const byCategory = {
      background: entries.filter(([, a]) => a.category === "background"),
      illustration: entries.filter(([, a]) => a.category === "illustration"),
      character: entries.filter(([, a]) => a.category === "character"),
      ui: entries.filter(([, a]) => a.category === "ui"),
    };
    expect(byCategory.background).toHaveLength(4);
    expect(byCategory.illustration).toHaveLength(19);
    expect(byCategory.character).toHaveLength(22);
    expect(byCategory.ui).toHaveLength(9);
  });

  it("validates all 8 multi-expression characters and 42 Phase 1 events with exact category distribution", () => {
    const result = loadAndValidateContent(process.cwd());
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);

    const characterList = Object.values(result.characters);
    expect(characterList).toHaveLength(8);
    for (const char of characterList) {
      expect(
        char.expressions,
        `Expected '${char.id}' to define multi-expression map`,
      ).toBeDefined();
      const exprKeys = Object.keys(char.expressions ?? {});
      expect(exprKeys.length).toBeGreaterThanOrEqual(2);
      expect(char.expressions?.neutral).toBe(char.portrait_asset_id);
    }

    expect(result.events).toHaveLength(42);
    const countsByCategory: Record<EventCategory, number> = {
      clientes: 0,
      hacienda: 0,
      gestor: 0,
      familia: 0,
      empleados: 0,
    };
    for (const event of result.events) {
      countsByCategory[event.category] += 1;
    }
    expect(countsByCategory).toEqual({
      clientes: 14,
      hacienda: 8,
      gestor: 6,
      familia: 8,
      empleados: 6,
    });
  });

  it("enforces anti-softlock, NPC expression resolution, illustration refs, and zero orphan chains across all 42 events", () => {
    const result = loadAndValidateContent(process.cwd());
    expect(result.ok).toBe(true);
    const manifest = result.manifest!;
    const eventsById = new Map(result.events.map((e) => [e.id, e]));
    const incomingChainEdges = new Map<string, number>();

    for (const event of result.events) {
      // Anti-softlock invariant: >= 2 choices and >= 1 unconditional choice
      expect(event.choices.length, `Event '${event.id}' must have >= 2 choices`).toBeGreaterThanOrEqual(
        2,
      );
      const unconditionalChoices = event.choices.filter(
        (choice) => !hasActiveRequirements(choice.requirements),
      );
      expect(
        unconditionalChoices.length,
        `Event '${event.id}' must have >= 1 unconditional choice`,
      ).toBeGreaterThanOrEqual(1);

      // Character & expression resolution
      if (event.character_id) {
        const char = result.characters[event.character_id];
        expect(char, `Unknown character_id '${event.character_id}' on '${event.id}'`).toBeDefined();

        if (event.character_expression) {
          expect(
            char.expressions?.[event.character_expression],
            `Character '${char.id}' should map expression '${event.character_expression}' used by '${event.id}'`,
          ).toBeDefined();
        }

        const resolvedPortrait = resolveCharacterPortraitAsset(
          manifest,
          char,
          event.character_expression,
        );
        expect(resolvedPortrait).not.toBeNull();
        expect(resolvedPortrait!.category).toBe("character");
        expect(resolvedPortrait!.status).toBe("ready");
      } else {
        expect(event.character_expression ?? null).toBeNull();
      }

      // Milestone illustration reference
      if (event.illustration_id) {
        const illus = manifest.assets[event.illustration_id];
        expect(illus, `Missing illustration '${event.illustration_id}'`).toBeDefined();
        expect(illus.category).toBe("illustration");
        expect(illus.status).toBe("ready");
      }

      // Outgoing schedule_events & exclusive_with edges
      for (const exId of event.exclusive_with ?? []) {
        expect(eventsById.has(exId)).toBe(true);
      }

      for (const choice of event.choices) {
        const effectBlocks = [
          ...(choice.effects ? [choice.effects] : []),
          ...(choice.outcomes ? choice.outcomes.map((o) => o.effects) : []),
        ];
        for (const eff of effectBlocks) {
          for (const sched of eff.schedule_events ?? []) {
            expect(
              eventsById.has(sched.event_id),
              `Broken chain target '${sched.event_id}' in '${event.id}'`,
            ).toBe(true);
            if ((sched.probability ?? 1) > 0 && sched.event_id !== event.id) {
              incomingChainEdges.set(
                sched.event_id,
                (incomingChainEdges.get(sched.event_id) ?? 0) + 1,
              );
            }
          }
        }
      }
    }

    // Zero orphan chain-only events
    for (const event of result.events) {
      if (event.weight === 0) {
        expect(
          incomingChainEdges.get(event.id) ?? 0,
          `Chain-only event '${event.id}' has zero incoming schedule_events edges`,
        ).toBeGreaterThan(0);
      }
    }

    // Compiled bundle parity check
    expect(Object.keys(compiledCatalog.characters)).toHaveLength(8);
    expect(compiledCatalog.events).toHaveLength(42);
    expect(Object.keys(compiledCatalog.manifest.assets)).toHaveLength(54);
    expect(compiledCatalog.balance).toEqual(result.balance);
  });

  it("plays a multi-year seeded run on the compiled 42-event catalog without errors", () => {
    let { state } = startNewRun(compiledCatalog, { seed: "LIVE-CONTENT-SMOKE-P1" });
    let steps = 0;

    while (state.phase !== "game_over" && state.month <= 36) {
      steps += 1;
      expect(steps).toBeLessThan(500);

      if (state.phase === "event_resolution") {
        const active = getActiveEvent(state, compiledCatalog);
        expect(active).not.toBeNull();
        const eligibleChoice = active!.choices.find((c) => c.eligible);
        expect(eligibleChoice).toBeDefined();
        state = applyPlayerChoice(state, compiledCatalog, eligibleChoice!.choice.id).state;
      } else if (state.phase === "quarterly_tax") {
        const mode =
          state.indicators.money < state.finances.accrued_tax_liability &&
          canDeferQuarterlyTax(state)
            ? "defer"
            : "pay";
        state = settleQuarter(state, compiledCatalog, mode).state;
      } else if (state.phase === "victory_prompt") {
        state = resolveVictoryPrompt(state, compiledCatalog, "continue").state;
      } else if (state.phase === "annual_summary") {
        state = dismissAnnualSummary(state, compiledCatalog).state;
      }
    }

    expect(state.month).toBeGreaterThan(1);
  });
});
