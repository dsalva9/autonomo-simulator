import { nextFloat } from "./prng.ts";
import { appendHistory } from "./state.ts";
import type {
  ContentCatalog,
  EndingId,
  GameState,
  InvoiceSettlementResult,
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

  let employeeMultiplier = 1;
  if (state.employee) {
    const satScale = 0.4 + 0.8 * (clampStat(state.employee.satisfaction) / 100);
    employeeMultiplier = 1 + (state.employee.billing_multiplier - 1) * satScale;
  }

  let modifierBilledDelta = 0;
  for (const mod of state.modifiers) {
    if (mod.monthly_billed_delta != null) {
      modifierBilledDelta += mod.monthly_billed_delta;
    }
  }

  const gross =
    balance.base_monthly_billing * repFactor * moralFactor * employeeMultiplier +
    modifierBilledDelta;

  return Math.max(0, Math.round(gross));
}

export function computeMonthlyDeductibleExpenses(
  state: GameState,
  catalog: ContentCatalog,
): number {
  const { balance } = catalog;
  let modifierExpenseDelta = 0;
  for (const mod of state.modifiers) {
    if (mod.monthly_expense_delta != null) {
      modifierExpenseDelta += mod.monthly_expense_delta;
    }
  }

  const employeeCost = state.employee ? state.employee.monthly_cost : 0;
  const deductible =
    balance.autonomo_quota +
    state.gestor.monthly_fee +
    employeeCost +
    Math.max(0, modifierExpenseDelta);

  return Math.max(0, Math.round(deductible));
}

export function computeMonthlyRecurringExpenses(state: GameState, catalog: ContentCatalog): number {
  const { balance } = catalog;
  let modifierExpenseDelta = 0;
  for (const mod of state.modifiers) {
    if (mod.monthly_expense_delta != null) {
      modifierExpenseDelta += mod.monthly_expense_delta;
    }
  }

  const elapsedYears = Math.max(0, Math.floor((state.month - 1) / 12));
  const fullGrowthYears = Math.max(0, Math.floor((balance.victory_month - 1) / 12));
  const effectiveYears =
    elapsedYears <= fullGrowthYears
      ? elapsedYears
      : fullGrowthYears + (elapsedYears - fullGrowthYears) * 0.5;
  const livingCostCreep = effectiveYears * (balance.annual_living_cost_growth ?? 0);
  const employeeCost = state.employee ? state.employee.monthly_cost : 0;
  const total =
    balance.base_living_cost +
    livingCostCreep +
    balance.autonomo_quota +
    state.gestor.monthly_fee +
    state.family.monthly_cost +
    employeeCost +
    modifierExpenseDelta;

  return Math.max(0, Math.round(total));
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
      const taxOnInvoice = Math.round(invoice.amount * balance.effective_quarterly_tax_rate);
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

  const grossBilling = computeBaselineMonthlyBilling(state, catalog);
  const deductibleExpenses = computeMonthlyDeductibleExpenses(state, catalog);
  const taxAccruedOnBilling = Math.round(grossBilling * balance.effective_quarterly_tax_rate);
  const taxShieldOnExpenses = Math.round(deductibleExpenses * balance.deductible_tax_fraction);
  const rawTax = taxAccruedOnBilling - taxShieldOnExpenses;
  const accruedBeforeRecurring = accruedTaxLiability;

  money += grossBilling;
  lifetimeBilled += grossBilling;
  currentQuarterBilled += grossBilling;
  accruedTaxLiability = Math.max(0, accruedTaxLiability + rawTax);
  const netTaxAccrued = accruedTaxLiability - accruedBeforeRecurring;
  annualBilled += grossBilling;

  const totalExpenses = computeMonthlyRecurringExpenses(state, catalog);
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
  if (state.family.support_modifier !== 0) {
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
      maintenancePersonalLifeDelta = personalLife - beforePl;
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
    if (state.fiscal_risk >= 60) {
      rawMoralDrift -= 5;
    } else if (state.fiscal_risk >= 35) {
      rawMoralDrift -= 3;
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
        state.fiscal_risk >= 28 ||
        reputation <= 28 ||
        personalLife <= 32 ||
        state.finances.consecutive_negative_months >= 1)
    ) {
      rawMoralDrift -= 4;
    }
    if (rawMoralDrift !== 0) {
      const beforeMoral = moral;
      moral = clampStat(moral + rawMoralDrift);
      maintenanceMoralDelta = moral - beforeMoral;
    }
  }

  const nextGestor = {
    ...state.gestor,
    months_active: state.gestor.months_active + 1,
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
    },
    gestor: nextGestor,
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
): { state: GameState; report: QuarterlyReport } {
  const { balance } = catalog;
  let prng = state.prng;
  let accruedTax = state.finances.accrued_tax_liability;
  let stress = state.indicators.stress;
  let fiscalRisk = state.fiscal_risk;
  let scheduledQueue: ScheduledEvent[] = [...state.scheduled_queue];
  let history = state.history;

  let gestorErrorSurcharge = 0;
  const tierConfig = balance.gestor_tiers[state.gestor.tier];
  if (tierConfig.quarterly_error_prob > 0 && accruedTax > 0) {
    const roll = nextFloat(prng);
    prng = roll.prng;
    if (roll.value < tierConfig.quarterly_error_prob) {
      gestorErrorSurcharge = tierConfig.quarterly_error_surcharge;
      accruedTax += gestorErrorSurcharge;
      stress = clampStat(stress + tierConfig.quarterly_error_stress);
    }
  }

  let inspectionTriggered = false;
  let inspectionScheduledEventId: string | null = null;
  let inspectionFallbackFine = 0;
  const curve = balance.inspection_curve;

  if (fiscalRisk >= curve.min_fiscal_risk) {
    const span = Math.max(1, 100 - curve.min_fiscal_risk);
    const normalized = Math.max(0, Math.min(1, (fiscalRisk - curve.min_fiscal_risk) / span));
    const rawProb = curve.max_probability * normalized ** curve.exponent;
    const effectiveProb = Math.max(0, Math.min(1, rawProb * (1 - state.gestor.inspection_shield)));

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
    inspection_triggered: inspectionTriggered,
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
    },
    fiscal_risk: fiscalRisk,
    finances: {
      ...state.finances,
      accrued_tax_liability: accruedTax,
    },
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
    if (money < balance.hard_debt_floor) {
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
  const next = [...queue];
  let insertIndex = next.length;
  for (let i = 0; i < next.length; i += 1) {
    if (entry.trigger_month < next[i].trigger_month) {
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
