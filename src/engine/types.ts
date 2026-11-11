import type {
  AssetManifest,
  BalanceConfig,
  CharacterDef,
  ChoiceSpec,
  EventDef,
  GestorTier,
} from "./schemas/index.ts";

export type EndingId =
  | "defeat_bankruptcy"
  | "defeat_burnout_stress"
  | "defeat_resignation_moral"
  | "abandon_oposiciones"
  | "abandon_salaried"
  | "abandon_subsidies"
  | "retired_hero"
  | "retired_rich";

export type VictoryBadge = "hero_120m" | "rich_150k";

export type TurnPhase =
  | "month_start"
  | "event_resolution"
  | "quarterly_tax"
  | "victory_prompt"
  | "annual_summary"
  | "game_over";

export type QuarterlySettlementMode = "pay" | "defer";

export type VictoryDecision = "retire" | "continue";

export interface Indicators {
  money: number;
  moral: number;
  stress: number;
  personal_life: number;
  reputation: number;
}

export interface PrngState {
  seed: string;
  state: [number, number, number, number];
}

export interface DeferredTaxDebt {
  principal: number;
  surcharge: number;
  due_month: number;
}

export interface PendingInvoice {
  id: string;
  source_event_id: string;
  amount: number;
  due_month: number;
  default_prob: number;
}

export interface FinanceState {
  lifetime_billed: number;
  current_quarter_billed: number;
  accrued_tax_liability: number;
  deferred_tax: DeferredTaxDebt | null;
  pending_invoices: PendingInvoice[];
  consecutive_negative_months: number;
}

export interface GestorState {
  tier: GestorTier;
  character_id: string | null;
  monthly_fee: number;
  inspection_shield: number;
  months_active: number;
}

export interface FamilyState {
  status: "single" | "dating" | "cohabiting" | "separated";
  partner_character_id: string | null;
  children_count: number;
  monthly_cost: number;
  support_modifier: number;
}

export interface EmployeeState {
  character_id: string;
  role_label: string;
  monthly_cost: number;
  billing_multiplier: number;
  satisfaction: number;
  months_employed: number;
}

export interface ScheduledEvent {
  queue_id: string;
  event_id: string;
  trigger_month: number;
  source_event_id: string;
}

export interface TemporalModifier {
  id: string;
  label: string;
  remaining_months: number;
  monthly_billed_delta?: number;
  monthly_expense_delta?: number;
  monthly_moral_delta?: number;
  monthly_stress_delta?: number;
}

export interface AnnualAccumulator {
  year: number;
  start_money: number;
  billed: number;
  expenses: number;
  taxes_paid: number;
  events_resolved: number;
  highlight_event_ids: string[];
  milestones: string[];
}

export interface AnnualSummary {
  year: number;
  month: number;
  billed: number;
  expenses: number;
  taxes_paid: number;
  net_cash_change: number;
  ending_money: number;
  events_resolved: number;
  highlight_event_ids: string[];
  milestones: string[];
}

export type HistoryEntryKind =
  | "month_start"
  | "event_choice"
  | "invoice_paid"
  | "invoice_defaulted"
  | "quarterly_tax"
  | "inspection"
  | "victory_unlocked"
  | "annual_summary"
  | "game_over";

export interface HistoryEntry {
  id: string;
  month: number;
  kind: HistoryEntryKind;
  event_id?: string;
  choice_id?: string;
  outcome_id?: string;
  title?: string;
  summary?: string;
  money_delta?: number;
}

export interface QuarterlyReport {
  month: number;
  quarter: number;
  quarter_billed: number;
  accrued_tax_due: number;
  deferred_tax_due: number;
  gestor_error_surcharge: number;
  inspection_triggered: boolean;
  inspection_scheduled_event_id: string | null;
  inspection_fallback_fine: number;
  can_defer: boolean;
}

export interface GameState {
  schema_version: 1;
  run_id: string;
  prng: PrngState;
  month: number;
  phase: TurnPhase;
  indicators: Indicators;
  fiscal_risk: number;
  finances: FinanceState;
  gestor: GestorState;
  family: FamilyState;
  employee: EmployeeState | null;
  flags: Record<string, boolean | number>;
  cooldowns: Record<string, number>;
  occurrences: Record<string, number>;
  scheduled_queue: ScheduledEvent[];
  modifiers: TemporalModifier[];
  current_turn_events: string[];
  earned_victories: VictoryBadge[];
  pending_victory_badge?: VictoryBadge | null;
  quarterly_report?: QuarterlyReport | null;
  endless_mode: boolean;
  ending: { id: EndingId; month: number; summary_quote: string } | null;
  annual_snapshot: AnnualAccumulator;
  history: HistoryEntry[];
}

export interface ContentCatalog {
  balance: BalanceConfig;
  characters: Record<string, CharacterDef>;
  events: EventDef[];
  manifest?: AssetManifest;
}

export interface CompiledContentBundle extends ContentCatalog {
  schema_version: 1;
  manifest: AssetManifest;
}

export interface InvoiceSettlementResult {
  invoice_id: string;
  source_event_id: string;
  amount: number;
  paid: boolean;
  tax_accrued: number;
}

export interface MonthStartSummary {
  month: number;
  gross_billing: number;
  tax_accrued_on_billing: number;
  total_expenses: number;
  net_recurring_cash: number;
  invoices_settled: InvoiceSettlementResult[];
  passive_stress_delta: number;
  drawn_events: string[];
  cooldown_relaxed: boolean;
}

export interface ChoiceOutcomeSummary {
  event_id: string;
  choice_id: string;
  outcome_id: string | null;
  result_text: string | null;
  money_delta: number;
  moral_delta: number;
  stress_delta: number;
  personal_life_delta: number;
  reputation_delta: number;
  fiscal_risk_delta: number;
  scheduled_event_ids: string[];
}

export interface QuarterlySettlementSummary {
  month: number;
  mode: QuarterlySettlementMode;
  paid_amount: number;
  deferred_amount: number;
  deferred_surcharge: number;
  deferred_tax_defaulted: boolean;
}

export interface TurnResolution {
  monthStart?: MonthStartSummary;
  choiceOutcome?: ChoiceOutcomeSummary;
  quarterlyReport?: QuarterlyReport;
  quarterlySettlement?: QuarterlySettlementSummary;
  unlockedVictories?: VictoryBadge[];
  annualSummary?: AnnualSummary;
  endedRun?: { id: EndingId; month: number; summary_quote: string };
}

export interface ActiveEventView {
  event: EventDef;
  choices: {
    choice: ChoiceSpec;
    eligible: boolean;
  }[];
}
