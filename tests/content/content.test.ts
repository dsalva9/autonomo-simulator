import { describe, expect, it } from "vitest";
import { validateAssets } from "../../scripts/validate-assets.ts";
import { loadAndValidateContent } from "../../scripts/validate-content.ts";
import { validateLocales } from "../../scripts/validate-locales.ts";
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
  resolveEventBannerAsset,
} from "../../src/services/content/catalog.ts";
import {
  MODIFIER_LABELS_BY_ID_EN,
  MODIFIER_LABELS_EN,
  resolveEventText,
  translateModifierLabel,
} from "../../src/services/i18n/resolveEventText.ts";

describe("Phase 3.5 repository assets, manifest, English i18n & 300-event YAML content catalog contracts", () => {
  it("validates assets/manifest.json with 60 entries (51 WebP + 9 SVG, 55 ready + 5 fallbacks)", () => {
    const result = validateAssets(process.cwd());
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.manifest).not.toBeNull();

    const manifest = result.manifest!;
    const entries = Object.entries(manifest.assets);
    expect(entries).toHaveLength(60);

    const webpEntries = entries.filter(([, a]) => a.path.endsWith(".webp"));
    const svgEntries = entries.filter(([, a]) => a.path.endsWith(".svg"));
    expect(webpEntries).toHaveLength(51);
    expect(svgEntries).toHaveLength(9);

    const nonFallbackEntries = entries.filter(([id]) => !id.startsWith("ui_fallback_"));
    const fallbackEntries = entries.filter(([id]) => id.startsWith("ui_fallback_"));
    expect(nonFallbackEntries).toHaveLength(55);
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
    expect(byCategory.illustration).toHaveLength(25);
    expect(byCategory.character).toHaveLength(22);
    expect(byCategory.ui).toHaveLength(9);
  });

  it("validates all 8 multi-expression characters and 300 Phase 3.5 events with exact category distribution", () => {
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

    expect(result.events).toHaveLength(300);
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
      clientes: 90,
      hacienda: 56,
      familia: 57,
      empleados: 48,
      gestor: 49,
    });
  });

  it("wires all 7 bespoke milestone illustrations across 8 milestone events and resolves Phase 3B tension/urgencia banners", () => {
    const eventsById = new Map(compiledCatalog.events.map((e) => [e.id, e]));
    const expectedMilestoneMap: Record<string, string> = {
      hacienda_carta_certificada: "illus_hito_inspeccion_hacienda",
      hacienda_acta_inspeccion: "illus_hito_inspeccion_hacienda",
      hacienda_susto_primer_trimestre: "illus_hito_primer_trimestre",
      empleados_primer_fichaje: "illus_hito_primer_empleado",
      familia_crisis_portatil_vacaciones: "illus_hito_crisis_familiar",
      familia_test_positivo_sorpresa: "illus_hito_criatura_casa",
      empleados_mudanza_local_calle: "illus_hito_mudanza_oficina",
      empleados_contraoferta_competencia: "illus_hito_conflicto_laboral",
    };

    const baseRun = startNewRun(compiledCatalog, { seed: "P3B-BANNER-CHECK" }).state;

    for (const [eventId, illusId] of Object.entries(expectedMilestoneMap)) {
      const ev = eventsById.get(eventId);
      expect(ev, `Expected milestone event '${eventId}' to exist`).toBeDefined();
      expect(ev!.illustration_id).toBe(illusId);
      const resolved = resolveEventBannerAsset(compiledCatalog.manifest, ev!, baseRun);
      expect(resolved.kind).toBe("milestone");
      expect(resolved.asset.id).toBe(illusId);
    }

    const stressedFamiliaEvent = compiledCatalog.events.find(
      (e) =>
        e.category === "familia" &&
        !e.illustration_id &&
        (e.character_expression === "angry" || e.character_expression === "stressed"),
    );
    expect(stressedFamiliaEvent).toBeDefined();
    expect(
      resolveEventBannerAsset(compiledCatalog.manifest, stressedFamiliaEvent!, baseRun).asset.id,
    ).toBe("banner_familia_tension");

    const stressedEmpleadosEvent = compiledCatalog.events.find(
      (e) =>
        e.category === "empleados" &&
        !e.illustration_id &&
        (e.character_expression === "angry" || e.character_expression === "stressed"),
    );
    expect(stressedEmpleadosEvent).toBeDefined();
    expect(
      resolveEventBannerAsset(compiledCatalog.manifest, stressedEmpleadosEvent!, baseRun).asset.id,
    ).toBe("banner_empleados_tension");

    const urgentGestorEvent = compiledCatalog.events.find(
      (e) =>
        e.category === "gestor" &&
        !e.illustration_id &&
        (e.character_expression === "angry" || e.character_expression === "stressed"),
    );
    expect(urgentGestorEvent).toBeDefined();
    expect(
      resolveEventBannerAsset(compiledCatalog.manifest, urgentGestorEvent!, baseRun).asset.id,
    ).toBe("banner_gestor_urgencia");
  });

  it("enforces 100% English ('en') event copy parity and 100% add_modifier ID & label translation coverage across all 300 events", () => {
    const localeResult = validateLocales(process.cwd(), "en");
    expect(localeResult.errors).toEqual([]);
    expect(localeResult.ok).toBe(true);
    expect(localeResult.eventCount).toBe(300);
    expect(localeResult.keyCount).toBeGreaterThanOrEqual(2502);

    let modifierCount = 0;
    for (const event of compiledCatalog.events) {
      const enTitle = resolveEventText("en", event.id, "title", "");
      const enBody = resolveEventText("en", event.id, "body", "");
      expect(enTitle.trim().length, `Missing EN title for '${event.id}'`).toBeGreaterThan(0);
      expect(enBody.trim().length, `Missing EN body for '${event.id}'`).toBeGreaterThan(0);

      for (const choice of event.choices) {
        const enLabel = resolveEventText("en", event.id, `choices.${choice.id}.label`, "");
        expect(
          enLabel.trim().length,
          `Missing EN label for '${event.id}.choices.${choice.id}'`,
        ).toBeGreaterThan(0);

        if (choice.result_text != null) {
          const enResult = resolveEventText("en", event.id, `choices.${choice.id}.result_text`, "");
          expect(
            enResult.trim().length,
            `Missing EN result_text for '${event.id}.choices.${choice.id}'`,
          ).toBeGreaterThan(0);
        }

        for (const outcome of choice.outcomes ?? []) {
          const enOutcome = resolveEventText(
            "en",
            event.id,
            `choices.${choice.id}.outcomes.${outcome.id}.result_text`,
            "",
          );
          expect(
            enOutcome.trim().length,
            `Missing EN outcome result_text for '${event.id}.choices.${choice.id}.outcomes.${outcome.id}'`,
          ).toBeGreaterThan(0);
        }

        const effectBlocks = [
          ...(choice.effects ? [choice.effects] : []),
          ...(choice.outcomes ? choice.outcomes.map((o) => o.effects) : []),
        ];
        for (const eff of effectBlocks) {
          if (eff.add_modifier) {
            modifierCount += 1;
            const mod = eff.add_modifier;
            expect(
              MODIFIER_LABELS_BY_ID_EN[mod.id],
              `Missing EN translation in MODIFIER_LABELS_BY_ID_EN for '${mod.id}' (event '${event.id}')`,
            ).toBeTruthy();
            expect(
              MODIFIER_LABELS_EN[mod.label],
              `Missing EN translation in MODIFIER_LABELS_EN for '${mod.label}' (event '${event.id}')`,
            ).toBeTruthy();
            const translated = translateModifierLabel(mod, "en");
            expect(translated.trim().length).toBeGreaterThan(0);
            expect(translated).not.toBe(mod.label);
          }
        }
      }
    }
    expect(modifierCount).toBeGreaterThanOrEqual(100);
  });

  it("enforces anti-softlock, NPC expression resolution, illustration refs, zero orphan chains, and late-game repeatable events across all 300 events", () => {
    const result = loadAndValidateContent(process.cwd());
    expect(result.ok).toBe(true);
    const manifest = result.manifest!;
    const eventsById = new Map(result.events.map((e) => [e.id, e]));
    const incomingChainEdges = new Map<string, number>();

    for (const event of result.events) {
      // Anti-softlock invariant: >= 2 choices and >= 1 unconditional choice
      expect(
        event.choices.length,
        `Event '${event.id}' must have >= 2 choices`,
      ).toBeGreaterThanOrEqual(2);
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

    // Late-game (min_month >= 60) repeatable events for Years 6-10 & Endless Mode
    const lateGameRepeatableEvents = result.events.filter(
      (event) =>
        (event.requirements?.min_month ?? 0) >= 60 &&
        event.max_occurrences == null &&
        event.weight > 0,
    );
    expect(lateGameRepeatableEvents.length).toBeGreaterThanOrEqual(25);
    const lateGameIds = new Set(lateGameRepeatableEvents.map((e) => e.id));
    expect(lateGameIds.has("clientes_renovacion_cartera_veterana")).toBe(true);
    expect(lateGameIds.has("clientes_acuerdo_marco_multianual_ibex")).toBe(true);
    expect(lateGameIds.has("familia_sabatico_largo_veterano")).toBe(true);
    expect(lateGameIds.has("empleados_paga_aniversario_estudio")).toBe(true);

    // Compiled bundle parity check
    expect(Object.keys(compiledCatalog.characters)).toHaveLength(8);
    expect(compiledCatalog.events).toHaveLength(300);
    expect(Object.keys(compiledCatalog.manifest.assets)).toHaveLength(60);
    expect(compiledCatalog.balance).toEqual(result.balance);
  });

  it("plays a multi-year seeded run on the compiled 300-event catalog without errors", () => {
    let { state } = startNewRun(compiledCatalog, { seed: "LIVE-CONTENT-SMOKE-P3B" });
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
