import { describe, expect, it } from "vitest";
import {
  type ChoiceSpec,
  type ContentCatalog,
  type EventCategory,
  type GameState,
  type PrngState,
  applyPlayerChoice,
  canDeferQuarterlyTax,
  createPrng,
  dismissAnnualSummary,
  getActiveEvent,
  nextInt,
  resolveVictoryPrompt,
  settleQuarter,
  startNewRun,
} from "../../src/engine/index.ts";
import { createFixtureCatalog } from "../engine/fixtures.ts";

type BotStrategy = "prudent" | "greedy_en_b" | "workaholic" | "random";

interface BotRunMetrics {
  survived120: boolean;
  finalMonth: number;
  endingId: string | null;
  categoriesSeen: Set<EventCategory>;
  finalMoney: number;
}

function selectBotChoice(
  strategy: BotStrategy,
  state: GameState,
  eligibleChoices: readonly ChoiceSpec[],
  botPrng: PrngState,
): { choiceId: string; botPrng: PrngState } {
  if (strategy === "random") {
    const roll = nextInt(botPrng, 0, eligibleChoices.length - 1);
    return { choiceId: eligibleChoices[roll.value].id, botPrng: roll.prng };
  }

  if (strategy === "prudent") {
    if (state.indicators.stress >= 62) {
      const relief = eligibleChoices.find((c) => (c.effects?.stress ?? 0) < 0);
      if (relief) {
        return { choiceId: relief.id, botPrng };
      }
    }
    const hireGestor = eligibleChoices.find(
      (c) => c.effects?.set_gestor?.tier === "cheap" && state.gestor.tier === "self",
    );
    if (hireGestor) {
      return { choiceId: hireGestor.id, botPrng };
    }
    const safeBilled = eligibleChoices.find(
      (c) =>
        (c.effects?.billed_income ?? 0) > 0 &&
        !c.effects?.hire_employee &&
        (c.effects?.fiscal_risk ?? 0) <= 0,
    );
    if (safeBilled) {
      return { choiceId: safeBilled.id, botPrng };
    }
    const safeNeutral = eligibleChoices.find((c) => !c.effects?.hire_employee && !c.outcomes);
    return { choiceId: (safeNeutral ?? eligibleChoices[0]).id, botPrng };
  }

  if (strategy === "greedy_en_b") {
    const risky = eligibleChoices.find((c) => Boolean(c.outcomes));
    if (risky) {
      return { choiceId: risky.id, botPrng };
    }
    const maxBilled = [...eligibleChoices].sort(
      (a, b) => (b.effects?.billed_income ?? 0) - (a.effects?.billed_income ?? 0),
    )[0];
    return { choiceId: maxBilled.id, botPrng };
  }

  const workChoice = [...eligibleChoices].sort((a, b) => {
    const scoreA = (a.effects?.billed_income ?? 0) + (a.effects?.deferred_invoice?.amount ?? 0);
    const scoreB = (b.effects?.billed_income ?? 0) + (b.effects?.deferred_invoice?.amount ?? 0);
    return scoreB - scoreA;
  })[0];
  return { choiceId: workChoice.id, botPrng };
}

function runSingleSimulation(
  catalog: ContentCatalog,
  strategy: BotStrategy,
  seed: string,
  maxMonths = 120,
): BotRunMetrics {
  let { state } = startNewRun(catalog, { seed });
  let botPrng = createPrng(`BOT-${strategy}-${seed}`);
  const categoriesSeen = new Set<EventCategory>();
  let safetyCounter = 0;

  while (state.phase !== "game_over" && state.month <= maxMonths) {
    safetyCounter += 1;
    if (safetyCounter > 2000) {
      throw new Error(
        `Deadlock detected on seed '${seed}' at month ${state.month} (${state.phase})`,
      );
    }

    if (state.phase === "event_resolution") {
      const active = getActiveEvent(state, catalog);
      if (!active) {
        throw new Error(`Missing active event on seed '${seed}' at month ${state.month}`);
      }
      categoriesSeen.add(active.event.category);
      const eligible = active.choices.filter((c) => c.eligible).map((c) => c.choice);
      if (eligible.length === 0) {
        throw new Error(`Softlock: zero eligible choices on event '${active.event.id}'`);
      }
      const picked = selectBotChoice(strategy, state, eligible, botPrng);
      botPrng = picked.botPrng;
      state = applyPlayerChoice(state, catalog, picked.choiceId).state;
      continue;
    }

    if (state.phase === "quarterly_tax") {
      const shouldDefer =
        state.indicators.money < state.finances.accrued_tax_liability &&
        canDeferQuarterlyTax(state);
      state = settleQuarter(state, catalog, shouldDefer ? "defer" : "pay").state;
      continue;
    }

    if (state.phase === "victory_prompt") {
      if (state.month >= 120) {
        state = resolveVictoryPrompt(state, catalog, "retire").state;
      } else {
        state = resolveVictoryPrompt(state, catalog, "continue").state;
      }
      continue;
    }

    if (state.phase === "annual_summary") {
      state = dismissAnnualSummary(state, catalog).state;
    }
  }

  const survived120 =
    state.earned_victories.includes("hero_120m") ||
    (state.phase !== "game_over" && state.month > maxMonths);

  return {
    survived120,
    finalMonth: state.month,
    endingId: state.ending?.id ?? null,
    categoriesSeen,
    finalMoney: state.indicators.money,
  };
}

describe("Monte Carlo 1,000-run simulation suite across 4 archetypes", () => {
  it("runs 1,000 seeded campaigns with zero exceptions, zero deadlocks, full category reachability, and balanced RandomBot survival", () => {
    const catalog = createFixtureCatalog();
    const strategies: readonly BotStrategy[] = ["prudent", "greedy_en_b", "workaholic", "random"];
    const runsPerBot = 250;
    const allCategories = new Set<EventCategory>();
    const survivalByBot: Record<BotStrategy, number> = {
      prudent: 0,
      greedy_en_b: 0,
      workaholic: 0,
      random: 0,
    };

    for (const strategy of strategies) {
      for (let i = 0; i < runsPerBot; i += 1) {
        const metrics = runSingleSimulation(catalog, strategy, `SIM-${strategy}-${i}`);
        if (metrics.survived120) {
          survivalByBot[strategy] += 1;
        }
        for (const cat of metrics.categoriesSeen) {
          allCategories.add(cat);
        }
      }
    }

    expect(allCategories).toEqual(
      new Set<EventCategory>(["clientes", "hacienda", "familia", "empleados", "gestor"]),
    );

    const randomSurvivalRate = survivalByBot.random / runsPerBot;
    expect(randomSurvivalRate).toBeGreaterThan(0.01);
    expect(randomSurvivalRate).toBeLessThan(0.95);
    expect(survivalByBot.prudent).toBeGreaterThan(survivalByBot.workaholic);

    const replay1 = runSingleSimulation(catalog, "random", "DETERMINISM-CHECK");
    const replay2 = runSingleSimulation(catalog, "random", "DETERMINISM-CHECK");
    expect(replay1.finalMonth).toBe(replay2.finalMonth);
    expect(replay1.finalMoney).toBe(replay2.finalMoney);
    expect(replay1.endingId).toBe(replay2.endingId);
  });
});
