import { clampStat, enqueueScheduledEvent, resolveEndingQuote } from "./economy.ts";
import { nextFloat, pickWeighted } from "./prng.ts";
import type { ChoiceSpec, EffectsSpec, EventDef } from "./schemas/index.ts";
import { appendHistory } from "./state.ts";
import type {
  ChoiceOutcomeSummary,
  ContentCatalog,
  EmployeeState,
  FamilyState,
  GameState,
  GestorState,
  PendingInvoice,
  ScheduledEvent,
  TemporalModifier,
} from "./types.ts";

export function resolveChoiceEffects(
  state: GameState,
  catalog: ContentCatalog,
  event: EventDef,
  choice: ChoiceSpec,
): { state: GameState; summary: ChoiceOutcomeSummary } {
  const { balance } = catalog;
  let prng = state.prng;
  let effects: EffectsSpec;
  let outcomeId: string | null = null;
  let resultText: string | null = choice.result_text ?? null;

  if (choice.outcomes && choice.outcomes.length > 0) {
    const picked = pickWeighted(prng, choice.outcomes);
    prng = picked.prng;
    outcomeId = picked.item.id;
    resultText = picked.item.result_text;
    effects = picked.item.effects;
  } else if (choice.effects) {
    effects = choice.effects;
  } else {
    throw new Error(
      `Choice '${choice.id}' in event '${event.id}' has neither effects nor outcomes.`,
    );
  }

  const startMoney = state.indicators.money;
  const startMoral = state.indicators.moral;
  const startStress = state.indicators.stress;
  const startPersonalLife = state.indicators.personal_life;
  const startReputation = state.indicators.reputation;
  const startFiscalRisk = state.fiscal_risk;

  let money = startMoney;
  let moral = startMoral;
  let stress = startStress;
  let personalLife = startPersonalLife;
  let reputation = startReputation;
  let fiscalRisk = startFiscalRisk;

  let lifetimeBilled = state.finances.lifetime_billed;
  let currentQuarterBilled = state.finances.current_quarter_billed;
  const startAccruedTax = state.finances.accrued_tax_liability;
  let accruedTaxLiability = startAccruedTax;
  const pendingInvoices: PendingInvoice[] = [...state.finances.pending_invoices];

  let annualBilled = state.annual_snapshot.billed;
  let annualExpenses = state.annual_snapshot.expenses;
  const milestones = [...state.annual_snapshot.milestones];
  const highlightEventIds = [...state.annual_snapshot.highlight_event_ids];
  if (highlightEventIds.length < 5 && !highlightEventIds.includes(event.id)) {
    highlightEventIds.push(event.id);
  }

  if (effects.billed_income != null && effects.billed_income > 0) {
    const billed = Math.round(effects.billed_income);
    const taxAccrual = Math.round(billed * balance.effective_quarterly_tax_rate);
    money += billed;
    lifetimeBilled += billed;
    currentQuarterBilled += billed;
    accruedTaxLiability += taxAccrual;
    annualBilled += billed;
  }

  if (effects.cash_delta != null && effects.cash_delta !== 0) {
    const delta = Math.round(effects.cash_delta);
    money += delta;
    if (delta < 0) {
      annualExpenses += Math.abs(delta);
    }
  }

  if (effects.deductible_expense != null && effects.deductible_expense > 0) {
    const expense = Math.round(effects.deductible_expense);
    const taxRelief = Math.round(expense * balance.deductible_tax_fraction);
    money -= expense;
    accruedTaxLiability = Math.max(0, accruedTaxLiability - taxRelief);
    annualExpenses += expense;
  }

  if (effects.deferred_invoice) {
    const inv = effects.deferred_invoice;
    pendingInvoices.push({
      id: `inv_${state.month}_${pendingInvoices.length + 1}_${event.id}`,
      source_event_id: event.id,
      amount: Math.round(inv.amount),
      due_month: state.month + inv.delay_months,
      default_prob: inv.default_prob,
    });
  }

  if (effects.moral != null) {
    moral = clampStat(moral + effects.moral);
  }
  if (effects.stress != null) {
    stress = clampStat(stress + effects.stress);
  }
  if (effects.personal_life != null) {
    personalLife = clampStat(personalLife + effects.personal_life);
  }
  if (effects.reputation != null) {
    reputation = clampStat(reputation + effects.reputation);
  }
  if (effects.fiscal_risk != null) {
    fiscalRisk = clampStat(fiscalRisk + effects.fiscal_risk);
  }

  const flags = { ...state.flags };
  if (effects.clear_flags) {
    for (const flag of effects.clear_flags) {
      delete flags[flag];
    }
  }
  if (effects.set_flags) {
    for (const flag of effects.set_flags) {
      flags[flag] = true;
    }
  }

  let scheduledQueue: ScheduledEvent[] = [...state.scheduled_queue];
  const scheduledEventIds: string[] = [];
  if (effects.schedule_events) {
    for (const sched of effects.schedule_events) {
      const prob = sched.probability ?? 1;
      let hit = false;
      if (prob >= 1) {
        hit = true;
      } else if (prob > 0) {
        const roll = nextFloat(prng);
        prng = roll.prng;
        hit = roll.value < prob;
      }
      if (hit) {
        scheduledEventIds.push(sched.event_id);
        scheduledQueue = enqueueScheduledEvent(scheduledQueue, {
          queue_id: `sched_${state.month}_${scheduledQueue.length + 1}_${sched.event_id}`,
          event_id: sched.event_id,
          trigger_month: state.month + sched.delay_months,
          source_event_id: event.id,
        });
      }
    }
  }

  let modifiers: TemporalModifier[] = [...state.modifiers];
  if (effects.add_modifier) {
    const spec = effects.add_modifier;
    const filtered = modifiers.filter((m) => m.id !== spec.id);
    modifiers = [
      ...filtered,
      {
        id: spec.id,
        label: spec.label,
        remaining_months: spec.remaining_months,
        monthly_billed_delta: spec.monthly_billed_delta,
        monthly_expense_delta: spec.monthly_expense_delta,
        monthly_moral_delta: spec.monthly_moral_delta,
        monthly_stress_delta: spec.monthly_stress_delta,
      },
    ];
  }

  let gestor: GestorState = state.gestor;
  if (effects.set_gestor) {
    const { tier, character_id } = effects.set_gestor;
    if (tier === "self") {
      gestor = {
        tier: "self",
        character_id: null,
        monthly_fee: balance.gestor_tiers.self.monthly_fee,
        inspection_shield: balance.gestor_tiers.self.inspection_shield,
        months_active: 0,
      };
    } else {
      const charDef = character_id ? catalog.characters[character_id] : undefined;
      const fee = balance.gestor_tiers[tier].monthly_fee ?? charDef?.gestor_params?.monthly_fee;
      const shield =
        balance.gestor_tiers[tier].inspection_shield ?? charDef?.gestor_params?.inspection_shield;
      gestor = {
        tier,
        character_id: character_id ?? null,
        monthly_fee: fee,
        inspection_shield: shield,
        months_active: gestor.character_id === (character_id ?? null) ? gestor.months_active : 0,
      };
    }
    milestones.push(`gestor:${tier}`);
  }

  let family: FamilyState = state.family;
  if (effects.set_family_status) {
    const { status, partner_character_id } = effects.set_family_status;
    if (status === "single" || status === "separated") {
      if (status === "separated") {
        flags.ex_pareja_alex = true;
      }
      family = {
        status,
        partner_character_id: null,
        children_count: family.children_count,
        monthly_cost: family.children_count * balance.child_monthly_cost,
        support_modifier: 0,
      };
    } else {
      flags.historia_con_alex = true;
      const resolvedPartnerId =
        partner_character_id === null
          ? null
          : (partner_character_id ??
            family.partner_character_id ??
            (catalog.characters.pareja_alex ? "pareja_alex" : null));
      const partnerDef = resolvedPartnerId ? catalog.characters[resolvedPartnerId] : undefined;
      const partnerCost =
        balance.default_partner_monthly_cost ?? partnerDef?.family_params?.monthly_cost;
      const supportMod =
        balance.default_partner_support_modifier ?? partnerDef?.family_params?.support_modifier;
      family = {
        status,
        partner_character_id: resolvedPartnerId,
        children_count: family.children_count,
        monthly_cost: partnerCost + family.children_count * balance.child_monthly_cost,
        support_modifier: supportMod,
      };
    }
    milestones.push(`family:${status}`);
  }

  if (effects.add_child != null && effects.add_child > 0) {
    const addedChildren = Math.round(effects.add_child);
    family = {
      ...family,
      children_count: family.children_count + addedChildren,
      monthly_cost: family.monthly_cost + addedChildren * balance.child_monthly_cost,
    };
    milestones.push(`children:+${addedChildren}`);
  }

  let employee: EmployeeState | null = state.employee;
  if (effects.hire_employee) {
    const charId = effects.hire_employee.character_id;
    const charDef = catalog.characters[charId];
    if (!charDef || !charDef.employee_params) {
      throw new Error(`Invalid employee character '${charId}' referenced by hire_employee.`);
    }
    employee = {
      character_id: charId,
      role_label: charDef.employee_params.role_label,
      monthly_cost: charDef.employee_params.monthly_cost,
      billing_multiplier: charDef.employee_params.billing_multiplier,
      satisfaction: 75,
      months_employed: 0,
    };
    milestones.push(`hire:${charId}`);
  }

  if (effects.dismiss_employee) {
    const severance = Math.round(effects.dismiss_employee.severance_cost);
    money -= severance;
    annualExpenses += severance;
    employee = null;
    milestones.push("dismiss_employee");
  }

  let employeeSatisfactionDelta = 0;
  if (effects.employee_satisfaction != null && employee !== null) {
    const beforeSat = employee.satisfaction;
    const nextSat = clampStat(beforeSat + Math.round(effects.employee_satisfaction));
    employeeSatisfactionDelta = nextSat - beforeSat;
    employee = {
      ...employee,
      satisfaction: nextSat,
    };
  }

  const occurrences = {
    ...state.occurrences,
    [event.id]: (state.occurrences[event.id] ?? 0) + 1,
  };

  const cooldowns = { ...state.cooldowns };
  if (event.cooldown_months > 0) {
    cooldowns[event.id] = state.month + event.cooldown_months + 1;
  }

  const moneyDelta = Math.round(money) - startMoney;

  let history = appendHistory(
    state.history,
    {
      id: `hist_choice_${state.month}_${event.id}_${choice.id}_${occurrences[event.id]}`,
      month: state.month,
      kind: "event_choice",
      event_id: event.id,
      choice_id: choice.id,
      outcome_id: outcomeId ?? undefined,
      title: event.title,
      summary: resultText ?? choice.label,
      money_delta: moneyDelta,
    },
    balance.max_history_entries,
  );

  let ending = state.ending;
  let phase = state.phase;

  if (effects.trigger_ending) {
    const endingId = effects.trigger_ending;
    const quote = resolveEndingQuote(catalog, endingId, resultText);
    ending = {
      id: endingId,
      month: state.month,
      summary_quote: quote,
    };
    phase = "game_over";
    history = appendHistory(
      history,
      {
        id: `hist_end_${state.month}_${endingId}`,
        month: state.month,
        kind: "game_over",
        event_id: event.id,
        summary: quote,
      },
      balance.max_history_entries,
    );
  }

  const nextState: GameState = {
    ...state,
    prng,
    phase,
    indicators: {
      money: Math.round(money),
      moral,
      stress,
      personal_life: personalLife,
      reputation,
    },
    fiscal_risk: fiscalRisk,
    finances: {
      ...state.finances,
      lifetime_billed: lifetimeBilled,
      current_quarter_billed: currentQuarterBilled,
      accrued_tax_liability: accruedTaxLiability,
      pending_invoices: pendingInvoices,
    },
    gestor,
    family,
    employee,
    flags,
    cooldowns,
    occurrences,
    scheduled_queue: scheduledQueue,
    modifiers,
    ending,
    annual_snapshot: {
      ...state.annual_snapshot,
      billed: annualBilled,
      expenses: annualExpenses,
      events_resolved: state.annual_snapshot.events_resolved + 1,
      highlight_event_ids: highlightEventIds,
      milestones,
    },
    history,
  };

  return {
    state: nextState,
    summary: {
      event_id: event.id,
      choice_id: choice.id,
      outcome_id: outcomeId,
      result_text: resultText,
      money_delta: moneyDelta,
      moral_delta: moral - startMoral,
      stress_delta: stress - startStress,
      personal_life_delta: personalLife - startPersonalLife,
      reputation_delta: reputation - startReputation,
      fiscal_risk_delta: fiscalRisk - startFiscalRisk,
      tax_accrued_delta: accruedTaxLiability - startAccruedTax,
      employee_satisfaction_delta: employeeSatisfactionDelta,
      scheduled_event_ids: scheduledEventIds,
    },
  };
}
