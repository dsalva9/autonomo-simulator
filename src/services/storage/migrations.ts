import type {
  BusinessState,
  BusinessTier,
  ChoiceOutcomeSummary,
  EventDef,
  GameState,
  Indicators,
  MonthStartSummary,
  TurnPhase,
  VictoryBadge,
} from "../../engine/index.ts";
import {
  CURRENT_PROFILE_VERSION,
  CURRENT_SAVE_VERSION,
  ENGINE_BUILD,
  MAX_HALL_OF_FAME_ENTRIES,
  type PastRunSummary,
  type PersistedPendingTurn,
  type ProfileEnvelope,
  type SaveEnvelope,
  createDefaultProfileEnvelope,
} from "./StoragePort.ts";

export const LEGACY_VICTORY_BADGE_MAP: Readonly<Record<string, VictoryBadge>> = {
  rich_150k: "rich_250k",
};

export const LEGACY_ACHIEVEMENT_KEY_MAP: Readonly<Record<string, string>> = {
  aplazamiento_Solicitado: "aplazamiento_solicitado",
  ricachon_150k: "ricachon_250k",
};

const VALID_PHASES: ReadonlySet<TurnPhase> = new Set<TurnPhase>([
  "month_start",
  "event_resolution",
  "quarterly_tax",
  "victory_prompt",
  "annual_summary",
  "game_over",
]);

const VALID_BUSINESS_TIERS: ReadonlySet<BusinessTier> = new Set<BusinessTier>([
  "solo_autonomo",
  "estudio_consolidado",
  "sociedad_limitada",
  "agencia_consultora",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeVictoryBadge(raw: unknown): VictoryBadge | null {
  if (typeof raw !== "string") {
    return null;
  }
  const mapped = LEGACY_VICTORY_BADGE_MAP[raw] ?? raw;
  if (mapped === "hero_120m" || mapped === "rich_250k") {
    return mapped;
  }
  return null;
}

function normalizeVictoryBadgeList(raw: unknown): VictoryBadge[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const seen = new Set<VictoryBadge>();
  const out: VictoryBadge[] = [];
  for (const item of raw) {
    const badge = normalizeVictoryBadge(item);
    if (badge && !seen.has(badge)) {
      seen.add(badge);
      out.push(badge);
    }
  }
  return out;
}

function inferBusinessStateFromV1(rawState: Record<string, unknown>): BusinessState {
  if (
    isRecord(rawState.business) &&
    VALID_BUSINESS_TIERS.has(rawState.business.tier as BusinessTier)
  ) {
    return {
      tier: rawState.business.tier as BusinessTier,
      months_in_tier: isFiniteNumber(rawState.business.months_in_tier)
        ? Math.max(0, Math.round(rawState.business.months_in_tier))
        : 0,
      sl_formed_month: isFiniteNumber(rawState.business.sl_formed_month)
        ? Math.max(1, Math.round(rawState.business.sl_formed_month))
        : null,
    };
  }

  const flags = isRecord(rawState.flags) ? rawState.flags : {};
  const month = isFiniteNumber(rawState.month) ? Math.max(1, Math.round(rawState.month)) : 1;

  if (flags.sociedad_limitada_activa) {
    return {
      tier: "sociedad_limitada",
      months_in_tier: 0,
      sl_formed_month: Math.max(1, month - 1),
    };
  }
  if (
    flags.estudio_calle_alquilado ||
    flags.estudio_propio_activo ||
    (rawState.employee != null && month >= 24)
  ) {
    return {
      tier: "estudio_consolidado",
      months_in_tier: 0,
      sl_formed_month: null,
    };
  }
  return {
    tier: "solo_autonomo",
    months_in_tier: 0,
    sl_formed_month: null,
  };
}

export function migrateGameStateV1ToV2(rawState: unknown): unknown {
  if (!isRecord(rawState)) {
    return rawState;
  }

  const business = inferBusinessStateFromV1(rawState);

  const migratedEmployee = isRecord(rawState.employee)
    ? {
        ...rawState.employee,
        headcount:
          isFiniteNumber(rawState.employee.headcount) && rawState.employee.headcount >= 1
            ? Math.round(rawState.employee.headcount)
            : 1,
        lead_monthly_cost: isFiniteNumber(rawState.employee.lead_monthly_cost)
          ? rawState.employee.lead_monthly_cost
          : isFiniteNumber(rawState.employee.monthly_cost)
            ? rawState.employee.monthly_cost
            : 0,
      }
    : rawState.employee === null
      ? null
      : rawState.employee;

  const migratedFamily = isRecord(rawState.family)
    ? {
        ...rawState.family,
        neglect_months: isFiniteNumber(rawState.family.neglect_months)
          ? Math.max(0, Math.round(rawState.family.neglect_months))
          : 0,
      }
    : rawState.family;

  const migratedFinances = isRecord(rawState.finances)
    ? {
        ...rawState.finances,
        historical_exposures: Array.isArray(rawState.finances.historical_exposures)
          ? rawState.finances.historical_exposures
          : [],
      }
    : rawState.finances;

  const migratedEarnedVictories = normalizeVictoryBadgeList(rawState.earned_victories);

  const migratedPendingVictoryBadge =
    rawState.pending_victory_badge == null
      ? (rawState.pending_victory_badge ?? null)
      : (normalizeVictoryBadge(rawState.pending_victory_badge) ?? null);

  const migratedHistory = Array.isArray(rawState.history)
    ? rawState.history.map((entry) => {
        if (
          isRecord(entry) &&
          entry.kind === "victory_unlocked" &&
          typeof entry.summary === "string"
        ) {
          const mappedSummary = LEGACY_VICTORY_BADGE_MAP[entry.summary] ?? entry.summary;
          if (mappedSummary !== entry.summary) {
            return { ...entry, summary: mappedSummary };
          }
        }
        return entry;
      })
    : rawState.history;

  const migratedScheduledQueue = Array.isArray(rawState.scheduled_queue)
    ? rawState.scheduled_queue.map((item) => {
        if (!isRecord(item)) {
          return item;
        }
        const triggerMonth = isFiniteNumber(item.trigger_month) ? item.trigger_month : 1;
        return {
          ...item,
          origin_month: isFiniteNumber(item.origin_month)
            ? item.origin_month
            : Math.max(1, triggerMonth - 2),
          priority:
            item.priority === "high" || item.priority === "normal" ? item.priority : "normal",
        };
      })
    : rawState.scheduled_queue;

  return {
    ...rawState,
    schema_version: 2,
    business,
    employee: migratedEmployee,
    family: migratedFamily,
    finances: migratedFinances,
    earned_victories: migratedEarnedVictories,
    pending_victory_badge: migratedPendingVictoryBadge,
    history: migratedHistory,
    scheduled_queue: migratedScheduledQueue,
  };
}

export type SaveMigrationStep = (envelope: Record<string, unknown>) => Record<string, unknown>;

/**
 * Sequential pure migrations keyed by source `save_version`.
 * Runs v0 -> v1 -> v2 deterministically without dropping active `pending_turn` payloads.
 */
export const SAVE_MIGRATIONS: Record<number, SaveMigrationStep> = {
  0: (legacy) => ({
    save_version: 1,
    engine_build: typeof legacy.engine_build === "string" ? legacy.engine_build : ENGINE_BUILD,
    updated_at:
      typeof legacy.updated_at === "string" ? legacy.updated_at : new Date(0).toISOString(),
    state: legacy.state,
    ...(legacy.pending_turn !== undefined ? { pending_turn: legacy.pending_turn } : {}),
  }),
  1: (v1) => {
    let migratedPendingTurn = v1.pending_turn;
    if (isRecord(v1.pending_turn)) {
      migratedPendingTurn = {
        ...v1.pending_turn,
        ...(v1.pending_turn.outcome_preview_state != null
          ? {
              outcome_preview_state: migrateGameStateV1ToV2(v1.pending_turn.outcome_preview_state),
            }
          : {}),
        ...(v1.pending_turn.queued_final_state != null
          ? {
              queued_final_state: migrateGameStateV1ToV2(v1.pending_turn.queued_final_state),
            }
          : {}),
      };
    }

    return {
      ...v1,
      save_version: 2,
      engine_build: ENGINE_BUILD,
      state: migrateGameStateV1ToV2(v1.state),
      ...(migratedPendingTurn !== undefined ? { pending_turn: migratedPendingTurn } : {}),
    };
  },
};

export function isValidGameStateShape(candidate: unknown): candidate is GameState {
  if (!isRecord(candidate)) {
    return false;
  }
  if (candidate.schema_version !== 2) {
    return false;
  }
  if (typeof candidate.run_id !== "string" || candidate.run_id.trim().length === 0) {
    return false;
  }
  if (!isFiniteNumber(candidate.month) || candidate.month < 1) {
    return false;
  }
  if (typeof candidate.phase !== "string" || !VALID_PHASES.has(candidate.phase as TurnPhase)) {
    return false;
  }
  if (!isRecord(candidate.prng) || typeof candidate.prng.seed !== "string") {
    return false;
  }
  if (
    !Array.isArray(candidate.prng.state) ||
    candidate.prng.state.length !== 4 ||
    !candidate.prng.state.every(isFiniteNumber)
  ) {
    return false;
  }
  if (!isRecord(candidate.indicators)) {
    return false;
  }
  const ind = candidate.indicators;
  if (
    !isFiniteNumber(ind.money) ||
    !isFiniteNumber(ind.moral) ||
    !isFiniteNumber(ind.stress) ||
    !isFiniteNumber(ind.personal_life) ||
    !isFiniteNumber(ind.reputation)
  ) {
    return false;
  }
  if (!isFiniteNumber(candidate.fiscal_risk)) {
    return false;
  }
  if (!isRecord(candidate.finances)) {
    return false;
  }
  const fin = candidate.finances;
  if (
    !isFiniteNumber(fin.lifetime_billed) ||
    !isFiniteNumber(fin.current_quarter_billed) ||
    !isFiniteNumber(fin.accrued_tax_liability) ||
    !isFiniteNumber(fin.consecutive_negative_months) ||
    !Array.isArray(fin.pending_invoices) ||
    !Array.isArray(fin.historical_exposures)
  ) {
    return false;
  }
  if (
    !isRecord(candidate.business) ||
    !VALID_BUSINESS_TIERS.has(candidate.business.tier as BusinessTier) ||
    !isFiniteNumber(candidate.business.months_in_tier)
  ) {
    return false;
  }
  if (
    !isRecord(candidate.gestor) ||
    !isRecord(candidate.family) ||
    !isRecord(candidate.annual_snapshot)
  ) {
    return false;
  }
  if (!isFiniteNumber(candidate.family.neglect_months)) {
    return false;
  }
  if (
    candidate.family.partner_name !== undefined &&
    typeof candidate.family.partner_name !== "string"
  ) {
    return false;
  }
  if (candidate.employee !== null) {
    if (
      !isRecord(candidate.employee) ||
      !isFiniteNumber(candidate.employee.headcount) ||
      candidate.employee.headcount < 1 ||
      !isFiniteNumber(candidate.employee.lead_monthly_cost) ||
      !isFiniteNumber(candidate.employee.monthly_cost)
    ) {
      return false;
    }
  }
  if (
    !Array.isArray(candidate.current_turn_events) ||
    !Array.isArray(candidate.scheduled_queue) ||
    !Array.isArray(candidate.modifiers) ||
    !Array.isArray(candidate.earned_victories) ||
    !Array.isArray(candidate.history)
  ) {
    return false;
  }

  return true;
}

function sanitizeIndicatorDeltas(
  candidate: unknown,
): Partial<Record<keyof Indicators, number>> | null {
  if (!isRecord(candidate)) {
    return null;
  }
  const out: Partial<Record<keyof Indicators, number>> = {};
  const keys: (keyof Indicators)[] = ["money", "moral", "stress", "personal_life", "reputation"];
  for (const key of keys) {
    const val = candidate[key];
    if (isFiniteNumber(val) && val !== 0) {
      out[key] = val;
    }
  }
  return out;
}

function sanitizePersistedPendingTurn(candidate: unknown): PersistedPendingTurn | undefined {
  if (!isRecord(candidate)) {
    return undefined;
  }

  const po = candidate.pending_outcome;
  if (!isRecord(po)) {
    return undefined;
  }
  if (
    !isRecord(po.event) ||
    typeof po.event.id !== "string" ||
    !Array.isArray(po.event.choices) ||
    typeof po.choiceId !== "string" ||
    typeof po.choiceLabel !== "string" ||
    !isRecord(po.outcome) ||
    !isFiniteNumber(po.outcome.money_delta) ||
    !Array.isArray(po.outcome.scheduled_event_ids)
  ) {
    return undefined;
  }

  const rawPreview = candidate.outcome_preview_state;
  if (rawPreview !== null && rawPreview !== undefined && !isValidGameStateShape(rawPreview)) {
    return undefined;
  }

  const rawFinal = candidate.queued_final_state;
  if (rawFinal !== null && rawFinal !== undefined && !isValidGameStateShape(rawFinal)) {
    return undefined;
  }

  const sanitizeMonthStart = (ms: unknown): MonthStartSummary | null =>
    isRecord(ms) && isFiniteNumber(ms.month) && Array.isArray(ms.invoices_settled)
      ? (ms as unknown as MonthStartSummary)
      : null;

  return {
    pending_outcome: {
      event: po.event as unknown as EventDef,
      choiceId: po.choiceId,
      choiceLabel: po.choiceLabel,
      outcome: po.outcome as unknown as ChoiceOutcomeSummary,
    },
    outcome_preview_state: rawPreview ?? null,
    queued_final_state: rawFinal ?? null,
    queued_post_outcome_deltas: sanitizeIndicatorDeltas(candidate.queued_post_outcome_deltas),
    queued_month_start: sanitizeMonthStart(candidate.queued_month_start),
    last_deltas: sanitizeIndicatorDeltas(candidate.last_deltas) ?? {},
    last_month_start: sanitizeMonthStart(candidate.last_month_start),
  };
}

export type MigrateSaveResult =
  | { ok: true; envelope: SaveEnvelope }
  | { ok: false; reason: string };

export function migrateSaveEnvelope(raw: unknown): MigrateSaveResult {
  let unpacked: unknown = raw;
  if (typeof raw === "string") {
    try {
      unpacked = JSON.parse(raw);
    } catch {
      return { ok: false, reason: "Invalid JSON string in active save slot." };
    }
  }

  if (!isRecord(unpacked)) {
    return { ok: false, reason: "Save envelope is not an object." };
  }

  let working: Record<string, unknown> = { ...unpacked };
  const rawVersion = working.save_version;

  if (!isFiniteNumber(rawVersion) || !Number.isInteger(rawVersion) || rawVersion < 0) {
    return { ok: false, reason: "Missing or non-integer save_version." };
  }

  let version: number = rawVersion;

  if (version > CURRENT_SAVE_VERSION) {
    return {
      ok: false,
      reason: `Unsupported future save_version '${version}' (max supported: ${CURRENT_SAVE_VERSION}).`,
    };
  }

  while (version < CURRENT_SAVE_VERSION) {
    const step = SAVE_MIGRATIONS[version];
    if (!step) {
      return { ok: false, reason: `Missing migration step from save_version '${version}'.` };
    }
    try {
      working = step(working);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, reason: `Migration from v${version} threw error: ${msg}` };
    }
    const nextVer = working.save_version;
    if (!isFiniteNumber(nextVer) || nextVer <= version) {
      return {
        ok: false,
        reason: `Migration step from v${version} failed to advance save_version.`,
      };
    }
    version = nextVer;
  }

  if (working.save_version !== CURRENT_SAVE_VERSION) {
    return { ok: false, reason: "Final save_version mismatch after migration." };
  }

  if (!isValidGameStateShape(working.state)) {
    return { ok: false, reason: "GameState inside SaveEnvelope failed structural validation." };
  }

  const sanitizedPendingTurn = sanitizePersistedPendingTurn(working.pending_turn);

  return {
    ok: true,
    envelope: {
      save_version: CURRENT_SAVE_VERSION,
      engine_build:
        typeof working.engine_build === "string" && working.engine_build.trim().length > 0
          ? working.engine_build
          : ENGINE_BUILD,
      updated_at:
        typeof working.updated_at === "string" ? working.updated_at : new Date(0).toISOString(),
      state: working.state,
      ...(sanitizedPendingTurn ? { pending_turn: sanitizedPendingTurn } : {}),
    },
  };
}

function isValidPastRunSummary(item: unknown): item is PastRunSummary {
  if (!isRecord(item)) {
    return false;
  }
  return (
    typeof item.run_id === "string" &&
    typeof item.seed === "string" &&
    typeof item.finished_at === "string" &&
    isFiniteNumber(item.months_survived) &&
    typeof item.ending_id === "string" &&
    typeof item.summary_quote === "string" &&
    isFiniteNumber(item.final_money) &&
    isFiniteNumber(item.lifetime_billed) &&
    Array.isArray(item.earned_victories) &&
    typeof item.endless_mode === "boolean"
  );
}

export function migrateProfileEnvelope(raw: unknown): ProfileEnvelope {
  const defaults = createDefaultProfileEnvelope();
  let unpacked: unknown = raw;
  if (typeof raw === "string") {
    try {
      unpacked = JSON.parse(raw);
    } catch {
      return defaults;
    }
  }
  if (!isRecord(unpacked)) {
    return defaults;
  }

  const achievements: Record<string, string> = {};
  if (isRecord(unpacked.achievements)) {
    for (const [k, v] of Object.entries(unpacked.achievements)) {
      if (typeof v === "string" && v.length > 0) {
        const normalizedKey = LEGACY_ACHIEVEMENT_KEY_MAP[k] ?? k;
        if (!achievements[normalizedKey]) {
          achievements[normalizedKey] = v;
        }
      }
    }
  }

  const hallOfFame: PastRunSummary[] = [];
  if (Array.isArray(unpacked.hall_of_fame)) {
    for (const entry of unpacked.hall_of_fame) {
      if (isValidPastRunSummary(entry)) {
        hallOfFame.push({
          ...entry,
          earned_victories: normalizeVictoryBadgeList(entry.earned_victories),
        });
      }
      if (hallOfFame.length >= MAX_HALL_OF_FAME_ENTRIES) {
        break;
      }
    }
  }

  const rawSettings = isRecord(unpacked.settings) ? unpacked.settings : {};
  const reducedMotion =
    typeof rawSettings.reduced_motion === "boolean" ? rawSettings.reduced_motion : null;
  const locale =
    typeof rawSettings.locale === "string" && rawSettings.locale.trim().length > 0
      ? rawSettings.locale
      : "es-ES";

  return {
    profile_version: CURRENT_PROFILE_VERSION,
    achievements,
    hall_of_fame: hallOfFame,
    settings: {
      reduced_motion: reducedMotion,
      locale,
    },
  };
}
