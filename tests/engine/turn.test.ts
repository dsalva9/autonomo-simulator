import { describe, expect, it } from "vitest";
import {
  type ContentCatalog,
  type GameState,
  applyPlayerChoice,
  dismissAnnualSummary,
  getActiveEvent,
  resolveVictoryPrompt,
  settleQuarter,
  startNewRun,
} from "../../src/engine/index.ts";
import { createFixtureBalance, createFixtureCharacters, createFixtureEvents } from "./fixtures.ts";

function stepOneAction(state: GameState, catalog: ContentCatalog): GameState {
  if (state.phase === "event_resolution") {
    const view = getActiveEvent(state, catalog)!;
    const eligible = view.choices.find((c) => c.eligible)!;
    return applyPlayerChoice(state, catalog, eligible.choice.id).state;
  }
  if (state.phase === "quarterly_tax") {
    return settleQuarter(state, catalog, "pay").state;
  }
  if (state.phase === "victory_prompt") {
    return resolveVictoryPrompt(state, catalog, "continue").state;
  }
  if (state.phase === "annual_summary") {
    return dismissAnnualSummary(state, catalog).state;
  }
  return state;
}

describe("Turn pipeline, cooldown relaxation, victories, annual summary & save determinism", () => {
  it("relaxes cooldowns when every repeatable random event is on cooldown", () => {
    const singleLongCooldownCatalog: ContentCatalog = {
      balance: createFixtureBalance(),
      characters: createFixtureCharacters(),
      events: [
        {
          schema_version: 1,
          id: "clientes_unico_evento",
          category: "clientes",
          title: "Único evento",
          body: "Con enfriamiento largo.",
          weight: 10,
          cooldown_months: 12,
          choices: [
            { id: "seguir", label: "Seguir", effects: { billed_income: 500, stress: -2 } },
            { id: "descansar", label: "Descansar", effects: { stress: -4 } },
          ],
        },
      ],
    };

    const m1 = startNewRun(singleLongCooldownCatalog, { seed: "RELAX-1" });
    expect(m1.state.current_turn_events).toEqual(["clientes_unico_evento"]);

    const m2 = applyPlayerChoice(m1.state, singleLongCooldownCatalog, "seguir");
    expect(m2.state.month).toBe(2);
    expect(m2.resolution.monthStart?.cooldown_relaxed).toBe(true);
    expect(m2.state.current_turn_events).toEqual(["clientes_unico_evento"]);
  });

  it("caps scheduled chain events at 1 per month and spills excess FIFO to the next month", () => {
    const catalog: ContentCatalog = {
      balance: createFixtureBalance(),
      characters: createFixtureCharacters(),
      events: createFixtureEvents(),
    };

    const started = startNewRun(catalog, { seed: "FIFO-QUEUE" });
    const withQueued: GameState = {
      ...started.state,
      flags: { cobro_en_b_reciente: true },
      scheduled_queue: [
        {
          queue_id: "q1",
          event_id: "hacienda_carta_certificada",
          trigger_month: 2,
          source_event_id: "test",
        },
        {
          queue_id: "q2",
          event_id: "gestor_oferta_servicios",
          trigger_month: 2,
          source_event_id: "test",
        },
      ],
      current_turn_events: ["clientes_encargo_urgente"],
    };

    const intoMonth2 = applyPlayerChoice(withQueued, catalog, "poner_limites");
    expect(intoMonth2.state.month).toBe(2);
    expect(intoMonth2.state.current_turn_events.length).toBe(2);
    expect(intoMonth2.state.current_turn_events[0]).toBe("hacienda_carta_certificada");
    expect(intoMonth2.state.scheduled_queue.map((q) => q.queue_id)).toEqual(["q2"]);
  });

  it("handles Month 12 annual summary, victory prompts, Endless mode, and badge retention", () => {
    const catalog: ContentCatalog = {
      balance: createFixtureBalance(),
      characters: createFixtureCharacters(),
      events: [
        {
          schema_version: 1,
          id: "clientes_rutina",
          category: "clientes",
          title: "Rutina",
          body: "Mes tranquilo.",
          weight: 10,
          cooldown_months: 0,
          choices: [
            { id: "facturar", label: "Facturar", effects: { billed_income: 700, stress: -2 } },
            { id: "calma", label: "Calma", effects: { stress: -5 } },
            { id: "quemarse", label: "Quemarse", effects: { stress: 15 } },
          ],
        },
      ],
    };

    let { state } = startNewRun(catalog, { seed: "ANNUAL-AND-VICTORY" });
    while (state.month < 12 || state.phase !== "annual_summary") {
      state = stepOneAction(state, catalog);
    }

    expect(state.month).toBe(12);
    expect(state.phase).toBe("annual_summary");

    state = dismissAnnualSummary(state, catalog).state;
    expect(state.month).toBe(13);
    expect(state.phase).toBe("event_resolution");

    const richSetup: GameState = {
      ...state,
      indicators: { ...state.indicators, money: 160000 },
      current_turn_events: ["clientes_rutina"],
    };
    const afterRichTurn = applyPlayerChoice(richSetup, catalog, "facturar");
    expect(afterRichTurn.state.phase).toBe("victory_prompt");
    expect(afterRichTurn.state.earned_victories).toContain("rich_150k");

    const endless = resolveVictoryPrompt(afterRichTurn.state, catalog, "continue");
    expect(endless.state.endless_mode).toBe(true);
    expect(endless.state.earned_victories).toContain("rich_150k");

    const burnoutSetup: GameState = {
      ...endless.state,
      indicators: { ...endless.state.indicators, stress: 95 },
      current_turn_events: ["clientes_rutina"],
    };
    const burnedOut = applyPlayerChoice(burnoutSetup, catalog, "quemarse");
    expect(burnedOut.state.phase).toBe("game_over");
    expect(burnedOut.state.ending?.id).toBe("defeat_burnout_stress");
    expect(burnedOut.state.earned_victories).toContain("rich_150k");
  });

  it("preserves exact state determinism across mid-month JSON save/reload", () => {
    const catalog: ContentCatalog = {
      balance: createFixtureBalance(),
      characters: createFixtureCharacters(),
      events: createFixtureEvents(),
    };

    let continuous = startNewRun(catalog, { seed: "SAVE-PARITY-99" }).state;
    let reloaded = startNewRun(catalog, { seed: "SAVE-PARITY-99" }).state;

    for (let step = 0; step < 30; step += 1) {
      if (continuous.phase === "game_over") {
        break;
      }
      continuous = stepOneAction(continuous, catalog);
      reloaded = JSON.parse(JSON.stringify(reloaded)) as GameState;
      reloaded = stepOneAction(reloaded, catalog);
      expect(reloaded).toEqual(continuous);
    }
  });

  it("captures postChoiceState at Month N before advancing to Month N+1 recurring economy", () => {
    const catalog: ContentCatalog = {
      balance: createFixtureBalance(),
      characters: createFixtureCharacters(),
      events: [
        {
          schema_version: 1,
          id: "familia_gasto_directo",
          category: "familia",
          title: "Gasto imprevisto",
          body: "Toca pagar reparación doméstica.",
          weight: 10,
          cooldown_months: 0,
          choices: [
            {
              id: "pagar_reparacion",
              label: "Pagar 400 €",
              result_text: "Pagas al contado.",
              effects: { cash_delta: -400, stress: -3 },
            },
            {
              id: "ignorar",
              label: "Ignorar",
              result_text: "Lo dejas pasar.",
              effects: { stress: 5 },
            },
          ],
        },
      ],
    };

    const started = startNewRun(catalog, { seed: "POST-CHOICE-SNAPSHOT" });
    const month1MoneyBeforeChoice = started.state.indicators.money;
    expect(started.state.month).toBe(1);

    const step = applyPlayerChoice(started.state, catalog, "pagar_reparacion");

    // Headless next state already advanced to Month 2 with Month 2 recurring economy
    expect(step.state.month).toBe(2);
    expect(step.resolution.monthStart?.month).toBe(2);

    // postChoiceState preserves exact Month 1 state & -400 € cash delta before Month 2 billing
    expect(step.resolution.postChoiceState).toBeDefined();
    expect(step.resolution.postChoiceState!.month).toBe(1);
    expect(step.resolution.postChoiceState!.current_turn_events).toEqual([]);
    expect(step.resolution.postChoiceState!.indicators.money).toBe(month1MoneyBeforeChoice - 400);
    expect(step.resolution.choiceOutcome?.money_delta).toBe(-400);
  });
});
