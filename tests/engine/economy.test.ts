import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import {
  BalanceConfigSchema,
  CharacterSchema,
  applyPlayerChoice,
  applyRecurringMonthEconomy,
  canDeferQuarterlyTax,
  computeBaselineMonthlyBilling,
  computeMonthlyDeductibleExpenses,
  computeMonthlyRecurringExpenses,
  computeNetCashAfterTaxReserve,
  computeReservedTaxObligation,
  createInitialGameState,
  resolveChoiceEffects,
  settleQuarter,
  startNewRun,
} from "../../src/engine/index.ts";
import { createFixtureCatalog } from "./fixtures.ts";

describe("Economy, invoicing, quarterly taxes & insolvency rules", () => {
  it("computes baseline monthly billing, deductible overhead, and recurring expenses accurately", () => {
    const catalog = createFixtureCatalog();
    const state = createInitialGameState(catalog, { seed: "ECON-1" });

    expect(state.indicators.money).toBe(3500);
    const billing = computeBaselineMonthlyBilling(state, catalog);
    expect(billing).toBe(2323);

    const deductible = computeMonthlyDeductibleExpenses(state, catalog);
    expect(deductible).toBe(310);

    const expenses = computeMonthlyRecurringExpenses(state, catalog);
    expect(expenses).toBe(1560);

    const afterRecurring = applyRecurringMonthEconomy(state, catalog);
    expect(afterRecurring.state.indicators.money).toBe(3500 + 2323 - 1560);
    expect(afterRecurring.state.finances.lifetime_billed).toBe(2323);
    expect(afterRecurring.taxAccruedOnBilling).toBe(Math.round(2323 * 0.28));
    expect(afterRecurring.deductibleExpenses).toBe(310);
    expect(afterRecurring.taxShieldOnExpenses).toBe(Math.round(310 * 0.28));
    expect(afterRecurring.netTaxAccrued).toBe(Math.round(2323 * 0.28) - Math.round(310 * 0.28));
    expect(afterRecurring.state.finances.accrued_tax_liability).toBe(afterRecurring.netTaxAccrued);
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
      deferred.resolution.monthStart?.net_tax_accrued,
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

  it("computes reserved tax obligation and net liquid cash after accrued + deferred Hacienda debt", () => {
    const catalog = createFixtureCatalog();
    let state = createInitialGameState(catalog, { seed: "TAX-RESERVE-HELPER" });

    expect(computeReservedTaxObligation(state)).toBe(0);
    expect(computeNetCashAfterTaxReserve(state)).toBe(state.indicators.money);

    state = {
      ...state,
      indicators: { ...state.indicators, money: 2400 },
      finances: {
        ...state.finances,
        accrued_tax_liability: 650,
        deferred_tax: {
          principal: 1500,
          surcharge: 150,
          due_month: 6,
        },
      },
    };

    expect(computeReservedTaxObligation(state)).toBe(650 + 1500 + 150);
    expect(computeNetCashAfterTaxReserve(state)).toBe(2400 - 2300);

    // Dipping below reserved taxes turns tax-adjusted liquidity negative even before Trimestre
    const underwater = {
      ...state,
      indicators: { ...state.indicators, money: 1900 },
    };
    expect(computeNetCashAfterTaxReserve(underwater)).toBe(-400);
  });

  it("offsets recurring tax accrual with deductible business expenses, scales living cost creep, modulates employee satisfaction, and applies late-game stat drift", () => {
    const catalog = createFixtureCatalog();
    catalog.balance = {
      ...catalog.balance,
      annual_living_cost_growth: 30,
      high_stat_decay_threshold: 68,
      personal_life_recovery_threshold: 62,
      personal_life_monthly_stress_relief: 1,
    };

    const dani = CharacterSchema.parse(
      parseYaml(
        readFileSync(join(process.cwd(), "content/characters/empleado_junior_dani.yaml"), "utf8"),
      ),
    );
    const laura = CharacterSchema.parse(
      parseYaml(
        readFileSync(join(process.cwd(), "content/characters/empleada_senior_laura.yaml"), "utf8"),
      ),
    );
    expect(dani.employee_params).toEqual({
      role_label: "Junior Multiusos",
      monthly_cost: 1350,
      billing_multiplier: 1.58,
    });
    expect(laura.employee_params).toEqual({
      role_label: "Especialista sénior",
      monthly_cost: 2100,
      billing_multiplier: 2.05,
    });

    const base = createInitialGameState(catalog, { seed: "DEDUCTIBLE-AND-SAT" });

    // Employee satisfaction modulation: 75 -> 1.0x boost, 100 -> 1.2x boost, 25 -> 0.6x boost
    const unroundedSolo = 2250 * (0.75 + 0.35 * 0.7) * (0.7 + 0.75 * 0.45);
    const stateSat75 = {
      ...base,
      gestor: {
        tier: "premium" as const,
        character_id: "gestor_premium_elena",
        monthly_fee: 170,
        inspection_shield: 0.72,
        months_active: 3,
      },
      employee: {
        character_id: "empleada_senior_laura",
        role_label: laura.employee_params!.role_label,
        monthly_cost: laura.employee_params!.monthly_cost,
        billing_multiplier: laura.employee_params!.billing_multiplier,
        satisfaction: 75,
        months_employed: 2,
      },
    };
    const stateSat100 = {
      ...stateSat75,
      employee: { ...stateSat75.employee, satisfaction: 100 },
    };
    const stateSat25 = {
      ...stateSat75,
      employee: { ...stateSat75.employee, satisfaction: 25 },
    };

    expect(computeBaselineMonthlyBilling(stateSat75, catalog)).toBe(
      Math.round(unroundedSolo * 2.05),
    );
    expect(computeBaselineMonthlyBilling(stateSat100, catalog)).toBe(
      Math.round(unroundedSolo * (1 + (2.05 - 1) * 1.2)),
    );
    expect(computeBaselineMonthlyBilling(stateSat25, catalog)).toBe(
      Math.round(unroundedSolo * (1 + (2.05 - 1) * 0.6)),
    );

    // Deductible expenses: RETA (310) + Gestor (170) + Laura (2100) + max(0, modifierExpenseDelta)
    expect(computeMonthlyDeductibleExpenses(stateSat75, catalog)).toBe(310 + 170 + 2100);
    const withPosMod = {
      ...stateSat75,
      modifiers: [
        { id: "coworking", label: "Coworking", remaining_months: 2, monthly_expense_delta: 200 },
      ],
    };
    const withNegMod = {
      ...stateSat75,
      modifiers: [
        { id: "subvencion", label: "Descuento", remaining_months: 2, monthly_expense_delta: -150 },
      ],
    };
    expect(computeMonthlyDeductibleExpenses(withPosMod, catalog)).toBe(310 + 170 + 2100 + 200);
    expect(computeMonthlyDeductibleExpenses(withNegMod, catalog)).toBe(310 + 170 + 2100);

    // Annual cost-of-living creep: Year 1 (month 12) = +0, Year 2 (month 13) = +30, Year 10 (month 115) = +270
    // Post-victory_month (120) Endless taper at 0.5x: Year 12 (month 133, elapsedYears=11) = (9 + 2*0.5)*30 = +300
    expect(computeMonthlyRecurringExpenses({ ...base, month: 12 }, catalog)).toBe(1250 + 310);
    expect(computeMonthlyRecurringExpenses({ ...base, month: 13 }, catalog)).toBe(1250 + 30 + 310);
    expect(computeMonthlyRecurringExpenses({ ...base, month: 115 }, catalog)).toBe(
      1250 + 270 + 310,
    );
    expect(computeMonthlyRecurringExpenses({ ...base, month: 133 }, catalog)).toBe(
      1250 + 300 + 310,
    );

    // High-stat maintenance drift & personal_life >= 76 stress relief
    const highStatState = {
      ...stateSat75,
      indicators: {
        money: 10000,
        moral: 80,
        stress: 40,
        personal_life: 84,
        reputation: 75,
      },
      family: {
        ...stateSat75.family,
        support_modifier: 1,
      },
    };
    const drifted = applyRecurringMonthEconomy(highStatState, catalog);
    // personal_life = 84 >= 76 -> -2 stress + -1 partner support = -3 passiveStressDelta
    expect(drifted.passiveStressDelta).toBe(-3);
    expect(drifted.state.indicators.stress).toBe(37);
    // reputation 75 >= 68 -> 74; personal_life 84 >= 78 with employee -> 82; moral 80 >= 76 -> 77; employee sat 75 at stress 37 < 42 -> 76
    expect(drifted.state.indicators.reputation).toBe(74);
    expect(drifted.state.indicators.personal_life).toBe(82);
    expect(drifted.state.indicators.moral).toBe(77);
    expect(drifted.state.employee?.satisfaction).toBe(76);
    expect(drifted.maintenanceReputationDelta).toBe(-1);
    expect(drifted.maintenancePersonalLifeDelta).toBe(-2);
    expect(drifted.maintenanceMoralDelta).toBe(-3);

    // Starved employee crisis curve: 42..54 -> 0, 55..71 -> -2, >= 72 -> -4, plus -2 when desgaste_plantilla flag is active
    const midStressStaff = applyRecurringMonthEconomy(
      { ...stateSat75, indicators: { ...stateSat75.indicators, stress: 50, personal_life: 55 } },
      catalog,
    );
    expect(midStressStaff.state.employee?.satisfaction).toBe(75);

    const highStressStaff = applyRecurringMonthEconomy(
      { ...stateSat75, indicators: { ...stateSat75.indicators, stress: 60, personal_life: 55 } },
      catalog,
    );
    expect(highStressStaff.state.employee?.satisfaction).toBe(73);

    const burnoutStaffWithFlag = applyRecurringMonthEconomy(
      {
        ...stateSat75,
        flags: { desgaste_plantilla: true },
        indicators: { ...stateSat75.indicators, stress: 75, personal_life: 55 },
      },
      catalog,
    );
    expect(burnoutStaffWithFlag.state.employee?.satisfaction).toBe(69);
  });

  it("enforces Phase 3.6 balance.yaml starting cash window, Turn-1 personal_life buffer, tax-deductible parameters, and negative after-tax passive baseline", () => {
    const liveBalance = BalanceConfigSchema.parse(
      parseYaml(readFileSync(join(process.cwd(), "content/config/balance.yaml"), "utf8")),
    );
    expect(liveBalance.annual_living_cost_growth).toBe(64);
    expect(liveBalance.high_stat_decay_threshold).toBe(60);
    expect(liveBalance.event_novelty_decay_k).toBe(0.85);
    expect(liveBalance.initial_indicators.personal_life).toBe(68);
    expect(liveBalance.personal_life_recovery_threshold).toBe(50);
    expect(liveBalance.personal_life_monthly_stress_relief).toBe(1);
    expect(liveBalance.default_partner_support_modifier).toBe(1);
    expect(liveBalance.gestor_tiers.self).toMatchObject({
      quarterly_error_prob: 0.25,
      quarterly_error_surcharge: 240,
      quarterly_error_stress: 7,
    });
    expect(liveBalance.gestor_tiers.cheap.monthly_fee).toBe(60);
    expect(liveBalance.gestor_tiers.premium).toMatchObject({
      monthly_fee: 170,
      inspection_shield: 0.72,
    });
    expect(liveBalance.inspection_curve.min_fiscal_risk).toBe(15);
    expect(liveBalance.inspection_curve.quarterly_natural_risk_decay).toBe(3);

    const fixtureCatalog = createFixtureCatalog();
    const liveCatalog = {
      ...fixtureCatalog,
      balance: liveBalance,
    };

    const started = startNewRun(liveCatalog, { seed: "BALANCE-WINDOW-CHECK" });
    expect(started.state.indicators.money).toBeGreaterThanOrEqual(2900);
    expect(started.state.indicators.money).toBeLessThanOrEqual(3500);
    expect(started.state.indicators.personal_life).toBe(67);
    expect(started.state.indicators.personal_life).toBeGreaterThanOrEqual(
      liveBalance.personal_life_recovery_threshold,
    );
    expect(started.resolution.monthStart?.passive_stress_delta).toBe(-1);

    // Passive Month 1 cashflow after net tax reserve (even with deductible RETA shield) must be negative without client gigs
    const m1Summary = started.resolution.monthStart!;
    expect(m1Summary.deductible_expenses).toBe(liveBalance.autonomo_quota);
    expect(m1Summary.tax_shield_on_expenses).toBe(
      Math.round(liveBalance.autonomo_quota * liveBalance.deductible_tax_fraction),
    );
    const passiveAfterNetTax = m1Summary.net_recurring_cash - (m1Summary.net_tax_accrued ?? 0);
    expect(passiveAfterNetTax).toBeLessThan(0);
  });
});
