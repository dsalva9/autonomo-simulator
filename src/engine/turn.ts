import {
  applyQuarterlySettlement,
  applyRecurringMonthEconomy,
  clampStat,
  prepareQuarterlyTax,
  resolveEndingQuote,
} from "./economy.ts";
import { resolveChoiceEffects } from "./effects.ts";
import type { CharacterDef, EventDef } from "./schemas/index.ts";
import { drawTurnEvents, findInspectableHaciendaEventId, isChoiceEligible } from "./selector.ts";
import {
  type CreateGameStateOptions,
  appendHistory,
  buildAnnualSummary,
  createInitialAnnualAccumulator,
  createInitialGameState,
} from "./state.ts";
import type {
  ActiveEventView,
  ContentCatalog,
  EndingId,
  GameState,
  QuarterlySettlementMode,
  TurnResolution,
  VictoryBadge,
  VictoryDecision,
} from "./types.ts";

export function getEventById(catalog: ContentCatalog, eventId: string): EventDef | undefined {
  return catalog.events.find((e) => e.id === eventId);
}

export function getCharacterById(
  catalog: ContentCatalog,
  characterId: string,
): CharacterDef | undefined {
  return catalog.characters[characterId];
}

export function getActiveEvent(state: GameState, catalog: ContentCatalog): ActiveEventView | null {
  if (state.phase !== "event_resolution" || state.current_turn_events.length === 0) {
    return null;
  }
  const activeEventId = state.current_turn_events[0];
  const event = getEventById(catalog, activeEventId);
  if (!event) {
    return null;
  }
  return {
    event,
    choices: event.choices.map((choice) => ({
      choice,
      eligible: isChoiceEligible(state, choice),
    })),
  };
}

export function startNewRun(
  catalog: ContentCatalog,
  options: CreateGameStateOptions = {},
): { state: GameState; resolution: TurnResolution } {
  const initialState = createInitialGameState(catalog, options);
  return stepMonthStart(initialState, catalog);
}

export function stepMonthStart(
  state: GameState,
  catalog: ContentCatalog,
): { state: GameState; resolution: TurnResolution } {
  if (state.phase !== "month_start") {
    throw new Error(`Expected phase 'month_start', received '${state.phase}'.`);
  }

  const recurring = applyRecurringMonthEconomy(state, catalog);
  const drawn = drawTurnEvents(recurring.state, catalog);

  const monthStartSummary = {
    month: state.month,
    gross_billing: recurring.grossBilling,
    tax_accrued_on_billing: recurring.taxAccruedOnBilling,
    total_expenses: recurring.totalExpenses,
    net_recurring_cash: recurring.grossBilling - recurring.totalExpenses,
    invoices_settled: recurring.invoicesSettled,
    passive_stress_delta: recurring.passiveStressDelta,
    drawn_events: drawn.drawnEventIds,
    cooldown_relaxed: drawn.cooldownRelaxed,
  };

  if (drawn.drawnEventIds.length > 0) {
    return {
      state: {
        ...drawn.state,
        phase: "event_resolution",
      },
      resolution: {
        monthStart: monthStartSummary,
      },
    };
  }

  const postEvents = transitionAfterTurnEvents(drawn.state, catalog);
  return {
    state: postEvents.state,
    resolution: {
      monthStart: monthStartSummary,
      ...postEvents.resolution,
    },
  };
}

export function applyPlayerChoice(
  state: GameState,
  catalog: ContentCatalog,
  choiceId: string,
): { state: GameState; resolution: TurnResolution } {
  if (state.phase !== "event_resolution") {
    throw new Error(`Cannot apply choice during phase '${state.phase}'.`);
  }
  if (state.current_turn_events.length === 0) {
    throw new Error("No active event in current_turn_events.");
  }

  const activeEventId = state.current_turn_events[0];
  const event = getEventById(catalog, activeEventId);
  if (!event) {
    throw new Error(`Active event '${activeEventId}' not found in content catalog.`);
  }

  const choice = event.choices.find((c) => c.id === choiceId);
  if (!choice) {
    throw new Error(`Choice '${choiceId}' does not exist on event '${event.id}'.`);
  }
  if (!isChoiceEligible(state, choice)) {
    throw new Error(`Choice '${choiceId}' does not satisfy requirements in current state.`);
  }

  const applied = resolveChoiceEffects(state, catalog, event, choice);
  const remainingEvents = applied.state.current_turn_events.slice(1);
  const stateWithRemaining: GameState = {
    ...applied.state,
    current_turn_events: remainingEvents,
  };

  if (stateWithRemaining.phase === "game_over" && stateWithRemaining.ending) {
    return {
      state: stateWithRemaining,
      resolution: {
        choiceOutcome: applied.summary,
        postChoiceState: stateWithRemaining,
        endedRun: stateWithRemaining.ending,
      },
    };
  }

  if (remainingEvents.length > 0) {
    const postChoiceState: GameState = {
      ...stateWithRemaining,
      phase: "event_resolution",
    };
    return {
      state: postChoiceState,
      resolution: {
        choiceOutcome: applied.summary,
        postChoiceState,
      },
    };
  }

  const nextStep = transitionAfterTurnEvents(stateWithRemaining, catalog);
  return {
    state: nextStep.state,
    resolution: {
      choiceOutcome: applied.summary,
      postChoiceState: stateWithRemaining,
      ...nextStep.resolution,
    },
  };
}

export function settleQuarter(
  state: GameState,
  catalog: ContentCatalog,
  mode: QuarterlySettlementMode,
): { state: GameState; resolution: TurnResolution } {
  if (state.phase !== "quarterly_tax") {
    throw new Error(`Cannot settle quarter during phase '${state.phase}'.`);
  }

  const settled = applyQuarterlySettlement(state, catalog, mode);
  const eom = runEndOfMonthChecks(settled.state, catalog, settled.summary.deferred_tax_defaulted);

  return {
    state: eom.state,
    resolution: {
      quarterlySettlement: settled.summary,
      ...eom.resolution,
    },
  };
}

export function resolveVictoryPrompt(
  state: GameState,
  catalog: ContentCatalog,
  decision: VictoryDecision,
): { state: GameState; resolution: TurnResolution } {
  if (state.phase !== "victory_prompt") {
    throw new Error(`Cannot resolve victory prompt during phase '${state.phase}'.`);
  }

  if (decision === "retire") {
    const endingId: EndingId =
      state.pending_victory_badge === "rich_150k" ? "retired_rich" : "retired_hero";
    const quote = resolveEndingQuote(catalog, endingId);
    const ending = {
      id: endingId,
      month: state.month,
      summary_quote: quote,
    };
    const history = appendHistory(
      state.history,
      {
        id: `hist_retire_${state.month}_${endingId}`,
        month: state.month,
        kind: "game_over",
        summary: quote,
      },
      catalog.balance.max_history_entries,
    );

    return {
      state: {
        ...state,
        phase: "game_over",
        pending_victory_badge: null,
        ending,
        history,
      },
      resolution: {
        endedRun: ending,
      },
    };
  }

  const continuedState: GameState = {
    ...state,
    endless_mode: true,
    pending_victory_badge: null,
  };

  if (continuedState.month % 12 === 0) {
    return enterAnnualSummaryPhase(continuedState, catalog);
  }

  return advanceToNextMonth(continuedState, catalog);
}

export function dismissAnnualSummary(
  state: GameState,
  catalog: ContentCatalog,
): { state: GameState; resolution: TurnResolution } {
  if (state.phase !== "annual_summary") {
    throw new Error(`Cannot dismiss annual summary during phase '${state.phase}'.`);
  }

  const nextYear = Math.floor(state.month / 12) + 1;
  const resetSnapshotState: GameState = {
    ...state,
    annual_snapshot: createInitialAnnualAccumulator(nextYear, state.indicators.money),
  };

  return advanceToNextMonth(resetSnapshotState, catalog);
}

function transitionAfterTurnEvents(
  state: GameState,
  catalog: ContentCatalog,
): { state: GameState; resolution: TurnResolution } {
  if (state.month % 3 === 0) {
    const prepared = prepareQuarterlyTax(state, catalog, findInspectableHaciendaEventId);
    return {
      state: prepared.state,
      resolution: {
        quarterlyReport: prepared.report,
      },
    };
  }

  return runEndOfMonthChecks(state, catalog, false);
}

function runEndOfMonthChecks(
  state: GameState,
  catalog: ContentCatalog,
  deferredTaxDefaulted: boolean,
): { state: GameState; resolution: TurnResolution } {
  const { balance } = catalog;
  let stress = state.indicators.stress;
  const moral = state.indicators.moral;
  const money = state.indicators.money;
  let consecutiveNegativeMonths = state.finances.consecutive_negative_months;

  if (money < 0) {
    consecutiveNegativeMonths += 1;
    stress = clampStat(stress + balance.negative_cash_monthly_stress);
  } else {
    consecutiveNegativeMonths = 0;
  }

  const updatedState: GameState = {
    ...state,
    indicators: {
      ...state.indicators,
      stress,
    },
    finances: {
      ...state.finances,
      consecutive_negative_months: consecutiveNegativeMonths,
    },
  };

  const isBankrupt =
    deferredTaxDefaulted ||
    consecutiveNegativeMonths >= balance.max_consecutive_negative_months ||
    money < balance.hard_debt_floor;

  if (isBankrupt) {
    return finalizeGameOver(updatedState, catalog, "defeat_bankruptcy");
  }

  if (stress >= 100) {
    return finalizeGameOver(updatedState, catalog, "defeat_burnout_stress");
  }

  if (moral <= 0) {
    return finalizeGameOver(updatedState, catalog, "defeat_resignation_moral");
  }

  const newlyUnlockedVictories: VictoryBadge[] = [];
  if (
    updatedState.month >= balance.victory_month &&
    !updatedState.earned_victories.includes("hero_120m")
  ) {
    newlyUnlockedVictories.push("hero_120m");
  }
  if (
    updatedState.indicators.money >= balance.victory_money &&
    !updatedState.earned_victories.includes("rich_150k")
  ) {
    newlyUnlockedVictories.push("rich_150k");
  }

  if (newlyUnlockedVictories.length > 0) {
    const earnedVictories = [...updatedState.earned_victories, ...newlyUnlockedVictories];
    let history = updatedState.history;
    for (const badge of newlyUnlockedVictories) {
      history = appendHistory(
        history,
        {
          id: `hist_victory_${updatedState.month}_${badge}`,
          month: updatedState.month,
          kind: "victory_unlocked",
          summary: badge,
        },
        balance.max_history_entries,
      );
    }

    return {
      state: {
        ...updatedState,
        phase: "victory_prompt",
        earned_victories: earnedVictories,
        pending_victory_badge: newlyUnlockedVictories[0],
        history,
      },
      resolution: {
        unlockedVictories: newlyUnlockedVictories,
      },
    };
  }

  if (updatedState.month % 12 === 0) {
    return enterAnnualSummaryPhase(updatedState, catalog);
  }

  return advanceToNextMonth(updatedState, catalog);
}

function finalizeGameOver(
  state: GameState,
  catalog: ContentCatalog,
  endingId: EndingId,
): { state: GameState; resolution: TurnResolution } {
  const quote = resolveEndingQuote(catalog, endingId);
  const ending = {
    id: endingId,
    month: state.month,
    summary_quote: quote,
  };
  const history = appendHistory(
    state.history,
    {
      id: `hist_gameover_${state.month}_${endingId}`,
      month: state.month,
      kind: "game_over",
      summary: quote,
    },
    catalog.balance.max_history_entries,
  );

  return {
    state: {
      ...state,
      phase: "game_over",
      ending,
      history,
    },
    resolution: {
      endedRun: ending,
    },
  };
}

function enterAnnualSummaryPhase(
  state: GameState,
  catalog: ContentCatalog,
): { state: GameState; resolution: TurnResolution } {
  const summary = buildAnnualSummary(state);
  const history = appendHistory(
    state.history,
    {
      id: `hist_annual_${state.month}`,
      month: state.month,
      kind: "annual_summary",
      money_delta: summary.net_cash_change,
    },
    catalog.balance.max_history_entries,
  );

  return {
    state: {
      ...state,
      phase: "annual_summary",
      history,
    },
    resolution: {
      annualSummary: summary,
    },
  };
}

function advanceToNextMonth(
  state: GameState,
  catalog: ContentCatalog,
): { state: GameState; resolution: TurnResolution } {
  const nextMonthState: GameState = {
    ...state,
    month: state.month + 1,
    phase: "month_start",
  };
  return stepMonthStart(nextMonthState, catalog);
}
