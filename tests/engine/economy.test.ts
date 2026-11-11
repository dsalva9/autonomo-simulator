import { describe, expect, it } from "vitest";
import {
  applyPlayerChoice,
  applyRecurringMonthEconomy,
  canDeferQuarterlyTax,
  computeBaselineMonthlyBilling,
  computeMonthlyRecurringExpenses,
  createInitialGameState,
  resolveChoiceEffects,
  settleQuarter,
  startNewRun,
} from "../../src/engine/index.ts";
import { createFixtureCatalog } from "./fixtures.ts";

describe("Economy, invoicing, quarterly taxes & insolvency rules", () => {
  it("computes baseline monthly billing and recurring expenses accurately", () => {
    const catalog = createFixtureCatalog();
    const state = createInitialGameState(catalog, { seed: "ECON-1" });

    expect(state.indicators.money).toBe(3500);
    const billing = computeBaselineMonthlyBilling(state, catalog);
    expect(billing).toBe(2323);

    const expenses = computeMonthlyRecurringExpenses(state, catalog);
    expect(expenses).toBe(1560);

    const afterRecurring = applyRecurringMonthEconomy(state, catalog);
    expect(afterRecurring.state.indicators.money).toBe(3500 + 2323 - 1560);
    expect(afterRecurring.state.finances.lifetime_billed).toBe(2323);
    expect(afterRecurring.state.finances.accrued_tax_liability).toBe(Math.round(2323 * 0.28));
  });

  it("distinguishes billed_income, untaxed cash_delta, and deductible_expense", () => {
    const catalog = createFixtureCatalog();
    const base = createInitialGameState(catalog, { seed: "ECON-EFFECTS" });
    const event = catalog.events[0];

    const billedChoice = event.choices[1];
    const afterBilled = resolveChoiceEffects(base, catalog, event, billedChoice).state;
    expect(afterBilled.indicators.money).toBe(3500 + 1300);
    expect(afterBilled.finances.lifetime_billed).toBe(1300);
    expect(afterBilled.finances.accrued_tax_liability).toBe(Math.round(1300 * 0.28));

    const cashEvent = {
      ...event,
      choices: [
        { id: "en_b", label: "B", effects: { cash_delta: 1000 } },
        { id: "deducir", label: "D", effects: { deductible_expense: 500 } },
      ],
    };
    const afterCash = resolveChoiceEffects(
      afterBilled,
      catalog,
      cashEvent,
      cashEvent.choices[0],
    ).state;
    expect(afterCash.indicators.money).toBe(afterBilled.indicators.money + 1000);
    expect(afterCash.finances.lifetime_billed).toBe(1300);
    expect(afterCash.finances.accrued_tax_liability).toBe(
      afterBilled.finances.accrued_tax_liability,
    );

    const afterDeduct = resolveChoiceEffects(
      afterCash,
      catalog,
      cashEvent,
      cashEvent.choices[1],
    ).state;
    expect(afterDeduct.indicators.money).toBe(afterCash.indicators.money - 500);
    expect(afterDeduct.finances.accrued_tax_liability).toBe(
      afterBilled.finances.accrued_tax_liability - Math.round(500 * 0.28),
    );
  });

  it("handles El Trimestre pay in full vs one-time Aplazamiento and forbids chaining deferrals", () => {
    const catalog = createFixtureCatalog();
    let { state } = startNewRun(catalog, { seed: "QUARTER-TEST" });

    while (state.phase !== "quarterly_tax") {
      const choiceId = state.current_turn_events[0]
        ? catalog.events
            .find((e) => e.id === state.current_turn_events[0])!
            .choices.find((c) => !c.requirements)!.id
        : "";
      state = applyPlayerChoice(state, catalog, choiceId).state;
    }

    expect(state.month).toBe(3);
    expect(canDeferQuarterlyTax(state)).toBe(true);
    const dueQ1 = state.finances.accrued_tax_liability;
    expect(dueQ1).toBeGreaterThan(0);

    const deferred = settleQuarter(state, catalog, "defer");
    expect(deferred.state.month).toBe(4);
    expect(deferred.state.finances.deferred_tax).toEqual({
      principal: dueQ1,
      surcharge: Math.round(dueQ1 * 0.1),
      due_month: 6,
    });
    expect(deferred.state.finances.accrued_tax_liability).toBe(
      deferred.resolution.monthStart?.tax_accrued_on_billing,
    );

    let q2State = deferred.state;
    while (q2State.phase !== "quarterly_tax") {
      const ev = catalog.events.find((e) => e.id === q2State.current_turn_events[0])!;
      const unconditional = ev.choices.find((c) => !c.requirements)!;
      q2State = applyPlayerChoice(q2State, catalog, unconditional.id).state;
    }

    expect(q2State.month).toBe(6);
    expect(canDeferQuarterlyTax(q2State)).toBe(false);
    expect(() => settleQuarter(q2State, catalog, "defer")).toThrow();

    const paidQ2 = settleQuarter(q2State, catalog, "pay");
    expect(paidQ2.state.finances.deferred_tax).toBeNull();
  });

  it("triggers bankruptcy after 3 consecutive negative months or breaching hard debt floor", () => {
    const catalog = createFixtureCatalog();
    let { state } = startNewRun(catalog, { seed: "BANKRUPTCY-STREAK" });
    state = {
      ...state,
      indicators: { ...state.indicators, money: -200 },
      finances: { ...state.finances, consecutive_negative_months: 2 },
    };

    const res = applyPlayerChoice(
      {
        ...state,
        current_turn_events: ["clientes_encargo_urgente"],
      },
      catalog,
      "poner_limites",
    );

    expect(res.state.phase).toBe("game_over");
    expect(res.state.ending?.id).toBe("defeat_bankruptcy");
  });
});
