import { pickWeighted } from "./prng.ts";
import type { ChoiceSpec, EventDef, RequirementsSpec } from "./schemas/index.ts";
import {
  getBusinessTierConfig,
  getPartnerPressureConfig,
  getTeamHeadcount,
  scaleMonetaryValue,
} from "./state.ts";
import type { ContentCatalog, GameState, PrngState, ScheduledEvent } from "./types.ts";

export interface EvaluateRequirementsOptions {
  moneyScaleMultiplier?: number;
}

export function evaluateRequirements(
  state: GameState,
  requirements?: RequirementsSpec | null,
  options?: EvaluateRequirementsOptions,
): boolean {
  if (!requirements) {
    return true;
  }

  if (requirements.min_month != null && state.month < requirements.min_month) {
    return false;
  }
  if (requirements.max_month != null && state.month > requirements.max_month) {
    return false;
  }
  if (requirements.months_of_year && requirements.months_of_year.length > 0) {
    const monthOfYear = ((state.month - 1) % 12) + 1;
    if (!requirements.months_of_year.includes(monthOfYear)) {
      return false;
    }
  }

  const moneyScale = options?.moneyScaleMultiplier ?? 1;

  if (requirements.stats) {
    const statEntries = Object.entries(requirements.stats) as [
      keyof NonNullable<RequirementsSpec["stats"]>,
      { min?: number | null; max?: number | null } | undefined,
    ][];

    for (const [statKey, range] of statEntries) {
      if (!range) {
        continue;
      }
      const currentVal = statKey === "fiscal_risk" ? state.fiscal_risk : state.indicators[statKey];
      const minVal =
        range.min != null
          ? statKey === "money" && moneyScale !== 1
            ? scaleMonetaryValue(range.min, moneyScale)
            : range.min
          : null;
      const maxVal =
        range.max != null
          ? statKey === "money" && moneyScale !== 1
            ? scaleMonetaryValue(range.max, moneyScale)
            : range.max
          : null;
      if (minVal != null && currentVal < minVal) {
        return false;
      }
      if (maxVal != null && currentVal > maxVal) {
        return false;
      }
    }
  }

  if (
    requirements.employee_satisfaction &&
    (requirements.employee_satisfaction.min != null ||
      requirements.employee_satisfaction.max != null)
  ) {
    if (state.employee === null) {
      return false;
    }
    const sat = state.employee.satisfaction;
    if (
      requirements.employee_satisfaction.min != null &&
      sat < requirements.employee_satisfaction.min
    ) {
      return false;
    }
    if (
      requirements.employee_satisfaction.max != null &&
      sat > requirements.employee_satisfaction.max
    ) {
      return false;
    }
  }

  if (requirements.required_flags) {
    for (const flag of requirements.required_flags) {
      if (!state.flags[flag]) {
        return false;
      }
    }
  }

  if (requirements.forbidden_flags) {
    for (const flag of requirements.forbidden_flags) {
      if (state.flags[flag]) {
        return false;
      }
    }
  }

  if (requirements.gestor_tiers && requirements.gestor_tiers.length > 0) {
    if (!requirements.gestor_tiers.includes(state.gestor.tier)) {
      return false;
    }
  }

  if (requirements.family_statuses && requirements.family_statuses.length > 0) {
    if (!requirements.family_statuses.includes(state.family.status)) {
      return false;
    }
  }

  if (requirements.has_employee != null) {
    const currentlyHasEmployee = state.employee !== null;
    if (currentlyHasEmployee !== requirements.has_employee) {
      return false;
    }
  }

  if (requirements.business_tiers && requirements.business_tiers.length > 0) {
    const currentTier = state.business?.tier ?? "solo_autonomo";
    if (!requirements.business_tiers.includes(currentTier)) {
      return false;
    }
  }

  if (
    requirements.team_size &&
    (requirements.team_size.min != null || requirements.team_size.max != null)
  ) {
    const headcount = getTeamHeadcount(state);
    if (requirements.team_size.min != null && headcount < requirements.team_size.min) {
      return false;
    }
    if (requirements.team_size.max != null && headcount > requirements.team_size.max) {
      return false;
    }
  }

  if (
    requirements.children_count &&
    (requirements.children_count.min != null || requirements.children_count.max != null)
  ) {
    const children = state.family.children_count;
    if (requirements.children_count.min != null && children < requirements.children_count.min) {
      return false;
    }
    if (requirements.children_count.max != null && children > requirements.children_count.max) {
      return false;
    }
  }

  return true;
}

export function isChoiceEligible(
  state: GameState,
  choice: ChoiceSpec,
  event?: Pick<EventDef, "scale_with_tier">,
  catalog?: Pick<ContentCatalog, "balance">,
): boolean {
  const moneyScaleMultiplier = event?.scale_with_tier
    ? getBusinessTierConfig(state, catalog).event_stakes_multiplier
    : 1;
  return evaluateRequirements(state, choice.requirements, { moneyScaleMultiplier });
}

export function getEligibleChoices(
  state: GameState,
  event: EventDef,
  catalog?: Pick<ContentCatalog, "balance">,
): ChoiceSpec[] {
  return event.choices.filter((choice) => isChoiceEligible(state, choice, event, catalog));
}

export function isEventOnCooldown(state: GameState, eventId: string): boolean {
  const earliestEligibleMonth = state.cooldowns[eventId] ?? 0;
  return state.month < earliestEligibleMonth;
}

export function isEventHardEligible(
  state: GameState,
  event: EventDef,
  excludedEventIds?: ReadonlySet<string>,
  catalog?: Pick<ContentCatalog, "balance">,
): boolean {
  if (excludedEventIds?.has(event.id)) {
    return false;
  }

  if (event.max_occurrences != null) {
    const seenCount = state.occurrences[event.id] ?? 0;
    if (seenCount >= event.max_occurrences) {
      return false;
    }
  }

  if (event.exclusive_with && event.exclusive_with.length > 0) {
    for (const exclusiveId of event.exclusive_with) {
      if ((state.occurrences[exclusiveId] ?? 0) > 0 || excludedEventIds?.has(exclusiveId)) {
        return false;
      }
    }
  }

  if (!evaluateRequirements(state, event.requirements)) {
    return false;
  }

  return getEligibleChoices(state, event, catalog).length >= 1;
}

const CRITICAL_PARTNER_TAGS = new Set(["crisis_pareja", "pareja_ultimatum"]);
const PARTNER_CRISIS_TAGS = new Set(["crisis_pareja", "pareja"]);
const PARTNER_SYNERGY_TAGS = new Set(["sinergia_pareja", "red_pareja"]);

export function computeEffectiveEventWeight(
  event: EventDef,
  state: GameState,
  catalog: ContentCatalog,
): number {
  if (event.weight <= 0) {
    return 0;
  }
  const seenCount = state.occurrences[event.id] ?? 0;
  const decayK = catalog.balance.event_novelty_decay_k ?? 0.85;
  const baseWeight =
    seenCount <= 0 ? event.weight : event.weight / (1 + decayK * seenCount) ** 1.35;

  const pp = getPartnerPressureConfig(catalog);
  let contextMultiplier = 1;

  const isPartnered = state.family.status === "dating" || state.family.status === "cohabiting";
  if (isPartnered && event.category === "familia") {
    const neglectMonths = state.family.neglect_months ?? 0;
    const personalLife = state.indicators.personal_life;
    const isPartnerChar = event.character_id === "pareja_alex";
    const hasCriticalTag = Boolean(event.tags?.some((tag) => CRITICAL_PARTNER_TAGS.has(tag)));
    const hasCrisisTag = Boolean(event.tags?.some((tag) => PARTNER_CRISIS_TAGS.has(tag)));
    const hasSynergyTag = Boolean(event.tags?.some((tag) => PARTNER_SYNERGY_TAGS.has(tag)));

    if ((personalLife <= 25 || neglectMonths >= 5) && (isPartnerChar || hasCriticalTag)) {
      contextMultiplier *= pp.critical_crisis_weight_multiplier;
    } else if (
      (personalLife <= pp.neglect_personal_life_threshold || neglectMonths >= 3) &&
      (isPartnerChar || hasCrisisTag)
    ) {
      contextMultiplier *= pp.crisis_weight_multiplier;
    }

    if (personalLife >= pp.synergy_personal_life_threshold && hasSynergyTag) {
      contextMultiplier *= pp.synergy_weight_multiplier;
    }
  }

  const businessTier = state.business?.tier ?? "solo_autonomo";
  if (
    (businessTier === "sociedad_limitada" || businessTier === "agencia_consultora") &&
    event.requirements?.business_tiers?.includes(businessTier)
  ) {
    contextMultiplier *= pp.tier_event_weight_multiplier;
  }

  return baseWeight * contextMultiplier;
}

export function pickNoveltyWeightedEvent(
  prng: PrngState,
  pool: readonly EventDef[],
  state: GameState,
  catalog: ContentCatalog,
): { item: EventDef; prng: PrngState } {
  const weightedPool = pool.map((event) => ({
    event,
    weight: computeEffectiveEventWeight(event, state, catalog),
  }));
  const picked = pickWeighted(prng, weightedPool);
  return { item: picked.item.event, prng: picked.prng };
}

export interface DrawTurnEventsResult {
  state: GameState;
  drawnEventIds: string[];
  cooldownRelaxed: boolean;
}

export function drawTurnEvents(state: GameState, catalog: ContentCatalog): DrawTurnEventsResult {
  const eventMap = new Map<string, EventDef>();
  for (const event of catalog.events) {
    eventMap.set(event.id, event);
  }

  let prng = state.prng;
  let slot1Event: EventDef | null = null;
  const dueWithIndex: { entry: ScheduledEvent; originalIndex: number }[] = [];
  const futureQueue: ScheduledEvent[] = [];

  for (let i = 0; i < state.scheduled_queue.length; i += 1) {
    const queued = state.scheduled_queue[i]!;
    if (queued.trigger_month > state.month) {
      futureQueue.push(queued);
    } else {
      dueWithIndex.push({ entry: queued, originalIndex: i });
    }
  }

  dueWithIndex.sort((a, b) => {
    const prioA = a.entry.priority === "high" ? 0 : 1;
    const prioB = b.entry.priority === "high" ? 0 : 1;
    if (prioA !== prioB) {
      return prioA - prioB;
    }
    if (a.entry.trigger_month !== b.entry.trigger_month) {
      return a.entry.trigger_month - b.entry.trigger_month;
    }
    return a.originalIndex - b.originalIndex;
  });

  const remainingDue: ScheduledEvent[] = [];

  for (const { entry: queued } of dueWithIndex) {
    if (slot1Event !== null) {
      remainingDue.push(queued);
      continue;
    }

    const targetEvent = eventMap.get(queued.event_id);
    const bypassFiscalRisk =
      queued.source_event_id === "quarterly_inspection" ||
      queued.source_event_id === "historical_audit";
    const minFiscalRiskReq = targetEvent?.requirements?.stats?.fiscal_risk?.min;
    const queuedEvalState =
      bypassFiscalRisk && minFiscalRiskReq != null && state.fiscal_risk < minFiscalRiskReq
        ? { ...state, fiscal_risk: minFiscalRiskReq }
        : state;

    const deferredSoFar = queued.deferred_months ?? 0;
    const initialTriggerMonth = queued.trigger_month - deferredSoFar;
    const scheduledHorizon =
      queued.origin_month != null ? initialTriggerMonth - queued.origin_month : 0;
    const maxDefer = queued.priority === "high" || scheduledHorizon >= 12 ? 12 : 6;

    if (targetEvent && isEventHardEligible(queuedEvalState, targetEvent, undefined, catalog)) {
      slot1Event = targetEvent;
    } else if (targetEvent && deferredSoFar < maxDefer) {
      remainingDue.push({
        ...queued,
        trigger_month: state.month + 1,
        deferred_months: deferredSoFar + 1,
      });
    }
  }

  const remainingQueue: ScheduledEvent[] = [...remainingDue, ...futureQueue];
  remainingQueue.sort((a, b) => a.trigger_month - b.trigger_month);

  const excludedIds = new Set<string>();
  if (slot1Event) {
    excludedIds.add(slot1Event.id);
    if (slot1Event.exclusive_with) {
      for (const exId of slot1Event.exclusive_with) {
        excludedIds.add(exId);
      }
    }
  }

  const hardEligibleRandomPool = catalog.events.filter(
    (event) => event.weight > 0 && isEventHardEligible(state, event, excludedIds, catalog),
  );

  const readyPool = hardEligibleRandomPool.filter((event) => !isEventOnCooldown(state, event.id));

  let slot2Event: EventDef | null = null;
  let cooldownRelaxed = false;

  if (readyPool.length > 0) {
    const picked = pickNoveltyWeightedEvent(prng, readyPool, state, catalog);
    slot2Event = picked.item;
    prng = picked.prng;
  } else if (hardEligibleRandomPool.length > 0) {
    const picked = pickNoveltyWeightedEvent(prng, hardEligibleRandomPool, state, catalog);
    slot2Event = picked.item;
    prng = picked.prng;
    cooldownRelaxed = true;
  }

  const drawnEventIds: string[] = [];
  if (slot1Event) {
    drawnEventIds.push(slot1Event.id);
  }
  if (slot2Event) {
    drawnEventIds.push(slot2Event.id);
  }

  return {
    state: {
      ...state,
      prng,
      scheduled_queue: remainingQueue,
      current_turn_events: drawnEventIds,
    },
    drawnEventIds,
    cooldownRelaxed,
  };
}

const NON_AUDIT_HACIENDA_ID_PATTERNS = [
  "bucle_clave_pin",
  "clave_pin",
  "certificado_caducado",
  "certificado_digital",
  "certificado_corriente",
  "caida_sede",
  "sede_electronica",
  "notificacion_agosto",
  "dias_cortesia",
  "encuesta_ine",
  "epigrafe_iae",
  "panico_verifactu",
  "verifactu",
  "devolucion",
  "prescripcion",
  "sello_cumplimiento",
  "subvencion_kit",
  "susto_primer_trimestre",
  "campana_renta",
];

const NON_AUDIT_HACIENDA_TAGS = new Set([
  "clave_pin",
  "certificado_digital",
  "caida_sede",
  "sede_electronica",
  "notificacion_agosto",
  "dias_cortesia",
  "ine",
  "estadistica",
  "verifactu",
  "devolucion",
  "prescripcion",
  "expediente_limpio",
  "homologacion",
  "bautismo_fiscal",
]);

const AUDIT_HACIENDA_KEYWORDS = [
  "inspeccion",
  "comprobacion",
  "requerimiento",
  "carta_certificada",
  "auditoria",
  "paralela",
  "cruce",
  "ratios",
  "deduccion",
  "deducciones",
  "revision",
  "regularizacion",
  "embargo",
  "movimientos_bancarios",
  "gastos_afectos",
  "ticket",
  "amortizacion",
  "operaciones_vinculadas",
  "plan_control",
  "retenciones",
  "modelo_347",
  "modelo_190",
  "modelo_303",
  "vies",
  "intracomunitar",
  "bizum",
  "recargo",
  "apremio",
  "sancion",
  "acta",
  "dehu",
];

export function isInspectableHaciendaEvent(event: EventDef): boolean {
  if (event.category !== "hacienda" || event.weight <= 0) {
    return false;
  }

  const frReq = event.requirements?.stats?.fiscal_risk;
  if (frReq && frReq.max != null && frReq.min == null) {
    return false;
  }

  for (const pattern of NON_AUDIT_HACIENDA_ID_PATTERNS) {
    if (event.id.includes(pattern)) {
      return false;
    }
  }

  if (event.tags) {
    for (const tag of event.tags) {
      if (NON_AUDIT_HACIENDA_TAGS.has(tag)) {
        return false;
      }
    }
  }

  if (frReq?.min != null || event.character_id === "hacienda_inspector_gomez") {
    return true;
  }

  for (const keyword of AUDIT_HACIENDA_KEYWORDS) {
    if (event.id.includes(keyword)) {
      return true;
    }
    if (event.tags?.some((tag) => tag.includes(keyword))) {
      return true;
    }
  }

  return false;
}

export function selectInspectableHaciendaEvent(
  state: GameState,
  catalog: ContentCatalog,
): { eventId: string | null; prng: PrngState } {
  const targetMonth = state.month % 3 === 0 ? state.month + 1 : state.month;
  const evaluationState: GameState =
    targetMonth === state.month ? state : { ...state, month: targetMonth };
  const alreadyQueued = new Set(state.scheduled_queue.map((q) => q.event_id));
  const hardEligible = catalog.events.filter(
    (event) =>
      !alreadyQueued.has(event.id) &&
      isInspectableHaciendaEvent(event) &&
      isEventHardEligible(evaluationState, event, undefined, catalog),
  );

  if (hardEligible.length === 0) {
    return { eventId: null, prng: state.prng };
  }

  const nonCooldown = hardEligible.filter((event) => !isEventOnCooldown(evaluationState, event.id));
  const candidates = nonCooldown.length > 0 ? nonCooldown : hardEligible;
  const picked = pickWeighted(state.prng, candidates);
  return { eventId: picked.item.id, prng: picked.prng };
}

export function selectHistoricalAuditEvent(
  state: GameState,
  catalog: ContentCatalog,
): { eventId: string | null; prng: PrngState } {
  const targetMonth = state.month % 3 === 0 ? state.month + 1 : state.month;
  const alreadyQueued = new Set(state.scheduled_queue.map((q) => q.event_id));
  const hardEligible = catalog.events.filter((event) => {
    if (
      event.category !== "hacienda" ||
      !event.tags?.includes("prescripcion_fiscal") ||
      alreadyQueued.has(event.id)
    ) {
      return false;
    }
    const minFiscalRiskReq = event.requirements?.stats?.fiscal_risk?.min;
    const evaluationState: GameState = {
      ...state,
      month: targetMonth,
      fiscal_risk:
        minFiscalRiskReq != null && state.fiscal_risk < minFiscalRiskReq
          ? minFiscalRiskReq
          : state.fiscal_risk,
    };
    return isEventHardEligible(evaluationState, event, undefined, catalog);
  });

  if (hardEligible.length === 0) {
    return { eventId: null, prng: state.prng };
  }

  const evalForCooldown: GameState =
    targetMonth === state.month ? state : { ...state, month: targetMonth };
  const nonCooldown = hardEligible.filter((event) => !isEventOnCooldown(evalForCooldown, event.id));
  const candidates = nonCooldown.length > 0 ? nonCooldown : hardEligible;
  const weighted = candidates.map((event) => ({
    event,
    weight: Math.max(1, event.weight),
  }));
  const picked = pickWeighted(state.prng, weighted);
  return { eventId: picked.item.event.id, prng: picked.prng };
}

export function findInspectableHaciendaEventId(
  state: GameState,
  catalog: ContentCatalog,
): string | null {
  return selectInspectableHaciendaEvent(state, catalog).eventId;
}
