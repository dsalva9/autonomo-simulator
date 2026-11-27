import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import {
  BalanceConfigSchema,
  type BusinessTier,
  CharacterSchema,
  type ChoiceSpec,
  type ContentCatalog,
  type EndingId,
  type EventCategory,
  type EventDef,
  type GameState,
  type MonthStartSummary,
  type PrngState,
  type VictoryDecision,
  applyPlayerChoice,
  canDeferQuarterlyTax,
  createPrng,
  dismissAnnualSummary,
  getActiveEvent,
  getBusinessTierConfig,
  getTeamHeadcount,
  hasActiveRequirements,
  nextInt,
  resolveVictoryPrompt,
  settleQuarter,
  startNewRun,
} from "../../src/engine/index.ts";
import { compiledCatalog } from "../../src/services/content/catalog.ts";

const authoritativeBalance = BalanceConfigSchema.parse(
  parseYaml(readFileSync(join(process.cwd(), "content/config/balance.yaml"), "utf8")),
);
const authoritativeDani = CharacterSchema.parse(
  parseYaml(
    readFileSync(join(process.cwd(), "content/characters/empleado_junior_dani.yaml"), "utf8"),
  ),
);
const authoritativeLaura = CharacterSchema.parse(
  parseYaml(
    readFileSync(join(process.cwd(), "content/characters/empleada_senior_laura.yaml"), "utf8"),
  ),
);

const simulationCatalog: ContentCatalog = {
  ...compiledCatalog,
  balance: authoritativeBalance,
  characters: {
    ...compiledCatalog.characters,
    empleado_junior_dani: authoritativeDani,
    empleada_senior_laura: authoritativeLaura,
  },
};

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
  employeeSatisfaction: number;
  modBilled: number;
  modExpense: number;
  modStress: number;
  gestorTier: "self" | "cheap" | "premium" | null;
  hiresEmployee: boolean;
  dismissesEmployee: boolean;
  setBusinessTier: BusinessTier | null;
  expandTeamCount: number;
  shrinkTeamCount: number;
  triggersAbandon: boolean;
  isOutcomeRoll: boolean;
}

interface SingleRunMetrics {
  survived: boolean;
  rich250kUnlocked: boolean;
  pinnedMaxStats: boolean;
  finalMonth: number;
  endingId: EndingId | null;
  finalMoney: number;
  lifetimeBilled: number;
  peakMonthlyBilling: number;
  peakStress: number;
  peakFiscalRisk: number;
  peakHeadcount: number;
  hadElena: boolean;
  prescribedClean: boolean;
  haciendaAuditOrSurchargeCount: number;
  historicalAuditCount: number;
  elenaComplianceWarnings: number;
  elenaComplianceDrops: number;
  invoicesPaid: number;
  invoicesDefaulted: number;
  quartersPaid: number;
  quartersDeferred: number;
  endlessModeEntered: boolean;
  post120MonthsSimulated: number;
  post120EventsDrawn: number;
  starvedMonthsCount: number;
  postChoiceTotalCount: number;
  postChoiceMoral100Count: number;
  eventsSeen: Set<string>;
  categoriesSeen: Set<EventCategory>;
  tiersReached: Set<BusinessTier>;
}

interface ArchetypeAggregate {
  runs: number;
  survivedCount: number;
  survivalRate: number;
  rich250kCount: number;
  rich250kRate: number;
  pinnedMaxStatsCount: number;
  postChoiceMoral100Rate: number;
  avgLifetimeBilled: number;
  avgPeakMonthlyBilling: number;
  avgSurvivingCash: number;
  avgPeakStress: number;
  avgPeakFiscalRisk: number;
  avgPeakHeadcount: number;
  headcount4PlusRuns: number;
  headcount5PlusRuns: number;
  elenaRuns: number;
  elenaSurvivalRate: number;
  auditsPerQuarter: number;
  historicalAuditCount: number;
  prescribedCleanRuns: number;
  elenaComplianceWarnings: number;
  elenaComplianceDrops: number;
  bankruptcyCount: number;
  burnoutCount: number;
  resignationMoralCount: number;
  tierReachCounts: Record<BusinessTier, number>;
  endings: Record<string, number>;
}

const TIER_RANK: Record<BusinessTier, number> = {
  solo_autonomo: 0,
  estudio_consolidado: 1,
  sociedad_limitada: 2,
  agencia_consultora: 3,
};

const choiceImpactCache = new WeakMap<ChoiceSpec, ChoiceImpactEstimate>();

function estimateChoiceImpact(choice: ChoiceSpec): ChoiceImpactEstimate {
  const cached = choiceImpactCache.get(choice);
  if (cached) {
    return cached;
  }

  const acc: ChoiceImpactEstimate = {
    billed: 0,
    cash: 0,
    deductible: 0,
    deferredAmt: 0,
    stress: 0,
    moral: 0,
    personalLife: 0,
    reputation: 0,
    fiscalRisk: 0,
    employeeSatisfaction: 0,
    modBilled: 0,
    modExpense: 0,
    modStress: 0,
    gestorTier: null,
    hiresEmployee: false,
    dismissesEmployee: false,
    setBusinessTier: null,
    expandTeamCount: 0,
    shrinkTeamCount: 0,
    triggersAbandon: false,
    isOutcomeRoll: !choice.effects,
  };

  const blocks = choice.effects
    ? [{ w: 1, e: choice.effects }]
    : (() => {
        const outcomes = choice.outcomes ?? [];
        const totalWeight = outcomes.reduce((sum, o) => sum + o.weight, 0) || 1;
        return outcomes.map((o) => ({ w: o.weight / totalWeight, e: o.effects }));
      })();

  for (const { w, e } of blocks) {
    acc.billed += (e.billed_income ?? 0) * w;
    acc.cash += (e.cash_delta ?? 0) * w;
    acc.deductible += (e.deductible_expense ?? 0) * w;
    acc.deferredAmt += (e.deferred_invoice?.amount ?? 0) * w;
    acc.stress += (e.stress ?? 0) * w;
    acc.moral += (e.moral ?? 0) * w;
    acc.personalLife += (e.personal_life ?? 0) * w;
    acc.reputation += (e.reputation ?? 0) * w;
    acc.fiscalRisk += (e.fiscal_risk ?? 0) * w;
    acc.employeeSatisfaction += (e.employee_satisfaction ?? 0) * w;
    acc.modBilled +=
      (e.add_modifier?.monthly_billed_delta ?? 0) * (e.add_modifier?.remaining_months ?? 0) * w;
    acc.modExpense +=
      (e.add_modifier?.monthly_expense_delta ?? 0) * (e.add_modifier?.remaining_months ?? 0) * w;
    acc.modStress +=
      (e.add_modifier?.monthly_stress_delta ?? 0) * (e.add_modifier?.remaining_months ?? 0) * w;
    if (e.set_gestor) {
      acc.gestorTier = e.set_gestor.tier;
    }
    if (e.hire_employee) {
      acc.hiresEmployee = true;
    }
    if (e.dismiss_employee) {
      acc.dismissesEmployee = true;
    }
    if (e.set_business_tier) {
      acc.setBusinessTier = e.set_business_tier.tier;
    } else if (e.set_flags?.includes("sociedad_limitada_activa") && !acc.setBusinessTier) {
      acc.setBusinessTier = "sociedad_limitada";
    }
    if (e.expand_team) {
      acc.expandTeamCount += e.expand_team.count * w;
    }
    if (e.shrink_team) {
      acc.shrinkTeamCount += (e.shrink_team.dismiss_all ? 12 : e.shrink_team.count) * w;
    }
    if (e.trigger_ending) {
      acc.triggersAbandon = true;
    }
  }

  choiceImpactCache.set(choice, acc);
  return acc;
}

function selectBotChoice(
  catalog: ContentCatalog,
  bot: SimulationBot,
  state: GameState,
  event: EventDef,
  eligibleChoices: readonly ChoiceSpec[],
  botPrng: PrngState,
): { choiceId: string; botPrng: PrngState } {
  const stakeMult = event.scale_with_tier
    ? getBusinessTierConfig(state, catalog).event_stakes_multiplier
    : 1;

  if (bot === "RandomBot") {
    const roll = nextInt(botPrng, 0, eligibleChoices.length - 1);
    return { choiceId: eligibleChoices[roll.value]!.id, botPrng: roll.prng };
  }

  if (bot === "PassiveRejectBot") {
    const unconditional = eligibleChoices.filter((c) => !hasActiveRequirements(c.requirements));
    const basePool = unconditional.length > 0 ? unconditional : eligibleChoices;
    const nonAbandon = basePool.filter((c) => !estimateChoiceImpact(c).triggersAbandon);
    const pool = nonAbandon.length > 0 ? nonAbandon : basePool;

    const sorted = [...pool].sort((a, b) => {
      const sa = estimateChoiceImpact(a);
      const sb = estimateChoiceImpact(b);
      const gigA =
        (sa.billed + sa.deferredAmt + Math.max(0, sa.cash) + Math.max(0, sa.modBilled)) * stakeMult;
      const gigB =
        (sb.billed + sb.deferredAmt + Math.max(0, sb.cash) + Math.max(0, sb.modBilled)) * stakeMult;
      if (gigA !== gigB) {
        return gigA - gigB;
      }
      if (state.indicators.stress >= 60 && sa.stress !== sb.stress) {
        return sa.stress - sb.stress;
      }
      const netCashA = (sa.billed * 0.72 + sa.cash - sa.deductible * 0.72) * stakeMult;
      const netCashB = (sb.billed * 0.72 + sb.cash - sb.deductible * 0.72) * stakeMult;
      return netCashA - netCashB;
    });
    return { choiceId: sorted[0]!.id, botPrng };
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
      return (
        est.fiscalRisk <= 0 &&
        !est.hiresEmployee &&
        est.expandTeamCount === 0 &&
        est.gestorTier !== "self"
      );
    });
    const pool = legalPool.length > 0 ? legalPool : choices;
    const sorted = [...pool].sort((a, b) => {
      const sa = estimateChoiceImpact(a);
      const sb = estimateChoiceImpact(b);
      const valA =
        (sa.billed * 0.72 + sa.cash - sa.deductible * 0.5) * stakeMult -
        sa.stress * 60 +
        sa.moral * 40 -
        sa.fiscalRisk * 200;
      const valB =
        (sb.billed * 0.72 + sb.cash - sb.deductible * 0.5) * stakeMult -
        sb.stress * 60 +
        sb.moral * 40 -
        sb.fiscalRisk * 200;
      return valB - valA;
    });
    return { choiceId: sorted[0]!.id, botPrng };
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
      const score = (s: ChoiceImpactEstimate) =>
        (s.fiscalRisk > 0 ? 2200 + s.fiscalRisk * 100 : 0) +
        (s.cash * 1.45 +
          s.billed * 0.5 +
          s.deferredAmt * 0.4 -
          s.deductible * 1.3 +
          s.modBilled * 0.4 -
          s.modExpense * 0.7) *
          stakeMult +
        (s.gestorTier === "cheap"
          ? 2000
          : s.gestorTier === "self"
            ? 600
            : s.gestorTier === "premium"
              ? -2500
              : 0) +
        (s.isOutcomeRoll ? 450 : 0) -
        s.stress * 20 +
        s.moral * 25;
      return score(sb) - score(sa);
    });
    return { choiceId: sorted[0]!.id, botPrng };
  }

  // WorkaholicGrowthBot: actively scales Solo -> Estudio -> S.L. -> Agencia (4-10+ staff) while pushing burnout/payroll limits
  if (state.indicators.stress >= 90) {
    const relief = [...choices]
      .filter((c) => {
        const est = estimateChoiceImpact(c);
        return est.stress < 0 && !est.dismissesEmployee && est.shrinkTeamCount === 0;
      })
      .sort((a, b) => estimateChoiceImpact(a).stress - estimateChoiceImpact(b).stress)[0];
    if (relief) {
      return { choiceId: relief.id, botPrng };
    }
  }

  const currentRank = TIER_RANK[state.business.tier];
  const headcount = getTeamHeadcount(state);
  const canHire = state.indicators.money >= 3800 && state.indicators.reputation >= 44;
  const canExpand = state.indicators.money >= 4500;

  const sorted = [...choices].sort((a, b) => {
    const sa = estimateChoiceImpact(a);
    const sb = estimateChoiceImpact(b);

    const tierBonus = (s: ChoiceImpactEstimate): number => {
      if (!s.setBusinessTier) {
        return 0;
      }
      const targetRank = TIER_RANK[s.setBusinessTier];
      if (targetRank <= currentRank) {
        return 0;
      }
      if (s.setBusinessTier === "estudio_consolidado") {
        return 14000;
      }
      if (s.setBusinessTier === "sociedad_limitada") {
        if (headcount >= 2) {
          return 16000;
        }
        if (state.month >= 44 && state.indicators.money >= 6000) {
          return 10000;
        }
        return 1000;
      }
      if (s.setBusinessTier === "agencia_consultora") {
        return 22000;
      }
      return 0;
    };

    const score = (s: ChoiceImpactEstimate) =>
      (s.billed * 0.82 +
        s.deferredAmt * 0.72 +
        s.cash +
        s.modBilled * 0.78 -
        s.deductible * 0.45 -
        s.modExpense * 0.55) *
        stakeMult +
      s.reputation * 220 +
      s.moral * 45 +
      s.employeeSatisfaction * 120 -
      s.stress * 24 -
      s.fiscalRisk * 110 +
      tierBonus(s) +
      (s.hiresEmployee ? (canHire ? 11000 : -2000) : 0) +
      (s.expandTeamCount > 0 ? (canExpand ? 10000 + s.expandTeamCount * 4000 : -1000) : 0) -
      (s.dismissesEmployee ? 6500 : 0) -
      (s.shrinkTeamCount > 0 ? 7500 : 0) +
      (s.gestorTier === "premium" && state.indicators.money >= 6000 ? 3000 : 0) +
      (s.gestorTier === "cheap" && state.gestor.tier === "self" ? 2600 : 0);

    return score(sb) - score(sa);
  });
  return { choiceId: sorted[0]!.id, botPrng };
}

function assertGameStateInvariants(state: GameState, seed: string): void {
  const { indicators, finances, fiscal_risk, business, family, employee } = state;
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
    business.months_in_tier,
    family.neglect_months,
    getTeamHeadcount(state),
    ...(employee ? [employee.monthly_cost, employee.lead_monthly_cost, employee.satisfaction] : []),
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
    ...(employee ? [employee.satisfaction] : []),
  ]) {
    if (bounded < 0 || bounded > 100) {
      throw new Error(`Invariant violation on '${seed}': bounded stat out of [0,100]: ${bounded}`);
    }
  }

  const headcount = getTeamHeadcount(state);
  if (headcount < 0 || headcount > 12) {
    throw new Error(`Invariant violation on '${seed}': team headcount out of [0,12]: ${headcount}`);
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
  const tiersReached = new Set<BusinessTier>([state.business.tier]);

  let peakMonthlyBilling = 0;
  let peakStress = state.indicators.stress;
  let peakFiscalRisk = state.fiscal_risk;
  let peakHeadcount = getTeamHeadcount(state);
  let hadElena = state.gestor.tier === "premium";
  let haciendaAuditOrSurchargeCount = 0;
  let historicalAuditCount = 0;
  let elenaComplianceWarnings = 0;
  let elenaComplianceDrops = 0;
  let invoicesPaid = 0;
  let invoicesDefaulted = 0;
  let quartersPaid = 0;
  let quartersDeferred = 0;
  let post120MonthsSimulated = 0;
  let post120EventsDrawn = 0;
  let starvedMonthsCount = 0;
  let postChoiceTotalCount = 0;
  let postChoiceMoral100Count = 0;

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

    tiersReached.add(state.business.tier);
    peakStress = Math.max(peakStress, state.indicators.stress);
    peakFiscalRisk = Math.max(peakFiscalRisk, state.fiscal_risk);
    peakHeadcount = Math.max(peakHeadcount, getTeamHeadcount(state));
    if (state.gestor.tier === "premium") {
      hadElena = true;
    }

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
        active.event.id === "hacienda_recargo_extemporaneo" ||
        active.event.tags?.includes("prescripcion_fiscal")
      ) {
        haciendaAuditOrSurchargeCount += 1;
      }

      const eligible = active.choices.filter((c) => c.eligible).map((c) => c.choice);
      if (eligible.length === 0) {
        throw new Error(`Softlock: zero eligible choices on event '${active.event.id}'`);
      }

      const picked = selectBotChoice(catalog, bot, state, active.event, eligible, botPrng);
      botPrng = picked.botPrng;
      const step = applyPlayerChoice(state, catalog, picked.choiceId);
      postChoiceTotalCount += 1;
      if (step.resolution.postChoiceState?.indicators.moral === 100) {
        postChoiceMoral100Count += 1;
      }
      state = step.state;
      assertGameStateInvariants(state, seed);

      recordMonthStart(step.resolution.monthStart);
      if (step.resolution.quarterlyReport) {
        const qr = step.resolution.quarterlyReport;
        const surcharge = qr.gestor_error_surcharge + qr.inspection_fallback_fine;
        if (qr.inspection_triggered || qr.historical_audit_triggered || surcharge > 0) {
          haciendaAuditOrSurchargeCount += 1;
        }
        if (qr.historical_audit_triggered) {
          historicalAuditCount += 1;
        }
        if (qr.elena_compliance_event === "warning") {
          elenaComplianceWarnings += 1;
        } else if (qr.elena_compliance_event === "dropped") {
          elenaComplianceDrops += 1;
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
      const effectiveDecision =
        victoryDecision === "retire" && state.month < maxMonths ? "continue" : victoryDecision;
      const step = resolveVictoryPrompt(state, catalog, effectiveDecision);
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

  tiersReached.add(state.business.tier);
  peakStress = Math.max(peakStress, state.indicators.stress);
  peakFiscalRisk = Math.max(peakFiscalRisk, state.fiscal_risk);
  peakHeadcount = Math.max(peakHeadcount, getTeamHeadcount(state));
  if (state.gestor.tier === "premium") {
    hadElena = true;
  }

  const survived =
    state.earned_victories.includes("hero_120m") ||
    state.earned_victories.includes("rich_250k") ||
    (state.phase !== "game_over" && state.month > maxMonths);
  const rich250kUnlocked =
    state.earned_victories.includes("rich_250k") ||
    state.indicators.money >= catalog.balance.victory_money;
  const pinnedMaxStats =
    survived &&
    state.indicators.moral >= 99 &&
    state.indicators.reputation >= 99 &&
    state.indicators.personal_life >= 99 &&
    state.indicators.stress <= 1;

  return {
    survived,
    rich250kUnlocked,
    pinnedMaxStats,
    finalMonth: state.month,
    endingId: state.ending?.id ?? null,
    finalMoney: state.indicators.money,
    lifetimeBilled: state.finances.lifetime_billed,
    peakMonthlyBilling,
    peakStress,
    peakFiscalRisk,
    peakHeadcount,
    hadElena,
    prescribedClean: Boolean(state.flags.ejercicio_prescrito_limpio),
    haciendaAuditOrSurchargeCount,
    historicalAuditCount,
    elenaComplianceWarnings,
    elenaComplianceDrops,
    invoicesPaid,
    invoicesDefaulted,
    quartersPaid,
    quartersDeferred,
    endlessModeEntered: state.endless_mode,
    post120MonthsSimulated,
    post120EventsDrawn,
    starvedMonthsCount,
    postChoiceTotalCount,
    postChoiceMoral100Count,
    eventsSeen,
    categoriesSeen,
    tiersReached,
  };
}

describe("Autónomo Simulator v2 Monte Carlo simulation suite over 362-event catalog, 4-tier scaling, progressive IRPF/RETA & 4-year prescripción", () => {
  const allEventsSeen = new Set<string>();
  const allCategoriesSeen = new Set<EventCategory>();
  const allTiersReached = new Set<BusinessTier>();
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
      let rich250kCount = 0;
      let pinnedMaxStatsCount = 0;
      let sumLifetimeBilled = 0;
      let sumPeakMonthly = 0;
      let sumSurvivingCash = 0;
      let sumPeakStress = 0;
      let sumPeakFiscal = 0;
      let sumPeakHeadcount = 0;
      let headcount4PlusRuns = 0;
      let headcount5PlusRuns = 0;
      let elenaRuns = 0;
      let elenaSurvivedCount = 0;
      let sumAudits = 0;
      let sumHistoricalAudits = 0;
      let prescribedCleanRuns = 0;
      let elenaComplianceWarnings = 0;
      let elenaComplianceDrops = 0;
      let sumQuarters = 0;
      let sumPostChoiceTotal = 0;
      let sumPostChoiceMoral100 = 0;
      let bankruptcyCount = 0;
      let burnoutCount = 0;
      let resignationMoralCount = 0;
      const tierReachCounts: Record<BusinessTier, number> = {
        solo_autonomo: 0,
        estudio_consolidado: 0,
        sociedad_limitada: 0,
        agencia_consultora: 0,
      };
      const endings: Record<string, number> = {};

      for (let i = 0; i < runs; i += 1) {
        const m = runSingleSimulation(simulationCatalog, bot, `V2-${bot}-${i}`);
        if (m.survived) {
          survivedCount += 1;
          sumSurvivingCash += m.finalMoney;
        }
        if (m.rich250kUnlocked) rich250kCount += 1;
        if (m.pinnedMaxStats) pinnedMaxStatsCount += 1;
        if (m.hadElena) {
          elenaRuns += 1;
          if (m.survived) elenaSurvivedCount += 1;
        }
        if (m.prescribedClean) prescribedCleanRuns += 1;
        if (m.peakHeadcount >= 4) headcount4PlusRuns += 1;
        if (m.peakHeadcount >= 5) headcount5PlusRuns += 1;
        if (m.endingId) {
          distinctEndings.add(m.endingId);
          endings[m.endingId] = (endings[m.endingId] ?? 0) + 1;
        }
        if (m.endingId === "defeat_bankruptcy") bankruptcyCount += 1;
        if (m.endingId === "defeat_burnout_stress") burnoutCount += 1;
        if (m.endingId === "defeat_resignation_moral") resignationMoralCount += 1;

        sumLifetimeBilled += m.lifetimeBilled;
        sumPeakMonthly += m.peakMonthlyBilling;
        sumPeakStress += m.peakStress;
        sumPeakFiscal += m.peakFiscalRisk;
        sumPeakHeadcount += m.peakHeadcount;
        sumAudits += m.haciendaAuditOrSurchargeCount;
        sumHistoricalAudits += m.historicalAuditCount;
        elenaComplianceWarnings += m.elenaComplianceWarnings;
        elenaComplianceDrops += m.elenaComplianceDrops;
        sumQuarters += m.quartersPaid + m.quartersDeferred;
        sumPostChoiceTotal += m.postChoiceTotalCount;
        sumPostChoiceMoral100 += m.postChoiceMoral100Count;

        totalInvoicesPaid += m.invoicesPaid;
        totalInvoicesDefaulted += m.invoicesDefaulted;
        totalQuartersPaid += m.quartersPaid;
        totalQuartersDeferred += m.quartersDeferred;
        totalStarvedMonths += m.starvedMonthsCount;

        for (const evId of m.eventsSeen) allEventsSeen.add(evId);
        for (const cat of m.categoriesSeen) allCategoriesSeen.add(cat);
        for (const tier of m.tiersReached) {
          tierReachCounts[tier] += 1;
          allTiersReached.add(tier);
        }
      }

      computed[bot] = {
        runs,
        survivedCount,
        survivalRate: survivedCount / runs,
        rich250kCount,
        rich250kRate: rich250kCount / runs,
        pinnedMaxStatsCount,
        postChoiceMoral100Rate: sumPostChoiceMoral100 / Math.max(1, sumPostChoiceTotal),
        avgLifetimeBilled: sumLifetimeBilled / runs,
        avgPeakMonthlyBilling: sumPeakMonthly / runs,
        avgSurvivingCash: survivedCount > 0 ? sumSurvivingCash / survivedCount : 0,
        avgPeakStress: sumPeakStress / runs,
        avgPeakFiscalRisk: sumPeakFiscal / runs,
        avgPeakHeadcount: sumPeakHeadcount / runs,
        headcount4PlusRuns,
        headcount5PlusRuns,
        elenaRuns,
        elenaSurvivalRate: elenaRuns > 0 ? elenaSurvivedCount / elenaRuns : 0,
        auditsPerQuarter: sumAudits / Math.max(1, sumQuarters),
        historicalAuditCount: sumHistoricalAudits,
        prescribedCleanRuns,
        elenaComplianceWarnings,
        elenaComplianceDrops,
        bankruptcyCount,
        burnoutCount,
        resignationMoralCount,
        tierReachCounts,
        endings,
      };
    }

    summary = computed;
  }, 90_000);

  it("proves PassiveRejectBot achieves 0% 120-month survival and drains into bankruptcy without active gig work", () => {
    const passiveRuns = 100;
    let survivedCount = 0;
    let bankruptcyCount = 0;
    let sumFinalMoney = 0;

    for (let i = 0; i < passiveRuns; i += 1) {
      const m = runSingleSimulation(simulationCatalog, "PassiveRejectBot", `V2-PassiveReject-${i}`);
      if (m.survived) survivedCount += 1;
      if (m.endingId === "defeat_bankruptcy") bankruptcyCount += 1;
      sumFinalMoney += m.finalMoney;
    }

    expect(survivedCount).toBe(0);
    expect(bankruptcyCount).toBeGreaterThanOrEqual(85);
    expect(sumFinalMoney / passiveRuns).toBeLessThan(0);
  }, 30_000);

  it("executes 1,750 deterministic campaigns (1,000 RandomBot + 3×250 archetypes) with zero deadlocks, zero NaN/Infinity, zero starved months, and bit-exact replay determinism", () => {
    expect(summary.RandomBot.runs).toBe(1000);
    expect(summary.ConservativeLegalBot.runs).toBe(250);
    expect(summary.AggressiveTaxDodgerBot.runs).toBe(250);
    expect(summary.WorkaholicGrowthBot.runs).toBe(250);
    expect(totalStarvedMonths).toBe(0);

    const replay1 = runSingleSimulation(simulationCatalog, "RandomBot", "DETERMINISM-V2-CHECK");
    const replay2 = runSingleSimulation(simulationCatalog, "RandomBot", "DETERMINISM-V2-CHECK");
    expect(replay1.finalMonth).toBe(replay2.finalMonth);
    expect(replay1.finalMoney).toBe(replay2.finalMoney);
    expect(replay1.lifetimeBilled).toBe(replay2.lifetimeBilled);
    expect(replay1.peakHeadcount).toBe(replay2.peakHeadcount);
    expect(replay1.endingId).toBe(replay2.endingId);
  });

  it("reaches all 5 categories, all 4 BusinessTier stages, >= 90% of compiled 362 events, deferred invoices, quarterly settlements, and >= 6 distinct EndingIds", () => {
    expect(allCategoriesSeen).toEqual(
      new Set<EventCategory>(["clientes", "hacienda", "familia", "empleados", "gestor"]),
    );
    expect(allTiersReached).toEqual(
      new Set<BusinessTier>([
        "solo_autonomo",
        "estudio_consolidado",
        "sociedad_limitada",
        "agencia_consultora",
      ]),
    );
    expect(allEventsSeen.size).toBeGreaterThanOrEqual(
      Math.floor(simulationCatalog.events.length * 0.9),
    );
    expect(totalInvoicesPaid).toBeGreaterThan(100);
    expect(totalInvoicesDefaulted).toBeGreaterThan(10);
    expect(totalQuartersPaid).toBeGreaterThan(1000);
    expect(totalQuartersDeferred).toBeGreaterThan(20);
    expect(distinctEndings.size).toBeGreaterThanOrEqual(6);
  });

  it("calibrates v2 survival bands (ConservativeLegalBot 45%-55% tense solo without Elena auto-win; AggressiveTaxDodgerBot 20%-45% viable high-variance with 4-yr prescripción audits; RandomBot 5%-35%)", () => {
    // RandomBot: 5%-35% survival with real bankruptcy, burnout & moral resignation endings
    expect(summary.RandomBot.survivalRate).toBeGreaterThanOrEqual(0.05);
    expect(summary.RandomBot.survivalRate).toBeLessThanOrEqual(0.35);
    expect(summary.RandomBot.bankruptcyCount).toBeGreaterThan(0);
    expect(summary.RandomBot.burnoutCount).toBeGreaterThan(0);
    expect(summary.RandomBot.resignationMoralCount).toBeGreaterThan(0);

    // ConservativeLegalBot: CI window 42%-58% around Human Owner's 45%-55% target (down from ~93% in v1)
    expect(summary.ConservativeLegalBot.survivalRate).toBeGreaterThanOrEqual(0.42);
    expect(summary.ConservativeLegalBot.survivalRate).toBeLessThanOrEqual(0.58);
    expect(summary.ConservativeLegalBot.elenaRuns).toBeGreaterThan(100);
    expect(summary.ConservativeLegalBot.elenaSurvivalRate).toBeLessThanOrEqual(0.62);
    expect(summary.ConservativeLegalBot.pinnedMaxStatsCount).toBeLessThanOrEqual(25);
    expect(summary.ConservativeLegalBot.postChoiceMoral100Rate).toBeLessThan(0.35);

    // AggressiveTaxDodgerBot: viable 20%-45% high-variance path with higher surviving cash & 14-42m historical audits
    expect(summary.AggressiveTaxDodgerBot.survivalRate).toBeGreaterThanOrEqual(0.2);
    expect(summary.AggressiveTaxDodgerBot.survivalRate).toBeLessThanOrEqual(0.45);
    expect(summary.AggressiveTaxDodgerBot.avgSurvivingCash).toBeGreaterThan(
      summary.ConservativeLegalBot.avgSurvivingCash,
    );
    expect(summary.ConservativeLegalBot.avgPeakFiscalRisk).toBeLessThan(
      summary.AggressiveTaxDodgerBot.avgPeakFiscalRisk,
    );
    expect(summary.ConservativeLegalBot.auditsPerQuarter).toBeLessThan(
      summary.AggressiveTaxDodgerBot.auditsPerQuarter,
    );
    expect(summary.AggressiveTaxDodgerBot.historicalAuditCount).toBeGreaterThan(50);
    expect(summary.AggressiveTaxDodgerBot.prescribedCleanRuns).toBeGreaterThan(0);
  });

  it("captures WorkaholicGrowthBot S.L./Agency scaling (>= 10,000 €/mo peak billing, headcount >= 4, 10%-28% rich_250k) with real late-game burnout & insolvency tension", () => {
    expect(summary.WorkaholicGrowthBot.avgPeakMonthlyBilling).toBeGreaterThanOrEqual(10_000);
    expect(summary.WorkaholicGrowthBot.avgPeakMonthlyBilling).toBeGreaterThan(
      summary.ConservativeLegalBot.avgPeakMonthlyBilling,
    );
    expect(summary.WorkaholicGrowthBot.avgPeakMonthlyBilling).toBeGreaterThan(
      summary.RandomBot.avgPeakMonthlyBilling,
    );
    expect(summary.WorkaholicGrowthBot.avgPeakMonthlyBilling).toBeGreaterThan(
      summary.AggressiveTaxDodgerBot.avgPeakMonthlyBilling,
    );
    expect(summary.WorkaholicGrowthBot.tierReachCounts.sociedad_limitada).toBeGreaterThanOrEqual(
      80,
    );
    expect(summary.WorkaholicGrowthBot.tierReachCounts.agencia_consultora).toBeGreaterThanOrEqual(
      40,
    );
    expect(summary.WorkaholicGrowthBot.headcount4PlusRuns).toBeGreaterThanOrEqual(40);
    expect(summary.WorkaholicGrowthBot.rich250kRate).toBeGreaterThanOrEqual(0.1);
    expect(summary.WorkaholicGrowthBot.rich250kRate).toBeLessThanOrEqual(0.28);
    expect(summary.WorkaholicGrowthBot.avgPeakStress).toBeGreaterThan(
      summary.ConservativeLegalBot.avgPeakStress,
    );
    expect(summary.WorkaholicGrowthBot.burnoutCount).toBeGreaterThan(
      summary.ConservativeLegalBot.burnoutCount,
    );
    expect(summary.WorkaholicGrowthBot.bankruptcyCount).toBeGreaterThan(0);
    expect(summary.WorkaholicGrowthBot.postChoiceMoral100Rate).toBeLessThan(0.35);
  });

  it("runs Endless Mode (180 months) campaigns cleanly past Month 120 without event starvation or crashes", () => {
    const endlessRunsPerBot = 30;
    let enteredEndlessCount = 0;
    let reached180Count = 0;
    let post120Months = 0;
    let post120Events = 0;
    let endlessStarvedMonths = 0;

    for (const bot of ["ConservativeLegalBot", "WorkaholicGrowthBot"] as const) {
      for (let i = 0; i < endlessRunsPerBot; i += 1) {
        const m = runSingleSimulation(simulationCatalog, bot, `V2-Endless-${bot}-${i}`, {
          maxMonths: 180,
          victoryDecision: "continue",
        });
        if (m.endlessModeEntered) enteredEndlessCount += 1;
        if (m.finalMonth > 180) reached180Count += 1;
        post120Months += m.post120MonthsSimulated;
        post120Events += m.post120EventsDrawn;
        endlessStarvedMonths += m.starvedMonthsCount;
      }
    }

    expect(enteredEndlessCount).toBeGreaterThanOrEqual(25);
    expect(reached180Count).toBeGreaterThanOrEqual(15);
    expect(post120Months).toBeGreaterThanOrEqual(1000);
    expect(post120Events).toBeGreaterThanOrEqual(post120Months);
    expect(endlessStarvedMonths).toBe(0);
  }, 45_000);
});
