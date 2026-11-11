import { beforeAll, describe, expect, it } from "vitest";
import {
  type ChoiceSpec,
  type ContentCatalog,
  type EndingId,
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
import { compiledCatalog } from "../../src/services/content/catalog.ts";

type BotArchetype =
  | "RandomBot"
  | "ConservativeLegalBot"
  | "AggressiveTaxDodgerBot"
  | "WorkaholicGrowthBot";

interface ChoiceImpactEstimate {
  billed: number;
  cash: number;
  deductible: number;
  deferredAmt: number;
  stress: number;
  moral: number;
  personalLife: number;
  reputation: number;
  fiscalRisk: number;
  modBilled: number;
  modStress: number;
  gestorTier: "self" | "cheap" | "premium" | null;
  hiresEmployee: boolean;
  dismissesEmployee: boolean;
  triggersAbandon: boolean;
  isOutcomeRoll: boolean;
}

interface SingleRunMetrics {
  survived: boolean;
  finalMonth: number;
  endingId: EndingId | null;
  finalMoney: number;
  lifetimeBilled: number;
  peakMonthlyBilling: number;
  peakStress: number;
  peakFiscalRisk: number;
  haciendaAuditOrSurchargeCount: number;
  invoicesPaid: number;
  invoicesDefaulted: number;
  quartersPaid: number;
  quartersDeferred: number;
  eventsSeen: Set<string>;
  categoriesSeen: Set<EventCategory>;
}

interface ArchetypeAggregate {
  runs: number;
  survivedCount: number;
  survivalRate: number;
  avgLifetimeBilled: number;
  avgPeakMonthlyBilling: number;
  avgPeakStress: number;
  avgPeakFiscalRisk: number;
  auditsPerQuarter: number;
  burnoutCount: number;
  endings: Record<string, number>;
}

function estimateChoiceImpact(choice: ChoiceSpec): ChoiceImpactEstimate {
  if (choice.effects) {
    const e = choice.effects;
    return {
      billed: e.billed_income ?? 0,
      cash: e.cash_delta ?? 0,
      deductible: e.deductible_expense ?? 0,
      deferredAmt: e.deferred_invoice?.amount ?? 0,
      stress: e.stress ?? 0,
      moral: e.moral ?? 0,
      personalLife: e.personal_life ?? 0,
      reputation: e.reputation ?? 0,
      fiscalRisk: e.fiscal_risk ?? 0,
      modBilled:
        (e.add_modifier?.monthly_billed_delta ?? 0) * (e.add_modifier?.remaining_months ?? 0),
      modStress:
        (e.add_modifier?.monthly_stress_delta ?? 0) * (e.add_modifier?.remaining_months ?? 0),
      gestorTier: e.set_gestor?.tier ?? null,
      hiresEmployee: Boolean(e.hire_employee),
      dismissesEmployee: Boolean(e.dismiss_employee),
      triggersAbandon: Boolean(e.trigger_ending),
      isOutcomeRoll: false,
    };
  }

  const outcomes = choice.outcomes ?? [];
  const totalWeight = outcomes.reduce((sum, o) => sum + o.weight, 0) || 1;
  let billed = 0;
  let cash = 0;
  let deductible = 0;
  let deferredAmt = 0;
  let stress = 0;
  let moral = 0;
  let personalLife = 0;
  let reputation = 0;
  let fiscalRisk = 0;
  let modBilled = 0;
  let modStress = 0;
  let gestorTier: "self" | "cheap" | "premium" | null = null;
  let hiresEmployee = false;
  let dismissesEmployee = false;
  let triggersAbandon = false;

  for (const outcome of outcomes) {
    const w = outcome.weight / totalWeight;
    const e = outcome.effects;
    billed += (e.billed_income ?? 0) * w;
    cash += (e.cash_delta ?? 0) * w;
    deductible += (e.deductible_expense ?? 0) * w;
    deferredAmt += (e.deferred_invoice?.amount ?? 0) * w;
    stress += (e.stress ?? 0) * w;
    moral += (e.moral ?? 0) * w;
    personalLife += (e.personal_life ?? 0) * w;
    reputation += (e.reputation ?? 0) * w;
    fiscalRisk += (e.fiscal_risk ?? 0) * w;
    modBilled +=
      (e.add_modifier?.monthly_billed_delta ?? 0) * (e.add_modifier?.remaining_months ?? 0) * w;
    modStress +=
      (e.add_modifier?.monthly_stress_delta ?? 0) * (e.add_modifier?.remaining_months ?? 0) * w;
    if (e.set_gestor) {
      gestorTier = e.set_gestor.tier;
    }
    if (e.hire_employee) {
      hiresEmployee = true;
    }
    if (e.dismiss_employee) {
      dismissesEmployee = true;
    }
    if (e.trigger_ending) {
      triggersAbandon = true;
    }
  }

  return {
    billed,
    cash,
    deductible,
    deferredAmt,
    stress,
    moral,
    personalLife,
    reputation,
    fiscalRisk,
    modBilled,
    modStress,
    gestorTier,
    hiresEmployee,
    dismissesEmployee,
    triggersAbandon,
    isOutcomeRoll: true,
  };
}

function selectBotChoice(
  bot: BotArchetype,
  state: GameState,
  eligibleChoices: readonly ChoiceSpec[],
  botPrng: PrngState,
): { choiceId: string; botPrng: PrngState } {
  if (bot === "RandomBot") {
    const roll = nextInt(botPrng, 0, eligibleChoices.length - 1);
    return { choiceId: eligibleChoices[roll.value].id, botPrng: roll.prng };
  }

  const nonAbandon = eligibleChoices.filter((c) => !estimateChoiceImpact(c).triggersAbandon);
  const choices = nonAbandon.length > 0 ? nonAbandon : eligibleChoices;

  if (bot === "ConservativeLegalBot") {
    if (state.indicators.stress >= 58) {
      const relief = [...choices]
        .filter((c) => {
          const est = estimateChoiceImpact(c);
          return est.stress < 0 && est.fiscalRisk <= 0;
        })
        .sort((a, b) => estimateChoiceImpact(a).stress - estimateChoiceImpact(b).stress)[0];
      if (relief) {
        return { choiceId: relief.id, botPrng };
      }
    }

    const upgradeGestor = choices.find((c) => {
      const est = estimateChoiceImpact(c);
      return (
        (est.gestorTier === "premium" && state.indicators.money >= 6000) ||
        (est.gestorTier === "cheap" && state.gestor.tier === "self")
      );
    });
    if (upgradeGestor) {
      return { choiceId: upgradeGestor.id, botPrng };
    }

    const legalPool = choices.filter((c) => {
      const est = estimateChoiceImpact(c);
      return est.fiscalRisk <= 0 && !est.hiresEmployee && est.gestorTier !== "self";
    });
    const pool = legalPool.length > 0 ? legalPool : choices;
    const sorted = [...pool].sort((a, b) => {
      const sa = estimateChoiceImpact(a);
      const sb = estimateChoiceImpact(b);
      const valA =
        sa.billed * 0.72 +
        sa.cash -
        sa.deductible * 0.5 -
        sa.stress * 60 +
        sa.moral * 40 -
        sa.fiscalRisk * 200;
      const valB =
        sb.billed * 0.72 +
        sb.cash -
        sb.deductible * 0.5 -
        sb.stress * 60 +
        sb.moral * 40 -
        sb.fiscalRisk * 200;
      return valB - valA;
    });
    return { choiceId: sorted[0].id, botPrng };
  }

  if (bot === "AggressiveTaxDodgerBot") {
    if (state.indicators.stress >= 76) {
      const relief = [...choices]
        .filter((c) => estimateChoiceImpact(c).stress < 0)
        .sort((a, b) => estimateChoiceImpact(a).stress - estimateChoiceImpact(b).stress)[0];
      if (relief) {
        return { choiceId: relief.id, botPrng };
      }
    }

    const sorted = [...choices].sort((a, b) => {
      const sa = estimateChoiceImpact(a);
      const sb = estimateChoiceImpact(b);
      const scoreA =
        (sa.fiscalRisk > 0 ? 2500 + sa.fiscalRisk * 120 : 0) +
        sa.cash * 1.4 +
        sa.billed * 0.5 -
        sa.deductible * 1.8 +
        (sa.gestorTier === "self" ? 1800 : sa.gestorTier === "premium" ? -2500 : 0) +
        (sa.isOutcomeRoll ? 600 : 0);
      const scoreB =
        (sb.fiscalRisk > 0 ? 2500 + sb.fiscalRisk * 120 : 0) +
        sb.cash * 1.4 +
        sb.billed * 0.5 -
        sb.deductible * 1.8 +
        (sb.gestorTier === "self" ? 1800 : sb.gestorTier === "premium" ? -2500 : 0) +
        (sb.isOutcomeRoll ? 600 : 0);
      return scoreB - scoreA;
    });
    return { choiceId: sorted[0].id, botPrng };
  }

  // WorkaholicGrowthBot
  if (state.indicators.stress >= 86) {
    const relief = [...choices]
      .filter((c) => estimateChoiceImpact(c).stress < 0)
      .sort((a, b) => estimateChoiceImpact(a).stress - estimateChoiceImpact(b).stress)[0];
    if (relief) {
      return { choiceId: relief.id, botPrng };
    }
  }

  const sorted = [...choices].sort((a, b) => {
    const sa = estimateChoiceImpact(a);
    const sb = estimateChoiceImpact(b);
    const revA =
      sa.billed +
      sa.deferredAmt +
      Math.max(0, sa.cash) +
      Math.max(0, sa.modBilled) +
      sa.reputation * 220 +
      (sa.hiresEmployee ? 4500 : 0) -
      (sa.dismissesEmployee ? 4000 : 0);
    const revB =
      sb.billed +
      sb.deferredAmt +
      Math.max(0, sb.cash) +
      Math.max(0, sb.modBilled) +
      sb.reputation * 220 +
      (sb.hiresEmployee ? 4500 : 0) -
      (sb.dismissesEmployee ? 4000 : 0);
    return revB - revA;
  });
  return { choiceId: sorted[0].id, botPrng };
}

function assertGameStateInvariants(state: GameState, seed: string): void {
  const { indicators, finances, fiscal_risk } = state;
  const numericValues = [
    state.month,
    indicators.money,
    indicators.moral,
    indicators.stress,
    indicators.personal_life,
    indicators.reputation,
    fiscal_risk,
    finances.lifetime_billed,
    finances.current_quarter_billed,
    finances.accrued_tax_liability,
    finances.consecutive_negative_months,
  ];

  for (const val of numericValues) {
    if (!Number.isFinite(val) || !Number.isInteger(val)) {
      throw new Error(`Invariant violation on '${seed}': non-integer or NaN/Infinity value ${val}`);
    }
  }

  for (const bounded of [
    indicators.moral,
    indicators.stress,
    indicators.personal_life,
    indicators.reputation,
    fiscal_risk,
  ]) {
    if (bounded < 0 || bounded > 100) {
      throw new Error(`Invariant violation on '${seed}': bounded stat out of [0,100]: ${bounded}`);
    }
  }
}

function runSingleSimulation(
  catalog: ContentCatalog,
  bot: BotArchetype,
  seed: string,
  maxMonths = 120,
): SingleRunMetrics {
  let { state, resolution } = startNewRun(catalog, { seed });
  assertGameStateInvariants(state, seed);

  let botPrng = createPrng(`BOT-${bot}-${seed}`);
  const eventsSeen = new Set<string>();
  const categoriesSeen = new Set<EventCategory>();

  let peakMonthlyBilling = resolution.monthStart?.gross_billing ?? 0;
  let peakStress = state.indicators.stress;
  let peakFiscalRisk = state.fiscal_risk;
  let haciendaAuditOrSurchargeCount = 0;
  let invoicesPaid = 0;
  let invoicesDefaulted = 0;
  let quartersPaid = 0;
  let quartersDeferred = 0;

  for (const inv of resolution.monthStart?.invoices_settled ?? []) {
    if (inv.paid) invoicesPaid += 1;
    else invoicesDefaulted += 1;
  }

  let safetyCounter = 0;
  while (state.phase !== "game_over" && state.month <= maxMonths) {
    safetyCounter += 1;
    if (safetyCounter > 2000) {
      throw new Error(
        `Deadlock detected on seed '${seed}' at month ${state.month} (${state.phase})`,
      );
    }

    peakStress = Math.max(peakStress, state.indicators.stress);
    peakFiscalRisk = Math.max(peakFiscalRisk, state.fiscal_risk);

    if (state.phase === "event_resolution") {
      const active = getActiveEvent(state, catalog);
      if (!active) {
        throw new Error(`Missing active event on seed '${seed}' at month ${state.month}`);
      }
      eventsSeen.add(active.event.id);
      categoriesSeen.add(active.event.category);

      if (
        active.event.id === "hacienda_carta_certificada" ||
        active.event.id === "hacienda_acta_inspeccion" ||
        active.event.id === "hacienda_recargo_extemporaneo"
      ) {
        haciendaAuditOrSurchargeCount += 1;
      }

      const eligible = active.choices.filter((c) => c.eligible).map((c) => c.choice);
      if (eligible.length === 0) {
        throw new Error(`Softlock: zero eligible choices on event '${active.event.id}'`);
      }

      const picked = selectBotChoice(bot, state, eligible, botPrng);
      botPrng = picked.botPrng;
      const step = applyPlayerChoice(state, catalog, picked.choiceId);
      state = step.state;
      assertGameStateInvariants(state, seed);

      if (step.resolution.monthStart) {
        peakMonthlyBilling = Math.max(peakMonthlyBilling, step.resolution.monthStart.gross_billing);
        for (const inv of step.resolution.monthStart.invoices_settled) {
          if (inv.paid) invoicesPaid += 1;
          else invoicesDefaulted += 1;
        }
      }
      if (step.resolution.quarterlyReport) {
        const surcharge =
          step.resolution.quarterlyReport.gestor_error_surcharge +
          step.resolution.quarterlyReport.inspection_fallback_fine;
        if (step.resolution.quarterlyReport.inspection_triggered || surcharge > 0) {
          haciendaAuditOrSurchargeCount += 1;
        }
      }
      continue;
    }

    if (state.phase === "quarterly_tax") {
      const shouldDefer =
        bot === "AggressiveTaxDodgerBot"
          ? canDeferQuarterlyTax(state) &&
            state.indicators.money < state.finances.accrued_tax_liability * 1.4
          : state.indicators.money < state.finances.accrued_tax_liability &&
            canDeferQuarterlyTax(state);

      if (shouldDefer) quartersDeferred += 1;
      else quartersPaid += 1;

      const step = settleQuarter(state, catalog, shouldDefer ? "defer" : "pay");
      state = step.state;
      assertGameStateInvariants(state, seed);

      if (step.resolution.monthStart) {
        peakMonthlyBilling = Math.max(peakMonthlyBilling, step.resolution.monthStart.gross_billing);
        for (const inv of step.resolution.monthStart.invoices_settled) {
          if (inv.paid) invoicesPaid += 1;
          else invoicesDefaulted += 1;
        }
      }
      continue;
    }

    if (state.phase === "victory_prompt") {
      const step = resolveVictoryPrompt(state, catalog, "retire");
      state = step.state;
      assertGameStateInvariants(state, seed);
      continue;
    }

    if (state.phase === "annual_summary") {
      const step = dismissAnnualSummary(state, catalog);
      state = step.state;
      assertGameStateInvariants(state, seed);
      if (step.resolution.monthStart) {
        peakMonthlyBilling = Math.max(peakMonthlyBilling, step.resolution.monthStart.gross_billing);
        for (const inv of step.resolution.monthStart.invoices_settled) {
          if (inv.paid) invoicesPaid += 1;
          else invoicesDefaulted += 1;
        }
      }
    }
  }

  peakStress = Math.max(peakStress, state.indicators.stress);
  peakFiscalRisk = Math.max(peakFiscalRisk, state.fiscal_risk);

  const survived =
    state.earned_victories.includes("hero_120m") ||
    state.earned_victories.includes("rich_150k") ||
    (state.phase !== "game_over" && state.month > maxMonths);

  return {
    survived,
    finalMonth: state.month,
    endingId: state.ending?.id ?? null,
    finalMoney: state.indicators.money,
    lifetimeBilled: state.finances.lifetime_billed,
    peakMonthlyBilling,
    peakStress,
    peakFiscalRisk,
    haciendaAuditOrSurchargeCount,
    invoicesPaid,
    invoicesDefaulted,
    quartersPaid,
    quartersDeferred,
    eventsSeen,
    categoriesSeen,
  };
}

describe("Phase 1 Monte Carlo simulation suite over compiled 42-event catalog", () => {
  const allEventsSeen = new Set<string>();
  const allCategoriesSeen = new Set<EventCategory>();
  const distinctEndings = new Set<EndingId>();

  let totalInvoicesPaid = 0;
  let totalInvoicesDefaulted = 0;
  let totalQuartersPaid = 0;
  let totalQuartersDeferred = 0;
  let summary!: Record<BotArchetype, ArchetypeAggregate>;

  beforeAll(() => {
    const runCounts: Record<BotArchetype, number> = {
      RandomBot: 1000,
      ConservativeLegalBot: 250,
      AggressiveTaxDodgerBot: 250,
      WorkaholicGrowthBot: 250,
    };

    const computed = {} as Record<BotArchetype, ArchetypeAggregate>;

    for (const bot of Object.keys(runCounts) as BotArchetype[]) {
      const runs = runCounts[bot];
      let survivedCount = 0;
      let sumLifetimeBilled = 0;
      let sumPeakMonthly = 0;
      let sumPeakStress = 0;
      let sumPeakFiscal = 0;
      let sumAudits = 0;
      let sumQuarters = 0;
      let burnoutCount = 0;
      const endings: Record<string, number> = {};

      for (let i = 0; i < runs; i += 1) {
        const m = runSingleSimulation(compiledCatalog, bot, `P1-${bot}-${i}`);
        if (m.survived) survivedCount += 1;
        if (m.endingId) {
          distinctEndings.add(m.endingId);
          endings[m.endingId] = (endings[m.endingId] ?? 0) + 1;
        }
        if (m.endingId === "defeat_burnout_stress") burnoutCount += 1;

        sumLifetimeBilled += m.lifetimeBilled;
        sumPeakMonthly += m.peakMonthlyBilling;
        sumPeakStress += m.peakStress;
        sumPeakFiscal += m.peakFiscalRisk;
        sumAudits += m.haciendaAuditOrSurchargeCount;
        sumQuarters += m.quartersPaid + m.quartersDeferred;

        totalInvoicesPaid += m.invoicesPaid;
        totalInvoicesDefaulted += m.invoicesDefaulted;
        totalQuartersPaid += m.quartersPaid;
        totalQuartersDeferred += m.quartersDeferred;

        for (const evId of m.eventsSeen) allEventsSeen.add(evId);
        for (const cat of m.categoriesSeen) allCategoriesSeen.add(cat);
      }

      computed[bot] = {
        runs,
        survivedCount,
        survivalRate: survivedCount / runs,
        avgLifetimeBilled: sumLifetimeBilled / runs,
        avgPeakMonthlyBilling: sumPeakMonthly / runs,
        avgPeakStress: sumPeakStress / runs,
        avgPeakFiscalRisk: sumPeakFiscal / runs,
        auditsPerQuarter: sumAudits / Math.max(1, sumQuarters),
        burnoutCount,
        endings,
      };
    }

    summary = computed;
  });

  it("executes 1,750 deterministic campaigns (1,000 RandomBot + 3×250 archetypes) with zero deadlocks, zero NaN/Infinity, and bit-exact replay determinism", () => {
    expect(summary.RandomBot.runs).toBe(1000);
    expect(summary.ConservativeLegalBot.runs).toBe(250);
    expect(summary.AggressiveTaxDodgerBot.runs).toBe(250);
    expect(summary.WorkaholicGrowthBot.runs).toBe(250);

    const replay1 = runSingleSimulation(compiledCatalog, "RandomBot", "DETERMINISM-PHASE1-CHECK");
    const replay2 = runSingleSimulation(compiledCatalog, "RandomBot", "DETERMINISM-PHASE1-CHECK");
    expect(replay1.finalMonth).toBe(replay2.finalMonth);
    expect(replay1.finalMoney).toBe(replay2.finalMoney);
    expect(replay1.lifetimeBilled).toBe(replay2.lifetimeBilled);
    expect(replay1.endingId).toBe(replay2.endingId);
  });

  it("reaches all 5 categories, all 42 Phase 1 events, deferred invoices, quarterly settlements, and >= 6 distinct EndingIds", () => {
    expect(allCategoriesSeen).toEqual(
      new Set<EventCategory>(["clientes", "hacienda", "familia", "empleados", "gestor"]),
    );
    expect(allEventsSeen.size).toBe(42);
    expect(totalInvoicesPaid).toBeGreaterThan(100);
    expect(totalInvoicesDefaulted).toBeGreaterThan(10);
    expect(totalQuartersPaid).toBeGreaterThan(1000);
    expect(totalQuartersDeferred).toBeGreaterThan(20);
    expect(distinctEndings.size).toBeGreaterThanOrEqual(6);
  });

  it("maintains healthy RandomBot survival (25%–75%) and rewards ConservativeLegalBot over AggressiveTaxDodgerBot", () => {
    expect(summary.RandomBot.survivalRate).toBeGreaterThanOrEqual(0.25);
    expect(summary.RandomBot.survivalRate).toBeLessThanOrEqual(0.75);

    expect(summary.ConservativeLegalBot.survivalRate).toBeGreaterThan(
      summary.AggressiveTaxDodgerBot.survivalRate + 0.25,
    );
    expect(summary.ConservativeLegalBot.avgPeakFiscalRisk).toBeLessThan(
      summary.AggressiveTaxDodgerBot.avgPeakFiscalRisk,
    );
    expect(summary.ConservativeLegalBot.auditsPerQuarter).toBeLessThan(
      summary.AggressiveTaxDodgerBot.auditsPerQuarter,
    );
  });

  it("captures WorkaholicGrowthBot higher peak revenue and higher burnout tension vs ConservativeLegalBot", () => {
    expect(summary.WorkaholicGrowthBot.avgPeakMonthlyBilling).toBeGreaterThan(
      summary.ConservativeLegalBot.avgPeakMonthlyBilling,
    );
    expect(summary.WorkaholicGrowthBot.avgPeakMonthlyBilling).toBeGreaterThan(
      summary.RandomBot.avgPeakMonthlyBilling,
    );
    expect(summary.WorkaholicGrowthBot.avgPeakStress).toBeGreaterThan(
      summary.ConservativeLegalBot.avgPeakStress,
    );
    expect(summary.WorkaholicGrowthBot.burnoutCount).toBeGreaterThan(
      summary.ConservativeLegalBot.burnoutCount,
    );
  });
});
