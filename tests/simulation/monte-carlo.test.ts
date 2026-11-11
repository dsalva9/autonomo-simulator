import { beforeAll, describe, expect, it } from "vitest";
import {
  type ChoiceSpec,
  type ContentCatalog,
  type EndingId,
  type EventCategory,
  type GameState,
  type MonthStartSummary,
  type PrngState,
  type VictoryDecision,
  applyPlayerChoice,
  canDeferQuarterlyTax,
  createPrng,
  dismissAnnualSummary,
  getActiveEvent,
  hasActiveRequirements,
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

type SimulationBot = BotArchetype | "PassiveRejectBot";

interface SimulationOptions {
  maxMonths?: number;
  victoryDecision?: VictoryDecision;
}

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
  endlessModeEntered: boolean;
  post120MonthsSimulated: number;
  post120EventsDrawn: number;
  starvedMonthsCount: number;
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
  bankruptcyCount: number;
  burnoutCount: number;
  endings: Record<string, number>;
}

const choiceImpactCache = new WeakMap<ChoiceSpec, ChoiceImpactEstimate>();

function estimateChoiceImpact(choice: ChoiceSpec): ChoiceImpactEstimate {
  const cached = choiceImpactCache.get(choice);
  if (cached) {
    return cached;
  }

  if (choice.effects) {
    const e = choice.effects;
    const computed: ChoiceImpactEstimate = {
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
    choiceImpactCache.set(choice, computed);
    return computed;
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

  const computed: ChoiceImpactEstimate = {
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
  choiceImpactCache.set(choice, computed);
  return computed;
}

function selectBotChoice(
  bot: SimulationBot,
  state: GameState,
  eligibleChoices: readonly ChoiceSpec[],
  botPrng: PrngState,
): { choiceId: string; botPrng: PrngState } {
  if (bot === "RandomBot") {
    const roll = nextInt(botPrng, 0, eligibleChoices.length - 1);
    return { choiceId: eligibleChoices[roll.value].id, botPrng: roll.prng };
  }

  if (bot === "PassiveRejectBot") {
    const unconditional = eligibleChoices.filter((c) => !hasActiveRequirements(c.requirements));
    const basePool = unconditional.length > 0 ? unconditional : eligibleChoices;
    const nonAbandon = basePool.filter((c) => !estimateChoiceImpact(c).triggersAbandon);
    const pool = nonAbandon.length > 0 ? nonAbandon : basePool;

    const sorted = [...pool].sort((a, b) => {
      const sa = estimateChoiceImpact(a);
      const sb = estimateChoiceImpact(b);
      const gigA = sa.billed + sa.deferredAmt + Math.max(0, sa.cash) + Math.max(0, sa.modBilled);
      const gigB = sb.billed + sb.deferredAmt + Math.max(0, sb.cash) + Math.max(0, sb.modBilled);
      if (gigA !== gigB) {
        return gigA - gigB;
      }
      if (state.indicators.stress >= 60 && sa.stress !== sb.stress) {
        return sa.stress - sb.stress;
      }
      const netCashA = sa.billed * 0.72 + sa.cash - sa.deductible * 0.72;
      const netCashB = sb.billed * 0.72 + sb.cash - sb.deductible * 0.72;
      return netCashA - netCashB;
    });
    return { choiceId: sorted[0].id, botPrng };
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
  bot: SimulationBot,
  seed: string,
  options: SimulationOptions = {},
): SingleRunMetrics {
  const maxMonths = options.maxMonths ?? 120;
  const victoryDecision = options.victoryDecision ?? "retire";

  let { state, resolution } = startNewRun(catalog, { seed });
  assertGameStateInvariants(state, seed);

  let botPrng = createPrng(`BOT-${bot}-${seed}`);
  const eventsSeen = new Set<string>();
  const categoriesSeen = new Set<EventCategory>();

  let peakMonthlyBilling = 0;
  let peakStress = state.indicators.stress;
  let peakFiscalRisk = state.fiscal_risk;
  let haciendaAuditOrSurchargeCount = 0;
  let invoicesPaid = 0;
  let invoicesDefaulted = 0;
  let quartersPaid = 0;
  let quartersDeferred = 0;
  let post120MonthsSimulated = 0;
  let post120EventsDrawn = 0;
  let starvedMonthsCount = 0;

  const recordMonthStart = (monthStart?: MonthStartSummary) => {
    if (!monthStart) {
      return;
    }
    peakMonthlyBilling = Math.max(peakMonthlyBilling, monthStart.gross_billing);
    for (const inv of monthStart.invoices_settled) {
      if (inv.paid) invoicesPaid += 1;
      else invoicesDefaulted += 1;
    }
    if (monthStart.drawn_events.length === 0) {
      starvedMonthsCount += 1;
    }
    if (monthStart.month > 120 && monthStart.month <= maxMonths) {
      post120MonthsSimulated += 1;
      post120EventsDrawn += monthStart.drawn_events.length;
    }
  };

  recordMonthStart(resolution.monthStart);

  let safetyCounter = 0;
  const maxSafetySteps = Math.max(2500, maxMonths * 20);
  while (state.phase !== "game_over" && state.month <= maxMonths) {
    safetyCounter += 1;
    if (safetyCounter > maxSafetySteps) {
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

      recordMonthStart(step.resolution.monthStart);
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
        bot === "PassiveRejectBot"
          ? false
          : bot === "AggressiveTaxDodgerBot"
            ? canDeferQuarterlyTax(state) &&
              state.indicators.money < state.finances.accrued_tax_liability * 1.4
            : state.indicators.money < state.finances.accrued_tax_liability &&
              canDeferQuarterlyTax(state);

      if (shouldDefer) quartersDeferred += 1;
      else quartersPaid += 1;

      const step = settleQuarter(state, catalog, shouldDefer ? "defer" : "pay");
      state = step.state;
      assertGameStateInvariants(state, seed);
      recordMonthStart(step.resolution.monthStart);
      continue;
    }

    if (state.phase === "victory_prompt") {
      const step = resolveVictoryPrompt(state, catalog, victoryDecision);
      state = step.state;
      assertGameStateInvariants(state, seed);
      recordMonthStart(step.resolution.monthStart);
      continue;
    }

    if (state.phase === "annual_summary") {
      const step = dismissAnnualSummary(state, catalog);
      state = step.state;
      assertGameStateInvariants(state, seed);
      recordMonthStart(step.resolution.monthStart);
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
    endlessModeEntered: state.endless_mode,
    post120MonthsSimulated,
    post120EventsDrawn,
    starvedMonthsCount,
    eventsSeen,
    categoriesSeen,
  };
}

describe("Phase 2 Monte Carlo simulation suite over rebalanced economy & 60-event catalog", () => {
  const allEventsSeen = new Set<string>();
  const allCategoriesSeen = new Set<EventCategory>();
  const distinctEndings = new Set<EndingId>();

  let totalInvoicesPaid = 0;
  let totalInvoicesDefaulted = 0;
  let totalQuartersPaid = 0;
  let totalQuartersDeferred = 0;
  let totalStarvedMonths = 0;
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
      let bankruptcyCount = 0;
      let burnoutCount = 0;
      const endings: Record<string, number> = {};

      for (let i = 0; i < runs; i += 1) {
        const m = runSingleSimulation(compiledCatalog, bot, `P2-${bot}-${i}`);
        if (m.survived) survivedCount += 1;
        if (m.endingId) {
          distinctEndings.add(m.endingId);
          endings[m.endingId] = (endings[m.endingId] ?? 0) + 1;
        }
        if (m.endingId === "defeat_bankruptcy") bankruptcyCount += 1;
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
        totalStarvedMonths += m.starvedMonthsCount;

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
        bankruptcyCount,
        burnoutCount,
        endings,
      };
    }

    summary = computed;
  }, 60_000);

  it("proves PassiveRejectBot achieves 0% 120-month survival and drains into bankruptcy without active gig work", () => {
    const passiveRuns = 100;
    let survivedCount = 0;
    let bankruptcyCount = 0;
    let sumFinalMoney = 0;

    for (let i = 0; i < passiveRuns; i += 1) {
      const m = runSingleSimulation(compiledCatalog, "PassiveRejectBot", `P2-PassiveReject-${i}`);
      if (m.survived) survivedCount += 1;
      if (m.endingId === "defeat_bankruptcy") bankruptcyCount += 1;
      sumFinalMoney += m.finalMoney;
    }

    expect(survivedCount).toBe(0);
    expect(bankruptcyCount).toBeGreaterThanOrEqual(85);
    expect(sumFinalMoney / passiveRuns).toBeLessThan(0);
  }, 30_000);

  it("executes 1,750 deterministic campaigns (1,000 RandomBot + 3×250 archetypes) with zero deadlocks, zero NaN/Infinity, and bit-exact replay determinism", () => {
    expect(summary.RandomBot.runs).toBe(1000);
    expect(summary.ConservativeLegalBot.runs).toBe(250);
    expect(summary.AggressiveTaxDodgerBot.runs).toBe(250);
    expect(summary.WorkaholicGrowthBot.runs).toBe(250);
    expect(totalStarvedMonths).toBe(0);

    const replay1 = runSingleSimulation(compiledCatalog, "RandomBot", "DETERMINISM-PHASE2-CHECK");
    const replay2 = runSingleSimulation(compiledCatalog, "RandomBot", "DETERMINISM-PHASE2-CHECK");
    expect(replay1.finalMonth).toBe(replay2.finalMonth);
    expect(replay1.finalMoney).toBe(replay2.finalMoney);
    expect(replay1.lifetimeBilled).toBe(replay2.lifetimeBilled);
    expect(replay1.endingId).toBe(replay2.endingId);
  });

  it("reaches all 5 categories, all 60 Phase 2 events, deferred invoices, quarterly settlements, and >= 6 distinct EndingIds", () => {
    expect(allCategoriesSeen).toEqual(
      new Set<EventCategory>(["clientes", "hacienda", "familia", "empleados", "gestor"]),
    );
    expect(allEventsSeen.size).toBe(60);
    expect(totalInvoicesPaid).toBeGreaterThan(100);
    expect(totalInvoicesDefaulted).toBeGreaterThan(10);
    expect(totalQuartersPaid).toBeGreaterThan(1000);
    expect(totalQuartersDeferred).toBeGreaterThan(20);
    expect(distinctEndings.size).toBeGreaterThanOrEqual(6);
  });

  it("maintains rebalanced survival bands (RandomBot 25%–65% with real bankruptcy & burnout; ConservativeLegalBot 65%–96% > AggressiveTaxDodgerBot)", () => {
    expect(summary.RandomBot.survivalRate).toBeGreaterThanOrEqual(0.25);
    expect(summary.RandomBot.survivalRate).toBeLessThanOrEqual(0.65);
    expect(summary.RandomBot.bankruptcyCount).toBeGreaterThan(0);
    expect(summary.RandomBot.burnoutCount).toBeGreaterThan(0);

    expect(summary.ConservativeLegalBot.survivalRate).toBeGreaterThanOrEqual(0.65);
    expect(summary.ConservativeLegalBot.survivalRate).toBeLessThanOrEqual(0.96);
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

  it("captures WorkaholicGrowthBot highest average peak monthly billing and higher burnout tension vs ConservativeLegalBot", () => {
    expect(summary.WorkaholicGrowthBot.avgPeakMonthlyBilling).toBeGreaterThan(
      summary.ConservativeLegalBot.avgPeakMonthlyBilling,
    );
    expect(summary.WorkaholicGrowthBot.avgPeakMonthlyBilling).toBeGreaterThan(
      summary.RandomBot.avgPeakMonthlyBilling,
    );
    expect(summary.WorkaholicGrowthBot.avgPeakMonthlyBilling).toBeGreaterThan(
      summary.AggressiveTaxDodgerBot.avgPeakMonthlyBilling,
    );
    expect(summary.WorkaholicGrowthBot.avgPeakStress).toBeGreaterThan(
      summary.ConservativeLegalBot.avgPeakStress,
    );
    expect(summary.WorkaholicGrowthBot.burnoutCount).toBeGreaterThan(
      summary.ConservativeLegalBot.burnoutCount,
    );
  });

  it("runs Endless Mode (180 months) campaigns cleanly past Month 120 without event starvation or crashes", () => {
    const endlessRuns = 50;
    let enteredEndlessCount = 0;
    let reached180Count = 0;
    let post120Months = 0;
    let post120Events = 0;
    let endlessStarvedMonths = 0;

    for (let i = 0; i < endlessRuns; i += 1) {
      const m = runSingleSimulation(compiledCatalog, "ConservativeLegalBot", `P2-Endless-${i}`, {
        maxMonths: 180,
        victoryDecision: "continue",
      });
      if (m.endlessModeEntered) enteredEndlessCount += 1;
      if (m.finalMonth > 180) reached180Count += 1;
      post120Months += m.post120MonthsSimulated;
      post120Events += m.post120EventsDrawn;
      endlessStarvedMonths += m.starvedMonthsCount;
    }

    expect(enteredEndlessCount).toBeGreaterThanOrEqual(25);
    expect(reached180Count).toBeGreaterThanOrEqual(15);
    expect(post120Months).toBeGreaterThanOrEqual(1000);
    expect(post120Events).toBeGreaterThanOrEqual(post120Months);
    expect(endlessStarvedMonths).toBe(0);
  }, 30_000);
});
