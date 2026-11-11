import { pickWeighted } from "./prng.ts";
import type { ChoiceSpec, EventDef, RequirementsSpec } from "./schemas/index.ts";
import type { ContentCatalog, GameState, ScheduledEvent } from "./types.ts";

export function evaluateRequirements(
  state: GameState,
  requirements?: RequirementsSpec | null,
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
      if (range.min != null && currentVal < range.min) {
        return false;
      }
      if (range.max != null && currentVal > range.max) {
        return false;
      }
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

  return true;
}

export function isChoiceEligible(state: GameState, choice: ChoiceSpec): boolean {
  return evaluateRequirements(state, choice.requirements);
}

export function getEligibleChoices(state: GameState, event: EventDef): ChoiceSpec[] {
  return event.choices.filter((choice) => isChoiceEligible(state, choice));
}

export function isEventOnCooldown(state: GameState, eventId: string): boolean {
  const earliestEligibleMonth = state.cooldowns[eventId] ?? 0;
  return state.month < earliestEligibleMonth;
}

export function isEventHardEligible(
  state: GameState,
  event: EventDef,
  excludedEventIds?: ReadonlySet<string>,
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

  return getEligibleChoices(state, event).length >= 1;
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
  const remainingQueue: ScheduledEvent[] = [];

  for (const queued of state.scheduled_queue) {
    if (queued.trigger_month > state.month) {
      remainingQueue.push(queued);
      continue;
    }

    if (slot1Event !== null) {
      remainingQueue.push(queued);
      continue;
    }

    const targetEvent = eventMap.get(queued.event_id);
    if (targetEvent && isEventHardEligible(state, targetEvent)) {
      slot1Event = targetEvent;
    }
  }

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
    (event) => event.weight > 0 && isEventHardEligible(state, event, excludedIds),
  );

  const readyPool = hardEligibleRandomPool.filter((event) => !isEventOnCooldown(state, event.id));

  let slot2Event: EventDef | null = null;
  let cooldownRelaxed = false;

  if (readyPool.length > 0) {
    const picked = pickWeighted(prng, readyPool);
    slot2Event = picked.item;
    prng = picked.prng;
  } else if (hardEligibleRandomPool.length > 0) {
    const picked = pickWeighted(prng, hardEligibleRandomPool);
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

export function findInspectableHaciendaEventId(
  state: GameState,
  catalog: ContentCatalog,
): string | null {
  const alreadyQueued = new Set(state.scheduled_queue.map((q) => q.event_id));
  for (const event of catalog.events) {
    if (event.category !== "hacienda") {
      continue;
    }
    if (alreadyQueued.has(event.id)) {
      continue;
    }
    if (isEventHardEligible(state, event)) {
      return event.id;
    }
  }
  return null;
}
