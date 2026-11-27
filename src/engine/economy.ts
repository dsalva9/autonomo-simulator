import { nextFloat } from "./prng.ts";
import type { BusinessTier, GestorTier, IrpfBracket } from "./schemas/index.ts";
import { selectHistoricalAuditEvent } from "./selector.ts";
import {
  DEFAULT_CORPORATE_TAX_RATE,
  appendHistory,
  getBusinessTierConfig,
  getEffectiveHardDebtFloor,
  getGestorComplianceConfig,
  getPartnerPressureConfig,
  getPrescripcionConfig,
  getTeamHeadcount,
  getTeamScalingConfig,
  isBoutiqueSeniorSolo,
  scaleMonetaryValue,
} from "./state.ts";
import type {
  ContentCatalog,
  EndingId,
  GameState,
  InvoiceSettlementResult,
  MonthlyEconomyBreakdown,
  PrngState,
  QuarterlyReport,
  QuarterlySettlementMode,
  QuarterlySettlementSummary,
  ScheduledEvent,
  TemporalModifier,
} from "./types.ts";

export function clampStat(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function computeEffectiveTeamMultiplier(
  state: Pick<GameState, "employee">,
  catalog?: Pick<ContentCatalog, "balance">,
): number {
  if (!state.employee) {
    return 1;
  }
  const headcount = getTeamHeadcount(state);
  const satScale = 0.4 + 0.8 * (clampStat(state.employee.satisfaction) / 100);
  const leadExtra = state.employee.billing_multiplier - 1;
  if (headcount <= 1) {
    return 1 + leadExtra * satScale;
  }
  const teamScaling = getTeamScalingConfig(catalog);
  const extraCount = headcount - 1;
  let extraBoost = 0;
  let seatWeight = teamScaling.base_additional_seat_multiplier;
  for (let i = 0; i < extraCount; i += 1) {
    extraBoost += seatWeight;
    seatWeight *= teamScaling.seat_diminishing_factor;
  }
  return 1 + (leadExtra + extraBoost) * satScale;
}

export function computeBoutiqueSoloFactor(
  state: Pick<GameState, "employee" | "month" | "indicators">,
  catalog?: Pick<ContentCatalog, "balance">,
): number {
  if (getTeamHeadcount(state) !== 0) {
    return 1;
  }
  const teamScaling = getTeamScalingConfig(catalog);
  if (
    state.month < teamScaling.boutique_solo_min_month ||
    state.indicators.reputation < teamScaling.boutique_solo_min_reputation
  ) {
    return 1;
  }
  const span = Math.max(1, 100 - teamScaling.boutique_solo_min_reputation);
  const ratio = Math.max(
    0,
    Math.min(1, (state.indicators.reputation - teamScaling.boutique_solo_min_reputation) / span),
  );
  return 1 + ratio * teamScaling.boutique_solo_max_bonus;
}

export function computeActMarketSqueeze(
  state: Pick<GameState, "month">,
  catalog: Pick<ContentCatalog, "balance">,
): number {
  const act = catalog.balance.act_difficulty;
  if (!act) {
    return 1;
  }
  if (state.month >= act.act3_start_month) {
    return act.act3_market_squeeze;
  }
  if (state.month >= act.act2_start_month) {
    return act.act2_market_squeeze;
  }
  return 1;
}

export function computeEffectiveGestorFee(
  state: Pick<GameState, "gestor" | "business">,
  catalog: Pick<ContentCatalog, "balance">,
): number;
export function computeEffectiveGestorFee(
  gestorTier: GestorTier,
  businessTier: BusinessTier,
  catalog: Pick<ContentCatalog, "balance">,
): number;
export function computeEffectiveGestorFee(
  stateOrTier: Pick<GameState, "gestor" | "business"> | GestorTier,
  catalogOrBusinessTier: Pick<ContentCatalog, "balance"> | BusinessTier,
  maybeCatalog?: Pick<ContentCatalog, "balance">,
): number {
  let gestorTier: GestorTier;
  let businessTier: BusinessTier;
  let catalog: Pick<ContentCatalog, "balance">;
  let explicitStateFee: number | null = null;

  if (typeof stateOrTier === "string") {
    gestorTier = stateOrTier;
    businessTier = catalogOrBusinessTier as BusinessTier;
    catalog = maybeCatalog!;
  } else {
    gestorTier = stateOrTier.gestor.tier;
    businessTier = stateOrTier.business?.tier ?? "solo_autonomo";
    catalog = catalogOrBusinessTier as Pick<ContentCatalog, "balance">;
    explicitStateFee = stateOrTier.gestor.monthly_fee;
  }

  if (gestorTier === "self") {
    return 0;
  }

  // Preserve custom state.gestor.monthly_fee overrides on minimal legacy solo fixtures without business_tiers
  if (
    explicitStateFee != null &&
    !catalog.balance.business_tiers &&
    businessTier === "solo_autonomo"
  ) {
    return Math.max(0, Math.round(explicitStateFee));
  }

  const baseFee = catalog.balance.gestor_tiers[gestorTier].monthly_fee;
  const tierConfig = getBusinessTierConfig(businessTier, catalog);
  return Math.max(0, Math.round(baseFee * tierConfig.gestor_fee_multiplier));
}

export function computeBaselineMonthlyBilling(state: GameState, catalog: ContentCatalog): number {
  const { balance } = catalog;
  const repRatio = clampStat(state.indicators.reputation) / 100;
  const moralRatio = clampStat(state.indicators.moral) / 100;

  const repFactor =
    balance.reputation_multiplier_min +
    repRatio * (balance.reputation_multiplier_max - balance.reputation_multiplier_min);
  const moralFactor =
    balance.moral_multiplier_min +
    moralRatio * (balance.moral_multiplier_max - balance.moral_multiplier_min);

  const tierFactor = getBusinessTierConfig(state, catalog).billing_multiplier;
  const marketSqueeze = computeActMarketSqueeze(state, catalog);
  const employeeMultiplier = computeEffectiveTeamMultiplier(state, catalog);
  const boutiqueFactor = computeBoutiqueSoloFactor(state, catalog);

  let modifierBilledDelta = 0;
  for (const mod of state.modifiers) {
    if (mod.monthly_billed_delta != null) {
      modifierBilledDelta += mod.monthly_billed_delta;
    }
  }

  const gross =
    balance.base_monthly_billing *
      repFactor *
      moralFactor *
      tierFactor *
      marketSqueeze *
      employeeMultiplier *
      boutiqueFactor +
    modifierBilledDelta;

  return Math.max(0, Math.round(gross));
}

function sumModifierExpenseDelta(state: Pick<GameState, "modifiers">): number {
  let modifierExpenseDelta = 0;
  for (const mod of state.modifiers) {
    if (mod.monthly_expense_delta != null) {
      modifierExpenseDelta += mod.monthly_expense_delta;
    }
  }
  return modifierExpenseDelta;
}

export function computeMonthlyLivingCost(
  state: Pick<GameState, "month">,
  catalog: Pick<ContentCatalog, "balance">,
): number {
  const { balance } = catalog;
  const elapsedYears = Math.max(0, Math.floor((state.month - 1) / 12));
  const fullGrowthYears = Math.max(0, Math.floor((balance.victory_month - 1) / 12));
  const act = balance.act_difficulty;

  if (act) {
    const act1MaxYear = Math.max(0, Math.floor((act.act2_start_month - 1) / 12));
    const act2MaxYear = Math.max(act1MaxYear, Math.floor((act.act3_start_month - 1) / 12));
    const endlessGrowth = Math.floor(act.act3_living_cost_growth * 0.5);

    let creep = 0;
    for (let y = 1; y <= elapsedYears; y += 1) {
      if (y <= act1MaxYear) {
        creep += act.act1_living_cost_growth;
      } else if (y <= act2MaxYear) {
        creep += act.act2_living_cost_growth;
      } else if (y <= fullGrowthYears) {
        creep += act.act3_living_cost_growth;
      } else {
        creep += endlessGrowth;
      }
    }
    return Math.max(0, Math.round(balance.base_living_cost + creep));
  }

  const effectiveYears =
    elapsedYears <= fullGrowthYears
      ? elapsedYears
      : fullGrowthYears + (elapsedYears - fullGrowthYears) * 0.5;
  const livingCostCreep = effectiveYears * (balance.annual_living_cost_growth ?? 0);
  return Math.max(0, Math.round(balance.base_living_cost + livingCostCreep));
}

export function computeMonthlySocialSecurityQuota(
  state: GameState,
  catalog: ContentCatalog,
  precomputedGrossBilling?: number,
): number {
  const { balance } = catalog;
  const tierConfig = getBusinessTierConfig(state, catalog);
  if (tierConfig.corporate_tax_regime) {
    const tier = state.business?.tier ?? "sociedad_limitada";
    return tierConfig.societario_quota ?? (tier === "agencia_consultora" ? 520 : 460);
  }

  const brackets = balance.reta_brackets;
  if (!brackets || brackets.length === 0) {
    return balance.autonomo_quota;
  }

  const grossBilling = precomputedGrossBilling ?? computeBaselineMonthlyBilling(state, catalog);
  const structuralOverhead = tierConfig.monthly_structural_overhead;
  const gestorFee = computeEffectiveGestorFee(state, catalog);
  const payrollCost = state.employee ? state.employee.monthly_cost : 0;
  const modifierExpenseDelta = sumModifierExpenseDelta(state);
  const preQuotaProfit = Math.max(
    0,
    grossBilling - structuralOverhead - gestorFee - payrollCost - Math.max(0, modifierExpenseDelta),
  );

  for (const bracket of brackets) {
    if (bracket.max_monthly_profit === null || preQuotaProfit < bracket.max_monthly_profit) {
      return bracket.monthly_quota;
    }
  }
  return brackets[brackets.length - 1]!.monthly_quota;
}

export function computeMonthlyDeductibleExpenses(
  state: GameState,
  catalog: ContentCatalog,
): number {
  const tierConfig = getBusinessTierConfig(state, catalog);
  const socialSecurityQuota = computeMonthlySocialSecurityQuota(state, catalog);
  const gestorFee = computeEffectiveGestorFee(state, catalog);
  const payrollCost = state.employee ? state.employee.monthly_cost : 0;
  const modifierExpenseDelta = sumModifierExpenseDelta(state);

  const deductible =
    socialSecurityQuota +
    tierConfig.monthly_structural_overhead +
    gestorFee +
    payrollCost +
    Math.max(0, modifierExpenseDelta);

  return Math.max(0, Math.round(deductible));
}

export function computeMonthlyRecurringExpenses(state: GameState, catalog: ContentCatalog): number {
  const tierConfig = getBusinessTierConfig(state, catalog);
  const livingCost = computeMonthlyLivingCost(state, catalog);
  const socialSecurityQuota = computeMonthlySocialSecurityQuota(state, catalog);
  const gestorFee = computeEffectiveGestorFee(state, catalog);
  const payrollCost = state.employee ? state.employee.monthly_cost : 0;
  const modifierExpenseDelta = sumModifierExpenseDelta(state);

  const total =
    livingCost +
    socialSecurityQuota +
    tierConfig.monthly_structural_overhead +
    gestorFee +
    state.family.monthly_cost +
    payrollCost +
    modifierExpenseDelta;

  return Math.max(0, Math.round(total));
}

function computeProgressiveIrpfTax(profit: number, brackets: readonly IrpfBracket[]): number {
  const positiveProfit = Math.max(0, profit);
  if (positiveProfit <= 0) {
    return 0;
  }
  let tax = 0;
  let lowerBound = 0;
  for (const bracket of brackets) {
    if (bracket.up_to_monthly_profit === null) {
      if (positiveProfit > lowerBound) {
        tax += (positiveProfit - lowerBound) * bracket.marginal_rate;
      }
      break;
    }
    const upperBound = Math.max(lowerBound, bracket.up_to_monthly_profit);
    if (positiveProfit > lowerBound) {
      const slice = Math.min(positiveProfit, upperBound) - lowerBound;
      tax += slice * bracket.marginal_rate;
    }
    lowerBound = upperBound;
    if (positiveProfit <= upperBound) {
      break;
    }
  }
  return Math.round(tax);
}

function findMarginalIrpfRate(taxableProfit: number, brackets: readonly IrpfBracket[]): number {
  const profit = Math.max(0, taxableProfit);
  for (const bracket of brackets) {
    if (bracket.up_to_monthly_profit === null || profit < bracket.up_to_monthly_profit) {
      return bracket.marginal_rate;
    }
  }
  return brackets[brackets.length - 1]!.marginal_rate;
}

export function computeMarginalTaxRate(state: GameState, catalog: ContentCatalog): number {
  const { balance } = catalog;
  const tierConfig = getBusinessTierConfig(state, catalog);
  if (tierConfig.corporate_tax_regime) {
    return balance.corporate_tax_rate ?? DEFAULT_CORPORATE_TAX_RATE;
  }
  if (!balance.irpf_brackets || balance.irpf_brackets.length === 0) {
    return balance.effective_quarterly_tax_rate;
  }
  const grossBilling = computeBaselineMonthlyBilling(state, catalog);
  const deductibleExpenses = computeMonthlyDeductibleExpenses(state, catalog);
  const taxableProfit = Math.max(0, grossBilling - deductibleExpenses);
  return findMarginalIrpfRate(taxableProfit, balance.irpf_brackets);
}

export function computeMonthlyEconomyBreakdown(
  state: GameState,
  catalog: ContentCatalog,
): MonthlyEconomyBreakdown {
  const { balance } = catalog;
  const businessTier = state.business?.tier ?? "solo_autonomo";
  const tierConfig = getBusinessTierConfig(state, catalog);
  const teamHeadcount = getTeamHeadcount(state);
  const boutiqueSeniorSolo = isBoutiqueSeniorSolo(state, catalog);

  const grossBilling = computeBaselineMonthlyBilling(state, catalog);
  const structuralOverhead = tierConfig.monthly_structural_overhead;
  const gestorFee = computeEffectiveGestorFee(state, catalog);
  const payrollCost = state.employee ? state.employee.monthly_cost : 0;
  const modifierExpenseDelta = sumModifierExpenseDelta(state);
  const socialSecurityQuota = computeMonthlySocialSecurityQuota(state, catalog, grossBilling);

  const deductibleExpenses = Math.max(
    0,
    Math.round(
      socialSecurityQuota +
        structuralOverhead +
        gestorFee +
        payrollCost +
        Math.max(0, modifierExpenseDelta),
    ),
  );
  const taxableProfit = Math.max(0, grossBilling - deductibleExpenses);

  let grossTaxWithoutDeductions: number;
  let taxShieldOnExpenses: number;
  let netTaxAccrued: number;
  let marginalTaxRate: number;

  if (tierConfig.corporate_tax_regime) {
    const corpRate = balance.corporate_tax_rate ?? DEFAULT_CORPORATE_TAX_RATE;
    grossTaxWithoutDeductions = Math.round(grossBilling * corpRate);
    netTaxAccrued = Math.round(taxableProfit * corpRate);
    taxShieldOnExpenses = Math.max(0, grossTaxWithoutDeductions - netTaxAccrued);
    marginalTaxRate = corpRate;
  } else if (balance.irpf_brackets && balance.irpf_brackets.length > 0) {
    grossTaxWithoutDeductions = computeProgressiveIrpfTax(grossBilling, balance.irpf_brackets);
    netTaxAccrued = computeProgressiveIrpfTax(taxableProfit, balance.irpf_brackets);
    taxShieldOnExpenses = Math.max(0, grossTaxWithoutDeductions - netTaxAccrued);
    marginalTaxRate = findMarginalIrpfRate(taxableProfit, balance.irpf_brackets);
  } else {
    grossTaxWithoutDeductions = Math.round(grossBilling * balance.effective_quarterly_tax_rate);
    taxShieldOnExpenses = Math.round(deductibleExpenses * balance.deductible_tax_fraction);
    netTaxAccrued = Math.max(0, grossTaxWithoutDeductions - taxShieldOnExpenses);
    marginalTaxRate = balance.effective_quarterly_tax_rate;
  }

  const effectiveTaxRate = taxableProfit > 0 ? netTaxAccrued / taxableProfit : 0;

  const livingCost = computeMonthlyLivingCost(state, catalog);
  const familyCost = state.family.monthly_cost;
  const totalExpenses = Math.max(
    0,
    Math.round(
      livingCost +
        socialSecurityQuota +
        structuralOverhead +
        gestorFee +
        familyCost +
        payrollCost +
        modifierExpenseDelta,
    ),
  );
  const netRecurringCash = grossBilling - totalExpenses;
  const netCashAfterTax = netRecurringCash - netTaxAccrued;

  return {
    businessTier,
    corporateTaxRegime: tierConfig.corporate_tax_regime,
    teamHeadcount,
    isBoutiqueSeniorSolo: boutiqueSeniorSolo,
    grossBilling,
    socialSecurityQuota,
    structuralOverhead,
    gestorFee,
    payrollCost,
    modifierExpenseDelta,
    deductibleExpenses,
    taxableProfit,
    grossTaxWithoutDeductions,
    taxShieldOnExpenses,
    netTaxAccrued,
    effectiveTaxRate,
    marginalTaxRate,
    livingCost,
    familyCost,
    totalExpenses,
    netRecurringCash,
    netCashAfterTax,
  };
}

export function computeReservedTaxObligation(state: GameState): number {
  const deferredTotal = state.finances.deferred_tax
    ? state.finances.deferred_tax.principal + state.finances.deferred_tax.surcharge
    : 0;
  return Math.max(0, Math.round(state.finances.accrued_tax_liability + deferredTotal));
}

export function computeNetCashAfterTaxReserve(state: GameState): number {
  return Math.round(state.indicators.money - computeReservedTaxObligation(state));
}

export interface RecurringMonthResult {
  state: GameState;
  grossBilling: number;
  taxAccruedOnBilling: number;
  deductibleExpenses: number;
  taxShieldOnExpenses: number;
  netTaxAccrued: number;
  totalExpenses: number;
  invoicesSettled: InvoiceSettlementResult[];
  passiveStressDelta: number;
  modifierMoralDelta: number;
  modifierStressDelta: number;
  maintenanceMoralDelta: number;
  maintenanceReputationDelta: number;
  maintenancePersonalLifeDelta: number;
}

export function applyRecurringMonthEconomy(
  state: GameState,
  catalog: ContentCatalog,
): RecurringMonthResult {
  const { balance } = catalog;
  let prng = state.prng;
  let money = state.indicators.money;
  let moral = state.indicators.moral;
  let stress = state.indicators.stress;
  let personalLife = state.indicators.personal_life;
  let reputation = state.indicators.reputation;

  let lifetimeBilled = state.finances.lifetime_billed;
  let currentQuarterBilled = state.finances.current_quarter_billed;
  let accruedTaxLiability = state.finances.accrued_tax_liability;
  const flags = { ...state.flags };
  let history = state.history;
  let annualBilled = state.annual_snapshot.billed;
  let annualExpenses = state.annual_snapshot.expenses;

  const breakdown = computeMonthlyEconomyBreakdown(state, catalog);
  const marginalTaxRate = breakdown.marginalTaxRate;

  const remainingInvoices = [];
  const invoicesSettled: InvoiceSettlementResult[] = [];

  for (const invoice of state.finances.pending_invoices) {
    if (invoice.due_month > state.month) {
      remainingInvoices.push(invoice);
      continue;
    }

    let defaulted = false;
    if (invoice.default_prob >= 1) {
      defaulted = true;
    } else if (invoice.default_prob > 0) {
      const roll = nextFloat(prng);
      prng = roll.prng;
      defaulted = roll.value < invoice.default_prob;
    }

    if (defaulted) {
      flags.impago_pendiente = true;
      invoicesSettled.push({
        invoice_id: invoice.id,
        source_event_id: invoice.source_event_id,
        amount: invoice.amount,
        paid: false,
        tax_accrued: 0,
      });
      history = appendHistory(
        history,
        {
          id: `hist_inv_default_${state.month}_${invoice.id}`,
          month: state.month,
          kind: "invoice_defaulted",
          event_id: invoice.source_event_id,
          money_delta: 0,
        },
        balance.max_history_entries,
      );
    } else {
      const taxOnInvoice = Math.round(invoice.amount * marginalTaxRate);
      money += invoice.amount;
      lifetimeBilled += invoice.amount;
      currentQuarterBilled += invoice.amount;
      accruedTaxLiability += taxOnInvoice;
      annualBilled += invoice.amount;
      invoicesSettled.push({
        invoice_id: invoice.id,
        source_event_id: invoice.source_event_id,
        amount: invoice.amount,
        paid: true,
        tax_accrued: taxOnInvoice,
      });
      history = appendHistory(
        history,
        {
          id: `hist_inv_paid_${state.month}_${invoice.id}`,
          month: state.month,
          kind: "invoice_paid",
          event_id: invoice.source_event_id,
          money_delta: invoice.amount,
        },
        balance.max_history_entries,
      );
    }
  }

  // 4-year prescripción fiscal expiry pruning
  const nextHistoricalExposures = [];
  let expiredCleanly = false;
  for (const entry of state.finances.historical_exposures ?? []) {
    if (state.month >= entry.expires_month) {
      if (!entry.audited) {
        expiredCleanly = true;
      }
    } else {
      nextHistoricalExposures.push(entry);
    }
  }
  if (expiredCleanly) {
    flags.ejercicio_prescrito_limpio = true;
  }

  const grossBilling = breakdown.grossBilling;
  const deductibleExpenses = breakdown.deductibleExpenses;
  const taxAccruedOnBilling = breakdown.grossTaxWithoutDeductions;
  const taxShieldOnExpenses = breakdown.taxShieldOnExpenses;
  const accruedBeforeRecurring = accruedTaxLiability;

  const isLegacyFlatTax =
    !breakdown.corporateTaxRegime && (!balance.irpf_brackets || balance.irpf_brackets.length === 0);
  const rawTaxDelta = isLegacyFlatTax
    ? taxAccruedOnBilling - taxShieldOnExpenses
    : breakdown.netTaxAccrued;

  money += grossBilling;
  lifetimeBilled += grossBilling;
  currentQuarterBilled += grossBilling;
  accruedTaxLiability = Math.max(0, accruedTaxLiability + rawTaxDelta);
  const netTaxAccrued = accruedTaxLiability - accruedBeforeRecurring;
  annualBilled += grossBilling;

  const totalExpenses = breakdown.totalExpenses;
  money -= totalExpenses;
  annualExpenses += totalExpenses;

  let modifierMoralDelta = 0;
  let modifierStressDelta = 0;
  const nextModifiers: TemporalModifier[] = [];
  for (const mod of state.modifiers) {
    if (mod.monthly_moral_delta != null) {
      const beforeMoral = moral;
      moral = clampStat(moral + mod.monthly_moral_delta);
      modifierMoralDelta += moral - beforeMoral;
    }
    if (mod.monthly_stress_delta != null) {
      const beforeStress = stress;
      stress = clampStat(stress + mod.monthly_stress_delta);
      modifierStressDelta += stress - beforeStress;
    }
    const remaining = mod.remaining_months - 1;
    if (remaining > 0) {
      nextModifiers.push({
        ...mod,
        remaining_months: remaining,
      });
    }
  }

  // Dynamic partner neglect_months & support_modifier gating (ADR 004 §5.1)
  const partnerPressure = getPartnerPressureConfig(catalog);
  const isPartnered = state.family.status === "dating" || state.family.status === "cohabiting";
  let nextNeglectMonths = state.family.neglect_months ?? 0;

  if (isPartnered) {
    if (
      personalLife <= partnerPressure.neglect_personal_life_threshold ||
      (stress >= 78 && personalLife <= 50)
    ) {
      nextNeglectMonths += 1;
    } else if (personalLife >= 58) {
      nextNeglectMonths = Math.max(0, nextNeglectMonths - 1);
    }

    if (nextNeglectMonths >= 4) {
      flags.crisis_pareja_latente = true;
    } else if (flags.crisis_pareja_latente && nextNeglectMonths === 0 && personalLife >= 62) {
      Reflect.deleteProperty(flags, "crisis_pareja_latente");
    }
  } else {
    nextNeglectMonths = 0;
    Reflect.deleteProperty(flags, "crisis_pareja_latente");
  }

  const headcount = getTeamHeadcount(state);
  let passiveStressDelta = 0;
  if (personalLife >= balance.personal_life_recovery_threshold) {
    const personalLifeRelief =
      personalLife >= 76
        ? Math.max(2, balance.personal_life_monthly_stress_relief)
        : balance.personal_life_monthly_stress_relief;
    passiveStressDelta -= personalLifeRelief;
  }
  if (state.employee && (personalLife < 52 || state.employee.satisfaction < 45)) {
    passiveStressDelta += 1;
  }

  // Multi-staff management stress overhead (ADR 004 §2.2)
  if (headcount >= 2) {
    let mgmtStress = headcount >= 7 ? 3 : headcount >= 4 ? 2 : 1;
    if (
      state.employee?.character_id === "empleada_senior_laura" &&
      state.employee.satisfaction >= 72
    ) {
      mgmtStress = Math.max(0, mgmtStress - 1);
    }
    passiveStressDelta += mgmtStress;
  }

  // Act III complexity stress pressure (ADR 004 §3.2)
  if (
    balance.act_difficulty &&
    state.month >= balance.act_difficulty.act3_start_month &&
    personalLife < 70
  ) {
    passiveStressDelta += balance.act_difficulty.act3_monthly_stress_pressure;
  }

  // High fiscal_risk paranoia stress (ADR 004 §4.2: 0 below 65)
  if (state.fiscal_risk >= 85) {
    passiveStressDelta += 2;
  } else if (state.fiscal_risk >= 65) {
    passiveStressDelta += 1;
  }

  // Dynamic partner support gating
  if (isPartnered) {
    if (personalLife <= partnerPressure.neglect_personal_life_threshold) {
      // Support suspended + home friction
      passiveStressDelta += 1;
    } else if (personalLife >= partnerPressure.synergy_personal_life_threshold) {
      passiveStressDelta -= Math.round(state.family.support_modifier) + 1;
    } else if (state.family.support_modifier !== 0) {
      passiveStressDelta -= Math.round(state.family.support_modifier);
    }
  } else if (state.family.support_modifier !== 0) {
    passiveStressDelta -= Math.round(state.family.support_modifier);
  }

  if (passiveStressDelta !== 0) {
    const before = stress;
    stress = clampStat(stress + passiveStressDelta);
    passiveStressDelta = stress - before;
  }

  let maintenanceReputationDelta = 0;
  let maintenancePersonalLifeDelta = 0;
  let maintenanceMoralDelta = 0;

  if (balance.high_stat_decay_threshold != null) {
    const threshold = balance.high_stat_decay_threshold;
    if (reputation >= threshold) {
      const beforeRep = reputation;
      reputation = clampStat(reputation - (reputation >= 90 ? 2 : 1));
      maintenanceReputationDelta = reputation - beforeRep;
    }
    if (personalLife >= threshold) {
      const beforePl = personalLife;
      const plDecay = personalLife >= 90 || (state.employee && personalLife >= 78) ? 2 : 1;
      personalLife = clampStat(personalLife - plDecay);
      maintenancePersonalLifeDelta += personalLife - beforePl;
    }

    let rawMoralDrift = 0;
    if (moral >= 93) {
      rawMoralDrift -= 6;
    } else if (moral >= 85) {
      rawMoralDrift -= 5;
    } else if (moral >= 76) {
      rawMoralDrift -= 3;
    } else if (moral >= 68) {
      rawMoralDrift -= 2;
    }
    if (stress >= 65) {
      rawMoralDrift -= 1;
    }
    if (state.finances.consecutive_negative_months >= 1) {
      rawMoralDrift -= 2;
    }
    if (reputation <= 22) {
      rawMoralDrift -= 3;
    } else if (state.month >= 8 && reputation <= 30) {
      rawMoralDrift -= 1;
    }
    if (personalLife <= 25) {
      rawMoralDrift -= 3;
    } else if (personalLife <= 32) {
      rawMoralDrift -= 1;
    }
    if (
      moral <= 34 &&
      (stress >= 58 ||
        state.fiscal_risk >= 70 ||
        reputation <= 28 ||
        personalLife <= 32 ||
        state.finances.consecutive_negative_months >= 1)
    ) {
      rawMoralDrift -= 4;
    }
    if (rawMoralDrift !== 0) {
      const beforeMoral = moral;
      moral = clampStat(moral + rawMoralDrift);
      maintenanceMoralDelta += moral - beforeMoral;
    }
  }

  // High fiscal_risk paranoia moral penalty (ADR 004 §4.2: 0 below 65, -1 at 65..84, -2 at >= 85)
  const fiscalParanoiaMoralPenalty =
    state.fiscal_risk >= 85 ? -2 : state.fiscal_risk >= 65 ? -1 : 0;
  if (fiscalParanoiaMoralPenalty !== 0) {
    const beforeMoral = moral;
    moral = clampStat(moral + fiscalParanoiaMoralPenalty);
    maintenanceMoralDelta += moral - beforeMoral;
  }

  // Large-team management drain on personal_life (ADR 004 §2.2)
  if (headcount >= 4 && stress >= 62) {
    const beforePl = personalLife;
    personalLife = clampStat(personalLife - 1);
    maintenancePersonalLifeDelta += personalLife - beforePl;
  }

  const nextGestor = {
    ...state.gestor,
    monthly_fee: breakdown.gestorFee,
    months_active: state.gestor.months_active + 1,
  };

  const nextBusiness = {
    ...(state.business ?? {
      tier: "solo_autonomo" as const,
      months_in_tier: 0,
      sl_formed_month: null,
    }),
    months_in_tier: (state.business?.months_in_tier ?? 0) + 1,
  };

  const nextFamily = {
    ...state.family,
    neglect_months: nextNeglectMonths,
  };

  let empSatDelta = 0;
  if (stress >= 72) {
    empSatDelta -= 4;
  } else if (stress >= 55) {
    empSatDelta -= 2;
  } else if (stress < 42) {
    empSatDelta += 1;
  }
  if (flags.desgaste_plantilla) {
    empSatDelta -= 2;
  }

  const nextEmployee = state.employee
    ? {
        ...state.employee,
        satisfaction: clampStat(state.employee.satisfaction + empSatDelta),
        months_employed: state.employee.months_employed + 1,
      }
    : null;

  history = appendHistory(
    history,
    {
      id: `hist_month_${state.month}`,
      month: state.month,
      kind: "month_start",
      money_delta: grossBilling - totalExpenses,
    },
    balance.max_history_entries,
  );

  const nextState: GameState = {
    ...state,
    prng,
    indicators: {
      money: Math.round(money),
      moral,
      stress,
      personal_life: personalLife,
      reputation,
    },
    finances: {
      ...state.finances,
      lifetime_billed: lifetimeBilled,
      current_quarter_billed: currentQuarterBilled,
      accrued_tax_liability: accruedTaxLiability,
      pending_invoices: remainingInvoices,
      historical_exposures: nextHistoricalExposures,
    },
    business: nextBusiness,
    gestor: nextGestor,
    family: nextFamily,
    employee: nextEmployee,
    flags,
    modifiers: nextModifiers,
    annual_snapshot: {
      ...state.annual_snapshot,
      billed: annualBilled,
      expenses: annualExpenses,
    },
    history,
  };

  return {
    state: nextState,
    grossBilling,
    taxAccruedOnBilling,
    deductibleExpenses,
    taxShieldOnExpenses,
    netTaxAccrued,
    totalExpenses,
    invoicesSettled,
    passiveStressDelta,
    modifierMoralDelta,
    modifierStressDelta,
    maintenanceMoralDelta,
    maintenanceReputationDelta,
    maintenancePersonalLifeDelta,
  };
}

export function canDeferQuarterlyTax(state: GameState): boolean {
  return state.finances.deferred_tax === null && state.finances.accrued_tax_liability > 0;
}

export type InspectableEventFinder = (
  currentState: GameState,
  catalog: ContentCatalog,
) => string | null | { eventId: string | null; prng: PrngState };

export function prepareQuarterlyTax(
  state: GameState,
  catalog: ContentCatalog,
  findInspectableEventId: InspectableEventFinder,
  findHistoricalAuditEventId: InspectableEventFinder = selectHistoricalAuditEvent,
): { state: GameState; report: QuarterlyReport } {
  const { balance } = catalog;
  let prng = state.prng;
  let accruedTax = state.finances.accrued_tax_liability;
  let stress = state.indicators.stress;
  let reputation = state.indicators.reputation;
  let fiscalRisk = state.fiscal_risk;
  let gestor = { ...state.gestor };
  const flags = { ...state.flags };
  let scheduledQueue: ScheduledEvent[] = [...state.scheduled_queue];
  let history = state.history;
  const historicalExposures = (state.finances.historical_exposures ?? []).map((entry) => ({
    ...entry,
  }));

  const businessTierConfig = getBusinessTierConfig(state, catalog);
  const compliance = getGestorComplianceConfig(catalog);
  const gestorTierConfig = balance.gestor_tiers[gestor.tier];

  // S.L. / Agency self-management compliance penalty (ADR 004 §4.1)
  let slSelfPenalty = 0;
  let effectiveErrorProb = gestorTierConfig.quarterly_error_prob;
  if (gestor.tier === "self" && businessTierConfig.corporate_tax_regime) {
    slSelfPenalty = compliance.sl_self_quarterly_penalty;
    accruedTax += slSelfPenalty;
    effectiveErrorProb = compliance.sl_self_error_prob;
  }

  let gestorErrorSurcharge = 0;
  if (effectiveErrorProb > 0 && accruedTax > 0) {
    const roll = nextFloat(prng);
    prng = roll.prng;
    if (roll.value < effectiveErrorProb) {
      gestorErrorSurcharge = scaleMonetaryValue(
        gestorTierConfig.quarterly_error_surcharge,
        businessTierConfig.event_stakes_multiplier,
      );
      accruedTax += gestorErrorSurcharge;
      stress = clampStat(stress + gestorTierConfig.quarterly_error_stress);
    }
  }

  // Elena (premium) compliance friction (ADR 004 §4.1)
  let elenaComplianceEvent: "warning" | "dropped" | null = null;
  if (gestor.tier === "premium") {
    if (fiscalRisk >= compliance.premium_drop_fiscal_risk) {
      gestor = {
        tier: "self",
        character_id: null,
        monthly_fee: balance.gestor_tiers.self.monthly_fee,
        inspection_shield: balance.gestor_tiers.self.inspection_shield,
        months_active: 0,
      };
      flags.elena_rescision_cumplimiento = true;
      Reflect.deleteProperty(flags, "elena_aviso_cumplimiento");
      reputation = clampStat(reputation - 8);
      stress = clampStat(stress + 10);
      elenaComplianceEvent = "dropped";
    } else if (fiscalRisk >= compliance.premium_warning_fiscal_risk) {
      flags.elena_aviso_cumplimiento = true;
      stress = clampStat(stress + 4);
      elenaComplianceEvent = "warning";
    } else if (fiscalRisk < 30 && flags.elena_aviso_cumplimiento) {
      Reflect.deleteProperty(flags, "elena_aviso_cumplimiento");
    }
  }

  let inspectionTriggered = false;
  let historicalAuditTriggered = false;
  let inspectionScheduledEventId: string | null = null;
  let inspectionFallbackFine = 0;
  const curve = balance.inspection_curve;

  if (fiscalRisk >= curve.min_fiscal_risk) {
    const span = Math.max(1, 100 - curve.min_fiscal_risk);
    const normalized = Math.max(0, Math.min(1, (fiscalRisk - curve.min_fiscal_risk) / span));
    const rawProb = curve.max_probability * normalized ** curve.exponent;
    const effectiveProb = Math.max(0, Math.min(1, rawProb * (1 - gestor.inspection_shield)));

    const roll = nextFloat(prng);
    prng = roll.prng;
    if (roll.value < effectiveProb) {
      inspectionTriggered = true;
      const riskBeforeDecay = fiscalRisk;
      fiscalRisk = clampStat(fiscalRisk - curve.risk_decay_on_trigger);

      const tempState: GameState = {
        ...state,
        month: state.month + 1,
        prng,
        fiscal_risk: riskBeforeDecay,
        gestor,
        flags,
        scheduled_queue: scheduledQueue,
      };
      const inspectionLookup = findInspectableEventId(tempState, catalog);
      let candidateEventId: string | null;
      if (inspectionLookup !== null && typeof inspectionLookup === "object") {
        candidateEventId = inspectionLookup.eventId;
        prng = inspectionLookup.prng;
      } else {
        candidateEventId = inspectionLookup;
      }

      if (candidateEventId) {
        inspectionScheduledEventId = candidateEventId;
        scheduledQueue = enqueueScheduledEvent(scheduledQueue, {
          queue_id: `sched_insp_${state.month}_${scheduledQueue.length + 1}`,
          event_id: candidateEventId,
          trigger_month: state.month + 1,
          origin_month: state.month,
          priority: "high",
          source_event_id: "quarterly_inspection",
        });
      } else {
        inspectionFallbackFine = Math.round(
          curve.fallback_fine_base + riskBeforeDecay * curve.fallback_fine_per_risk,
        );
        accruedTax += inspectionFallbackFine;
        stress = clampStat(stress + curve.fallback_stress_penalty);
      }

      history = appendHistory(
        history,
        {
          id: `hist_insp_${state.month}`,
          month: state.month,
          kind: "inspection",
          event_id: inspectionScheduledEventId ?? undefined,
          money_delta: inspectionFallbackFine > 0 ? -inspectionFallbackFine : 0,
        },
        balance.max_history_entries,
      );
    } else {
      fiscalRisk = clampStat(fiscalRisk - curve.quarterly_natural_risk_decay);
    }
  } else if (fiscalRisk > 0) {
    fiscalRisk = clampStat(fiscalRisk - curve.quarterly_natural_risk_decay);
  }

  // 4-year prescripción fiscal delayed historical audit roll (ADR 004 §4.2)
  if (!inspectionTriggered) {
    const presc = getPrescripcionConfig(catalog);
    const eligibleExposures = historicalExposures.filter((entry) => {
      if (entry.audited) {
        return false;
      }
      const age = state.month - entry.origin_month;
      return age >= presc.min_audit_age_months && age <= presc.max_audit_age_months;
    });

    if (eligibleExposures.length > 0) {
      const dormantRisk = Math.min(
        100,
        eligibleExposures.reduce((sum, entry) => sum + entry.risk_points, 0),
      );
      const rawProb = Math.min(
        presc.max_quarterly_prob,
        presc.base_quarterly_prob + presc.prob_per_risk_point * dormantRisk,
      );
      const effectiveProb = Math.max(
        0,
        Math.min(1, rawProb * (1 - gestor.inspection_shield * presc.gestor_shield_effectiveness)),
      );

      const roll = nextFloat(prng);
      prng = roll.prng;
      if (roll.value < effectiveProb) {
        historicalAuditTriggered = true;
        let targetEntry = eligibleExposures[0]!;
        for (const candidate of eligibleExposures) {
          if (candidate.risk_points > targetEntry.risk_points) {
            targetEntry = candidate;
          }
        }
        targetEntry.audited = true;
        flags.auditoria_ejercicio_anterior = true;

        const tempState: GameState = {
          ...state,
          month: state.month + 1,
          prng,
          fiscal_risk: fiscalRisk,
          gestor,
          flags,
          scheduled_queue: scheduledQueue,
        };
        const histLookup = findHistoricalAuditEventId(tempState, catalog);
        let candidateEventId: string | null;
        if (histLookup !== null && typeof histLookup === "object") {
          candidateEventId = histLookup.eventId;
          prng = histLookup.prng;
        } else {
          candidateEventId = histLookup;
        }

        if (candidateEventId) {
          inspectionScheduledEventId = candidateEventId;
          scheduledQueue = enqueueScheduledEvent(scheduledQueue, {
            queue_id: `sched_hist_audit_${state.month}_${scheduledQueue.length + 1}`,
            event_id: candidateEventId,
            trigger_month: state.month + 1,
            origin_month: state.month,
            priority: "high",
            source_event_id: "historical_audit",
          });
        } else {
          const fallbackBackTax = Math.max(
            presc.fallback_fine_min,
            Math.round(
              targetEntry.untaxed_amount * presc.fallback_fine_rate + targetEntry.risk_points * 18,
            ),
          );
          inspectionFallbackFine += fallbackBackTax;
          accruedTax += fallbackBackTax;
          stress = clampStat(stress + curve.fallback_stress_penalty);
        }

        history = appendHistory(
          history,
          {
            id: `hist_audit_${state.month}`,
            month: state.month,
            kind: "inspection",
            event_id: inspectionScheduledEventId ?? undefined,
            money_delta: inspectionFallbackFine > 0 ? -inspectionFallbackFine : 0,
          },
          balance.max_history_entries,
        );
      }
    }
  }

  const deferredDue =
    state.finances.deferred_tax && state.finances.deferred_tax.due_month <= state.month
      ? state.finances.deferred_tax.principal + state.finances.deferred_tax.surcharge
      : 0;

  const canDefer = state.finances.deferred_tax === null && accruedTax > 0;
  const quarter = Math.ceil((((state.month - 1) % 12) + 1) / 3);

  const report: QuarterlyReport = {
    month: state.month,
    quarter,
    quarter_billed: state.finances.current_quarter_billed,
    accrued_tax_due: accruedTax,
    deferred_tax_due: deferredDue,
    gestor_error_surcharge: gestorErrorSurcharge,
    sl_self_penalty: slSelfPenalty,
    elena_compliance_event: elenaComplianceEvent,
    inspection_triggered: inspectionTriggered,
    historical_audit_triggered: historicalAuditTriggered,
    inspection_scheduled_event_id: inspectionScheduledEventId,
    inspection_fallback_fine: inspectionFallbackFine,
    can_defer: canDefer,
  };

  const nextState: GameState = {
    ...state,
    prng,
    phase: "quarterly_tax",
    indicators: {
      ...state.indicators,
      stress,
      reputation,
    },
    fiscal_risk: fiscalRisk,
    finances: {
      ...state.finances,
      accrued_tax_liability: accruedTax,
      historical_exposures: historicalExposures,
    },
    gestor,
    flags,
    scheduled_queue: scheduledQueue,
    quarterly_report: report,
    history,
  };

  return { state: nextState, report };
}

export function applyQuarterlySettlement(
  state: GameState,
  catalog: ContentCatalog,
  mode: QuarterlySettlementMode,
): { state: GameState; summary: QuarterlySettlementSummary } {
  const { balance } = catalog;
  let money = state.indicators.money;
  let stress = state.indicators.stress;
  let deferredTax = state.finances.deferred_tax;
  const accruedTax = state.finances.accrued_tax_liability;
  let paidAmount = 0;
  let deferredAmount = 0;
  let deferredSurcharge = 0;
  let deferredTaxDefaulted = false;
  const hardDebtFloor = getEffectiveHardDebtFloor(state, catalog);

  if (mode === "defer" && !canDeferQuarterlyTax(state)) {
    throw new Error(
      "Cannot request Aplazamiento when a deferred tax debt already exists or accrued tax is zero.",
    );
  }

  if (deferredTax && deferredTax.due_month <= state.month) {
    const mandatoryDue = deferredTax.principal + deferredTax.surcharge;
    money -= mandatoryDue;
    paidAmount += mandatoryDue;
    deferredTax = null;
    if (money < hardDebtFloor) {
      deferredTaxDefaulted = true;
    }
  }

  if (mode === "pay") {
    money -= accruedTax;
    paidAmount += accruedTax;
  } else {
    deferredAmount = accruedTax;
    deferredSurcharge = Math.round(accruedTax * balance.deferral_surcharge_pct);
    deferredTax = {
      principal: deferredAmount,
      surcharge: deferredSurcharge,
      due_month: state.month + 3,
    };
    stress = clampStat(stress + balance.deferral_stress_penalty);
  }

  const history = appendHistory(
    state.history,
    {
      id: `hist_qtax_${state.month}`,
      month: state.month,
      kind: "quarterly_tax",
      money_delta: -paidAmount,
    },
    balance.max_history_entries,
  );

  const nextState: GameState = {
    ...state,
    indicators: {
      ...state.indicators,
      money: Math.round(money),
      stress,
    },
    finances: {
      ...state.finances,
      current_quarter_billed: 0,
      accrued_tax_liability: 0,
      deferred_tax: deferredTax,
    },
    quarterly_report: null,
    annual_snapshot: {
      ...state.annual_snapshot,
      taxes_paid: state.annual_snapshot.taxes_paid + paidAmount,
    },
    history,
  };

  return {
    state: nextState,
    summary: {
      month: state.month,
      mode,
      paid_amount: paidAmount,
      deferred_amount: deferredAmount,
      deferred_surcharge: deferredSurcharge,
      deferred_tax_defaulted: deferredTaxDefaulted,
    },
  };
}

export function enqueueScheduledEvent(
  queue: readonly ScheduledEvent[],
  entry: ScheduledEvent,
): ScheduledEvent[] {
  const hasNearbyDuplicate = queue.some(
    (existing) =>
      existing.event_id === entry.event_id &&
      Math.abs(existing.trigger_month - entry.trigger_month) <= 6,
  );
  if (hasNearbyDuplicate) {
    return [...queue];
  }

  const next = [...queue];
  let insertIndex = next.length;
  for (let i = 0; i < next.length; i += 1) {
    if (entry.trigger_month < next[i]!.trigger_month) {
      insertIndex = i;
      break;
    }
  }
  next.splice(insertIndex, 0, entry);
  return next;
}

export function resolveEndingQuote(
  catalog: ContentCatalog,
  endingId: EndingId,
  customQuote?: string | null,
): string {
  if (customQuote && customQuote.trim().length > 0) {
    return customQuote.trim();
  }
  const configured = catalog.balance.ending_quotes?.[endingId];
  if (configured && configured.trim().length > 0) {
    return configured.trim();
  }
  return endingId;
}
