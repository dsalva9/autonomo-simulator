import { createPrng } from "./prng.ts";
import type {
  AnnualAccumulator,
  AnnualSummary,
  ContentCatalog,
  GameState,
  HistoryEntry,
} from "./types.ts";

export interface CreateGameStateOptions {
  seed?: string;
  runId?: string;
}

export function createInitialAnnualAccumulator(
  year: number,
  startMoney: number,
): AnnualAccumulator {
  return {
    year,
    start_money: Math.round(startMoney),
    billed: 0,
    expenses: 0,
    taxes_paid: 0,
    events_resolved: 0,
    highlight_event_ids: [],
    milestones: [],
  };
}

export function createInitialGameState(
  catalog: ContentCatalog,
  options: CreateGameStateOptions = {},
): GameState {
  const seed = options.seed?.trim() ? options.seed.trim() : "AUT-2026-SEED";
  const prng = createPrng(seed);
  const runId = options.runId?.trim() ? options.runId.trim() : `run_${prng.seed}`;
  const { balance } = catalog;
  const init = balance.initial_indicators;

  return {
    schema_version: 1,
    run_id: runId,
    prng,
    month: 1,
    phase: "month_start",
    indicators: {
      money: Math.round(init.money),
      moral: clampInitialStat(init.moral),
      stress: clampInitialStat(init.stress),
      personal_life: clampInitialStat(init.personal_life),
      reputation: clampInitialStat(init.reputation),
    },
    fiscal_risk: clampInitialStat(init.fiscal_risk),
    finances: {
      lifetime_billed: 0,
      current_quarter_billed: 0,
      accrued_tax_liability: 0,
      deferred_tax: null,
      pending_invoices: [],
      consecutive_negative_months: 0,
    },
    gestor: {
      tier: "self",
      character_id: null,
      monthly_fee: balance.gestor_tiers.self.monthly_fee,
      inspection_shield: balance.gestor_tiers.self.inspection_shield,
      months_active: 0,
    },
    family: {
      status: "single",
      partner_character_id: null,
      children_count: 0,
      monthly_cost: 0,
      support_modifier: 0,
    },
    employee: null,
    flags: {},
    cooldowns: {},
    occurrences: {},
    scheduled_queue: [],
    modifiers: [],
    current_turn_events: [],
    earned_victories: [],
    pending_victory_badge: null,
    quarterly_report: null,
    endless_mode: false,
    ending: null,
    annual_snapshot: createInitialAnnualAccumulator(1, init.money),
    history: [],
  };
}

export function buildAnnualSummary(state: GameState): AnnualSummary {
  const snap = state.annual_snapshot;
  return {
    year: snap.year,
    month: state.month,
    billed: snap.billed,
    expenses: snap.expenses,
    taxes_paid: snap.taxes_paid,
    net_cash_change: state.indicators.money - snap.start_money,
    ending_money: state.indicators.money,
    events_resolved: snap.events_resolved,
    highlight_event_ids: [...snap.highlight_event_ids],
    milestones: [...snap.milestones],
  };
}

export function appendHistory(
  history: readonly HistoryEntry[],
  entry: HistoryEntry,
  maxEntries: number,
): HistoryEntry[] {
  const next = [...history, entry];
  if (next.length <= maxEntries) {
    return next;
  }
  return next.slice(next.length - maxEntries);
}

function clampInitialStat(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}
