import { createPrng, nextFloat } from "./prng.ts";
import type {
  BusinessTier,
  BusinessTierBalance,
  BusinessTiersConfig,
  GestorComplianceConfig,
  IrpfBracket,
  PartnerPressureConfig,
  PrescripcionConfig,
  RetaBracket,
  TeamScalingBalance,
} from "./schemas/index.ts";
import type {
  AnnualAccumulator,
  AnnualSummary,
  ContentCatalog,
  GameState,
  HistoryEntry,
} from "./types.ts";

export const CANONICAL_PARTNER_NAME = "Álex";

export const PARTNER_NAME_POOL = ["Álex", "Cris", "Gabi", "Noa", "Clara"] as const;
export type PartnerName = (typeof PARTNER_NAME_POOL)[number];

export const DEFAULT_CORPORATE_TAX_RATE = 0.24;

export const DEFAULT_BUSINESS_TIERS: Readonly<BusinessTiersConfig> = {
  solo_autonomo: {
    billing_multiplier: 1.0,
    event_stakes_multiplier: 1.0,
    monthly_structural_overhead: 0,
    gestor_fee_multiplier: 1.0,
    max_team_size: 1,
    hard_debt_floor: -5000,
    corporate_tax_regime: false,
  },
  estudio_consolidado: {
    billing_multiplier: 1.22,
    event_stakes_multiplier: 1.45,
    monthly_structural_overhead: 280,
    gestor_fee_multiplier: 1.35,
    max_team_size: 3,
    hard_debt_floor: -8000,
    corporate_tax_regime: false,
  },
  sociedad_limitada: {
    billing_multiplier: 1.35,
    event_stakes_multiplier: 2.15,
    monthly_structural_overhead: 560,
    gestor_fee_multiplier: 1.95,
    max_team_size: 6,
    hard_debt_floor: -15000,
    corporate_tax_regime: true,
    societario_quota: 460,
  },
  agencia_consultora: {
    billing_multiplier: 1.5,
    event_stakes_multiplier: 3.2,
    monthly_structural_overhead: 1250,
    gestor_fee_multiplier: 2.8,
    max_team_size: 12,
    hard_debt_floor: -25000,
    corporate_tax_regime: true,
    societario_quota: 520,
  },
};

export const DEFAULT_RETA_BRACKETS: readonly RetaBracket[] = [
  { max_monthly_profit: 2200, monthly_quota: 294 },
  { max_monthly_profit: 3000, monthly_quota: 350 },
  { max_monthly_profit: 4200, monthly_quota: 420 },
  { max_monthly_profit: 5800, monthly_quota: 510 },
  { max_monthly_profit: null, monthly_quota: 590 },
];

export const DEFAULT_IRPF_BRACKETS: readonly IrpfBracket[] = [
  { up_to_monthly_profit: 1500, marginal_rate: 0.22 },
  { up_to_monthly_profit: 3000, marginal_rate: 0.3 },
  { up_to_monthly_profit: 5000, marginal_rate: 0.37 },
  { up_to_monthly_profit: null, marginal_rate: 0.44 },
];

export const DEFAULT_TEAM_SCALING: Readonly<TeamScalingBalance> = {
  default_staff_monthly_cost: 1850,
  base_additional_seat_multiplier: 0.78,
  seat_diminishing_factor: 0.95,
  boutique_solo_min_reputation: 68,
  boutique_solo_min_month: 30,
  boutique_solo_max_bonus: 0.5,
};

export const DEFAULT_GESTOR_COMPLIANCE: Readonly<GestorComplianceConfig> = {
  premium_warning_fiscal_risk: 45,
  premium_drop_fiscal_risk: 65,
  sl_self_quarterly_penalty: 450,
  sl_self_error_prob: 0.35,
};

export const DEFAULT_PRESCRIPCION_CONFIG: Readonly<PrescripcionConfig> = {
  window_months: 48,
  min_audit_age_months: 14,
  max_audit_age_months: 42,
  min_risk_points_recorded: 10,
  base_quarterly_prob: 0.03,
  prob_per_risk_point: 0.0035,
  max_quarterly_prob: 0.32,
  gestor_shield_effectiveness: 0.65,
  fallback_fine_rate: 0.45,
  fallback_fine_min: 600,
};

export const DEFAULT_PARTNER_PRESSURE: Readonly<PartnerPressureConfig> = {
  neglect_personal_life_threshold: 38,
  synergy_personal_life_threshold: 70,
  crisis_weight_multiplier: 2.8,
  critical_crisis_weight_multiplier: 4.5,
  synergy_weight_multiplier: 2.0,
  tier_event_weight_multiplier: 1.8,
};

export function getTeamHeadcount(state: Pick<GameState, "employee">): number {
  return state.employee ? Math.max(1, Math.round(state.employee.headcount ?? 1)) : 0;
}

export function getTeamScalingConfig(
  catalog?: Pick<ContentCatalog, "balance">,
): Readonly<TeamScalingBalance> {
  return catalog?.balance.team_scaling ?? DEFAULT_TEAM_SCALING;
}

export function getGestorComplianceConfig(
  catalog?: Pick<ContentCatalog, "balance">,
): Readonly<GestorComplianceConfig> {
  return catalog?.balance.gestor_compliance ?? DEFAULT_GESTOR_COMPLIANCE;
}

export function getPrescripcionConfig(
  catalog?: Pick<ContentCatalog, "balance">,
): Readonly<PrescripcionConfig> {
  return catalog?.balance.prescripcion ?? DEFAULT_PRESCRIPCION_CONFIG;
}

export function getPartnerPressureConfig(
  catalog?: Pick<ContentCatalog, "balance">,
): Readonly<PartnerPressureConfig> {
  return catalog?.balance.partner_pressure ?? DEFAULT_PARTNER_PRESSURE;
}

export function getBusinessTierConfig(
  stateOrTier: Pick<GameState, "business"> | BusinessTier,
  catalog?: Pick<ContentCatalog, "balance">,
): BusinessTierBalance {
  const tier: BusinessTier =
    typeof stateOrTier === "string" ? stateOrTier : (stateOrTier.business?.tier ?? "solo_autonomo");
  const configured = catalog?.balance.business_tiers?.[tier];
  if (configured) {
    return configured;
  }
  const fallback = DEFAULT_BUSINESS_TIERS[tier];
  if (tier === "solo_autonomo" && catalog?.balance.hard_debt_floor != null) {
    return {
      ...fallback,
      hard_debt_floor: catalog.balance.hard_debt_floor,
    };
  }
  return fallback;
}

export function getEffectiveHardDebtFloor(
  state: Pick<GameState, "business">,
  catalog: Pick<ContentCatalog, "balance">,
): number {
  return getBusinessTierConfig(state, catalog).hard_debt_floor;
}

export function isBoutiqueSeniorSolo(
  state: Pick<GameState, "employee" | "month" | "indicators">,
  catalog?: Pick<ContentCatalog, "balance">,
): boolean {
  const teamScaling = getTeamScalingConfig(catalog);
  const badgeMinRep = Math.max(72, teamScaling.boutique_solo_min_reputation);
  return (
    getTeamHeadcount(state) === 0 &&
    state.month >= teamScaling.boutique_solo_min_month &&
    state.indicators.reputation >= badgeMinRep
  );
}

export function scaleMonetaryValue(amount: number, multiplier: number): number {
  if (multiplier === 1 || amount === 0) {
    return Math.round(amount);
  }
  const raw = amount * multiplier;
  const step = Math.abs(raw) >= 200 ? 50 : 10;
  return Math.round(raw / step) * step;
}

/**
 * Deterministically selects a partner name from `PARTNER_NAME_POOL` for a given run seed
 * using an isolated PRNG namespace so the main gameplay `state.prng` stream is untouched.
 */
export function pickPartnerNameForSeed(seed?: string | null): PartnerName {
  const normalized = seed?.trim() ? seed.trim() : "AUT-2026-SEED";
  const { value } = nextFloat(createPrng(`partner_name:${normalized}`));
  const index = Math.floor(value * PARTNER_NAME_POOL.length);
  return PARTNER_NAME_POOL[index] ?? CANONICAL_PARTNER_NAME;
}

export function resolvePartnerName(
  state?: {
    family?: { partner_name?: string | null } | null;
    prng?: { seed?: string | null } | null;
  } | null,
): string {
  const explicit = state?.family?.partner_name?.trim();
  if (explicit) {
    return explicit;
  }
  if (state?.prng?.seed) {
    return pickPartnerNameForSeed(state.prng.seed);
  }
  return CANONICAL_PARTNER_NAME;
}

export function substitutePartnerName(text: string, partnerName?: string | null): string {
  const trimmed = partnerName?.trim();
  if (
    !trimmed ||
    trimmed === CANONICAL_PARTNER_NAME ||
    !text ||
    !text.includes(CANONICAL_PARTNER_NAME)
  ) {
    return text;
  }
  return text.replaceAll(CANONICAL_PARTNER_NAME, trimmed);
}

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
    schema_version: 2,
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
      historical_exposures: [],
    },
    business: {
      tier: "solo_autonomo",
      months_in_tier: 0,
      sl_formed_month: null,
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
      partner_name: pickPartnerNameForSeed(seed),
      children_count: 0,
      monthly_cost: 0,
      support_modifier: 0,
      neglect_months: 0,
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
