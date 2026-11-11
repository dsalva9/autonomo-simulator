import type { GameState, TurnPhase } from "../../engine/index.ts";
import {
  CURRENT_PROFILE_VERSION,
  CURRENT_SAVE_VERSION,
  ENGINE_BUILD,
  MAX_HALL_OF_FAME_ENTRIES,
  type PastRunSummary,
  type ProfileEnvelope,
  type SaveEnvelope,
  createDefaultProfileEnvelope,
} from "./StoragePort.ts";

const LEGACY_ACHIEVEMENT_KEY_MAP: Readonly<Record<string, string>> = {
  aplazamiento_Solicitado: "aplazamiento_solicitado",
};

const VALID_PHASES: ReadonlySet<TurnPhase> = new Set<TurnPhase>([
  "month_start",
  "event_resolution",
  "quarterly_tax",
  "victory_prompt",
  "annual_summary",
  "game_over",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export type SaveMigrationStep = (envelope: Record<string, unknown>) => Record<string, unknown>;

/**
 * Sequential pure migrations keyed by source `save_version`.
 * Example future entry: `1: (v1) => ({ ...v1, save_version: 2, ... })`.
 */
export const SAVE_MIGRATIONS: Record<number, SaveMigrationStep> = {
  0: (legacy) => ({
    save_version: 1,
    engine_build: typeof legacy.engine_build === "string" ? legacy.engine_build : ENGINE_BUILD,
    updated_at:
      typeof legacy.updated_at === "string" ? legacy.updated_at : new Date(0).toISOString(),
    state: legacy.state,
  }),
};

export function isValidGameStateShape(candidate: unknown): candidate is GameState {
  if (!isRecord(candidate)) {
    return false;
  }
  if (candidate.schema_version !== 1) {
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
    !Array.isArray(fin.pending_invoices)
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
        hallOfFame.push(entry);
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
