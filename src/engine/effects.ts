import {
  clampStat,
  computeEffectiveGestorFee,
  computeMarginalTaxRate,
  enqueueScheduledEvent,
  resolveEndingQuote,
} from "./economy.ts";
import { nextFloat, pickWeighted } from "./prng.ts";
import type { BusinessTier, ChoiceSpec, EffectsSpec, EventDef } from "./schemas/index.ts";
import {
  appendHistory,
  getBusinessTierConfig,
  getPrescripcionConfig,
  getTeamHeadcount,
  getTeamScalingConfig,
  resolvePartnerName,
  scaleMonetaryValue,
  substitutePartnerName,
} from "./state.ts";
import type {
  BusinessState,
  ChoiceOutcomeSummary,
  ContentCatalog,
  EmployeeState,
  FamilyState,
  FiscalExposureEntry,
  GameState,
  GestorState,
  PendingInvoice,
  ScheduledEvent,
  TemporalModifier,
} from "./types.ts";

export function getEffectiveScaledChoiceEffects(
  state: Pick<GameState, "business">,
  catalog: Pick<ContentCatalog, "balance">,
  event: Pick<EventDef, "scale_with_tier">,
  effects: EffectsSpec,
): EffectsSpec {
  if (!event.scale_with_tier) {
    return effects;
  }
  const mult = getBusinessTierConfig(state, catalog).event_stakes_multiplier;
  if (mult === 1) {
    return effects;
  }

  const scaled: EffectsSpec = { ...effects };

  if (scaled.billed_income != null) {
    scaled.billed_income = Math.max(0, scaleMonetaryValue(scaled.billed_income, mult));
  }
  if (scaled.cash_delta != null) {
    scaled.cash_delta = scaleMonetaryValue(scaled.cash_delta, mult);
  }
  if (scaled.deductible_expense != null) {
    scaled.deductible_expense = Math.max(0, scaleMonetaryValue(scaled.deductible_expense, mult));
  }
  if (scaled.deferred_invoice) {
    scaled.deferred_invoice = {
      ...scaled.deferred_invoice,
      amount: Math.max(1, scaleMonetaryValue(scaled.deferred_invoice.amount, mult)),
    };
  }
  if (scaled.add_modifier) {
    scaled.add_modifier = {
      ...scaled.add_modifier,
      ...(scaled.add_modifier.monthly_billed_delta != null
        ? {
            monthly_billed_delta: scaleMonetaryValue(
              scaled.add_modifier.monthly_billed_delta,
              mult,
            ),
          }
        : {}),
      ...(scaled.add_modifier.monthly_expense_delta != null
        ? {
            monthly_expense_delta: scaleMonetaryValue(
              scaled.add_modifier.monthly_expense_delta,
              mult,
            ),
          }
        : {}),
    };
  }
  if (scaled.dismiss_employee) {
    scaled.dismiss_employee = {
      ...scaled.dismiss_employee,
      severance_cost: Math.max(0, scaleMonetaryValue(scaled.dismiss_employee.severance_cost, mult)),
    };
  }
  if (scaled.shrink_team) {
    scaled.shrink_team = {
      ...scaled.shrink_team,
      severance_per_person: Math.max(
        0,
        scaleMonetaryValue(scaled.shrink_team.severance_per_person, mult),
      ),
    };
  }

  return scaled;
}

export function resolveChoiceEffects(
  state: GameState,
  catalog: ContentCatalog,
  event: EventDef,
  choice: ChoiceSpec,
): { state: GameState; summary: ChoiceOutcomeSummary } {
  const { balance } = catalog;
  let prng = state.prng;
  let rawEffects: EffectsSpec;
  let outcomeId: string | null = null;
  let resultText: string | null = choice.result_text ?? null;

  if (choice.outcomes && choice.outcomes.length > 0) {
    const picked = pickWeighted(prng, choice.outcomes);
    prng = picked.prng;
    outcomeId = picked.item.id;
    resultText = picked.item.result_text;
    rawEffects = picked.item.effects;
  } else if (choice.effects) {
    rawEffects = choice.effects;
  } else {
    throw new Error(
      `Choice '${choice.id}' in event '${event.id}' has neither effects nor outcomes.`,
    );
  }

  const effects = getEffectiveScaledChoiceEffects(state, catalog, event, rawEffects);

  const startMoney = state.indicators.money;
  const startMoral = state.indicators.moral;
  const startStress = state.indicators.stress;
  const startPersonalLife = state.indicators.personal_life;
  const startReputation = state.indicators.reputation;
  const startFiscalRisk = state.fiscal_risk;
  const startHeadcount = getTeamHeadcount(state);

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
  const historicalExposures: FiscalExposureEntry[] = [
    ...(state.finances.historical_exposures ?? []),
  ];

  const preChoiceTierConfig = getBusinessTierConfig(state, catalog);
  const marginalTaxRate = computeMarginalTaxRate(state, catalog);
  const usesProgressiveOrCorporateTax =
    preChoiceTierConfig.corporate_tax_regime ||
    Boolean(balance.irpf_brackets && balance.irpf_brackets.length > 0);
  const deductibleTaxRate = usesProgressiveOrCorporateTax
    ? marginalTaxRate
    : balance.deductible_tax_fraction;

  let annualBilled = state.annual_snapshot.billed;
  let annualExpenses = state.annual_snapshot.expenses;
  const milestones = [...state.annual_snapshot.milestones];
  const highlightEventIds = [...state.annual_snapshot.highlight_event_ids];
  if (highlightEventIds.length < 5 && !highlightEventIds.includes(event.id)) {
    highlightEventIds.push(event.id);
  }

  if (effects.billed_income != null && effects.billed_income > 0) {
    const billed = Math.round(effects.billed_income);
    const taxAccrual = Math.round(billed * marginalTaxRate);
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
    const taxRelief = Math.round(expense * deductibleTaxRate);
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

  // Record 4-year prescripción fiscal exposure on qualifying risky choices (ADR 004 §4.2)
  const presc = getPrescripcionConfig(catalog);
  const rawFiscalRiskDelta = effects.fiscal_risk ?? 0;
  const untaxedCash = Math.max(0, Math.round(effects.cash_delta ?? 0));
  if (
    rawFiscalRiskDelta >= presc.min_risk_points_recorded ||
    (rawFiscalRiskDelta >= 6 && untaxedCash >= 1000)
  ) {
    historicalExposures.push({
      id: `exp_${state.month}_${historicalExposures.length + 1}_${event.id}`,
      origin_month: state.month,
      expires_month: state.month + presc.window_months,
      risk_points: Math.round(rawFiscalRiskDelta),
      untaxed_amount: untaxedCash,
      source_event_id: event.id,
      audited: false,
    });
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

  // Business tier transitions + automatic sociedad_limitada_activa sync (ADR 004 §2.1)
  let business: BusinessState = {
    ...(state.business ?? {
      tier: "solo_autonomo" as const,
      months_in_tier: 0,
      sl_formed_month: null,
    }),
  };
  let businessTierChangedTo: BusinessTier | null = null;

  if (effects.set_business_tier) {
    const targetTier = effects.set_business_tier.tier;
    const entersCorporate =
      targetTier === "sociedad_limitada" || targetTier === "agencia_consultora";
    if (targetTier !== business.tier) {
      businessTierChangedTo = targetTier;
      business = {
        tier: targetTier,
        months_in_tier: 0,
        sl_formed_month: entersCorporate
          ? (business.sl_formed_month ?? state.month)
          : business.sl_formed_month,
      };
      milestones.push(`tier:${targetTier}`);
    } else if (entersCorporate && business.sl_formed_month === null) {
      business = { ...business, sl_formed_month: state.month };
    }
    if (entersCorporate) {
      flags.sociedad_limitada_activa = true;
    }
  } else if (
    effects.set_flags?.includes("sociedad_limitada_activa") &&
    (business.tier === "solo_autonomo" || business.tier === "estudio_consolidado")
  ) {
    businessTierChangedTo = "sociedad_limitada";
    business = {
      tier: "sociedad_limitada",
      months_in_tier: 0,
      sl_formed_month: business.sl_formed_month ?? state.month,
    };
    milestones.push("tier:sociedad_limitada");
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
        const nextQueue = enqueueScheduledEvent(scheduledQueue, {
          queue_id: `sched_${state.month}_${scheduledQueue.length + 1}_${sched.event_id}`,
          event_id: sched.event_id,
          trigger_month: state.month + sched.delay_months,
          origin_month: state.month,
          priority: sched.priority ?? "normal",
          source_event_id: event.id,
        });
        if (nextQueue.length > scheduledQueue.length) {
          scheduledEventIds.push(sched.event_id);
        }
        scheduledQueue = nextQueue;
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
      const fee = computeEffectiveGestorFee(tier, business.tier, catalog);
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
  } else if (businessTierChangedTo !== null && gestor.tier !== "self") {
    gestor = {
      ...gestor,
      monthly_fee: computeEffectiveGestorFee(gestor.tier, business.tier, catalog),
    };
  }

  let family: FamilyState = state.family;
  if (effects.set_family_status) {
    const { status, partner_character_id } = effects.set_family_status;
    if (status === "single" || status === "separated") {
      if (status === "separated") {
        flags.ex_pareja_alex = true;
      }
      Reflect.deleteProperty(flags, "crisis_pareja_latente");
      family = {
        status,
        partner_character_id: null,
        partner_name: family.partner_name,
        children_count: family.children_count,
        monthly_cost: family.children_count * balance.child_monthly_cost,
        support_modifier: 0,
        neglect_months: 0,
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
        partner_name: family.partner_name,
        children_count: family.children_count,
        monthly_cost: partnerCost + family.children_count * balance.child_monthly_cost,
        support_modifier: supportMod,
        neglect_months: family.neglect_months ?? 0,
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
  let employeeSatisfactionDelta = 0;

  if (effects.hire_employee) {
    const charId = effects.hire_employee.character_id;
    const charDef = catalog.characters[charId];
    if (!charDef || !charDef.employee_params) {
      throw new Error(`Invalid employee character '${charId}' referenced by hire_employee.`);
    }
    employee = {
      character_id: charId,
      role_label: charDef.employee_params.role_label,
      headcount: 1,
      lead_monthly_cost: charDef.employee_params.monthly_cost,
      monthly_cost: charDef.employee_params.monthly_cost,
      billing_multiplier: charDef.employee_params.billing_multiplier,
      satisfaction: 75,
      months_employed: 0,
    };
    milestones.push(`hire:${charId}`);
  }

  if (effects.expand_team) {
    const spec = effects.expand_team;
    const postTierConfig = getBusinessTierConfig({ business }, catalog);
    const maxCap = Math.min(12, postTierConfig.max_team_size);
    const teamScaling = getTeamScalingConfig(catalog);
    const unitCost = spec.avg_monthly_cost ?? teamScaling.default_staff_monthly_cost;

    if (employee === null) {
      const effectiveTotal = Math.min(spec.count, maxCap);
      if (effectiveTotal > 0) {
        const leadId = spec.lead_character_id ?? "empleado_junior_dani";
        const leadDef = catalog.characters[leadId];
        if (!leadDef || !leadDef.employee_params) {
          throw new Error(`Invalid lead employee character '${leadId}' referenced by expand_team.`);
        }
        const leadCost = leadDef.employee_params.monthly_cost;
        employee = {
          character_id: leadId,
          role_label: spec.role_label ?? leadDef.employee_params.role_label,
          headcount: effectiveTotal,
          lead_monthly_cost: leadCost,
          monthly_cost: leadCost + (effectiveTotal - 1) * unitCost,
          billing_multiplier: leadDef.employee_params.billing_multiplier,
          satisfaction: 75,
          months_employed: 0,
        };
        milestones.push(`expand_team:+${effectiveTotal}`);
      }
    } else {
      let nextCharId = employee.character_id;
      let nextRoleLabel = spec.role_label ?? employee.role_label;
      let nextLeadCost = employee.lead_monthly_cost ?? employee.monthly_cost;
      let nextBillingMultiplier = employee.billing_multiplier;
      let nextMonthlyCost = employee.monthly_cost;

      if (spec.lead_character_id && spec.lead_character_id !== employee.character_id) {
        const newLeadDef = catalog.characters[spec.lead_character_id];
        if (!newLeadDef || !newLeadDef.employee_params) {
          throw new Error(
            `Invalid lead employee character '${spec.lead_character_id}' referenced by expand_team.`,
          );
        }
        const newLeadCost = newLeadDef.employee_params.monthly_cost;
        nextMonthlyCost = Math.max(newLeadCost, nextMonthlyCost + (newLeadCost - nextLeadCost));
        nextCharId = spec.lead_character_id;
        nextRoleLabel = spec.role_label ?? newLeadDef.employee_params.role_label;
        nextLeadCost = newLeadCost;
        nextBillingMultiplier = newLeadDef.employee_params.billing_multiplier;
      }

      const currentHeadcount = Math.max(1, employee.headcount ?? 1);
      const added = Math.max(0, Math.min(spec.count, maxCap - currentHeadcount));
      employee = {
        ...employee,
        character_id: nextCharId,
        role_label: nextRoleLabel,
        headcount: currentHeadcount + added,
        lead_monthly_cost: nextLeadCost,
        monthly_cost: nextMonthlyCost + added * unitCost,
        billing_multiplier: nextBillingMultiplier,
      };
      if (added > 0) {
        milestones.push(`expand_team:+${added}`);
      }
    }
  }

  if (effects.shrink_team && employee !== null) {
    const spec = effects.shrink_team;
    const currentHeadcount = Math.max(1, employee.headcount ?? 1);
    const removed = spec.dismiss_all ? currentHeadcount : Math.min(spec.count, currentHeadcount);
    const totalSeverance = Math.round(removed * spec.severance_per_person);
    money -= totalSeverance;
    annualExpenses += totalSeverance;

    if (currentHeadcount - removed <= 0) {
      employee = null;
    } else {
      const leadCost = employee.lead_monthly_cost ?? employee.monthly_cost;
      const nonLeadCount = Math.max(1, currentHeadcount - 1);
      const avgNonLeadCost = Math.max(
        0,
        Math.round((employee.monthly_cost - leadCost) / nonLeadCount),
      );
      const nextMonthlyCost = Math.max(leadCost, employee.monthly_cost - removed * avgNonLeadCost);
      const beforeSat = employee.satisfaction;
      const nextSat = effects.employee_satisfaction != null ? beforeSat : clampStat(beforeSat - 6);
      employeeSatisfactionDelta += nextSat - beforeSat;
      employee = {
        ...employee,
        headcount: currentHeadcount - removed,
        monthly_cost: nextMonthlyCost,
        satisfaction: nextSat,
      };
    }
    milestones.push(`shrink_team:-${removed}`);
  }

  if (effects.dismiss_employee) {
    const severance = Math.round(effects.dismiss_employee.severance_cost);
    money -= severance;
    annualExpenses += severance;
    if (employee !== null) {
      const currentHeadcount = Math.max(1, employee.headcount ?? 1);
      if (currentHeadcount <= 1) {
        employee = null;
      } else {
        const leadCost = employee.lead_monthly_cost ?? employee.monthly_cost;
        const avgNonLeadCost = Math.max(
          0,
          Math.round((employee.monthly_cost - leadCost) / (currentHeadcount - 1)),
        );
        const beforeSat = employee.satisfaction;
        const nextSat = clampStat(beforeSat - 5);
        employeeSatisfactionDelta += nextSat - beforeSat;
        employee = {
          ...employee,
          headcount: currentHeadcount - 1,
          monthly_cost: Math.max(leadCost, employee.monthly_cost - avgNonLeadCost),
          satisfaction: nextSat,
        };
      }
    }
    milestones.push("dismiss_employee");
  }

  if (effects.employee_satisfaction != null && employee !== null) {
    const beforeSat = employee.satisfaction;
    const nextSat = clampStat(beforeSat + Math.round(effects.employee_satisfaction));
    employeeSatisfactionDelta += nextSat - beforeSat;
    employee = {
      ...employee,
      satisfaction: nextSat,
    };
  }

  const endHeadcount = employee ? Math.max(1, employee.headcount ?? 1) : 0;
  const teamHeadcountDelta = endHeadcount - startHeadcount;

  const occurrences = {
    ...state.occurrences,
    [event.id]: (state.occurrences[event.id] ?? 0) + 1,
  };

  const cooldowns = { ...state.cooldowns };
  if (event.cooldown_months > 0) {
    cooldowns[event.id] = state.month + event.cooldown_months + 1;
  }

  const partnerName = resolvePartnerName(state);
  const personalizedResultText =
    resultText !== null ? substitutePartnerName(resultText, partnerName) : null;
  const personalizedEventTitle = substitutePartnerName(event.title, partnerName);
  const personalizedChoiceLabel = substitutePartnerName(choice.label, partnerName);

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
      title: personalizedEventTitle,
      summary: personalizedResultText ?? personalizedChoiceLabel,
      money_delta: moneyDelta,
    },
    balance.max_history_entries,
  );

  let ending = state.ending;
  let phase = state.phase;

  if (effects.trigger_ending) {
    const endingId = effects.trigger_ending;
    const quote = substitutePartnerName(
      resolveEndingQuote(catalog, endingId, personalizedResultText),
      partnerName,
    );
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
      historical_exposures: historicalExposures,
    },
    business,
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
      result_text: personalizedResultText,
      money_delta: moneyDelta,
      moral_delta: moral - startMoral,
      stress_delta: stress - startStress,
      personal_life_delta: personalLife - startPersonalLife,
      reputation_delta: reputation - startReputation,
      fiscal_risk_delta: fiscalRisk - startFiscalRisk,
      tax_accrued_delta: accruedTaxLiability - startAccruedTax,
      employee_satisfaction_delta: employeeSatisfactionDelta,
      business_tier_changed_to: businessTierChangedTo,
      team_headcount_delta: teamHeadcountDelta,
      scheduled_event_ids: scheduledEventIds,
    },
  };
}
