import type { EndingId, GameState, VictoryBadge } from "../../engine/index.ts";

export const ACTIVE_RUN_KEY = "autonomo:active_run";
export const PROFILE_KEY = "autonomo:profile";
export const CORRUPT_BACKUP_KEY = "autonomo:corrupt_backup";

export const CURRENT_SAVE_VERSION = 1 as const;
export const CURRENT_PROFILE_VERSION = 1 as const;
export const ENGINE_BUILD = "0.1.0-phase0";
export const MAX_HALL_OF_FAME_ENTRIES = 50;

export type AchievementId =
  | "primer_trimestre"
  | "primer_ano"
  | "cinco_anos"
  | "heroe_120m"
  | "ricachon_150k";

export interface AchievementDefinition {
  id: AchievementId;
  code: string;
  title: string;
  description: string;
}

export const ACHIEVEMENT_CATALOG: readonly AchievementDefinition[] = [
  {
    id: "primer_trimestre",
    code: "MOD-303",
    title: "Bautismo Trimestral",
    description: "Alcanzar el mes 3 y enfrentarte a tu primer cierre de IVA e IRPF.",
  },
  {
    id: "primer_ano",
    code: "RETA-12M",
    title: "Superviviente Anual",
    description: "Cumplir 12 meses seguidos cotizando sin causar baja.",
  },
  {
    id: "cinco_anos",
    code: "RETA-60M",
    title: "Veterano de Cuota",
    description: "Resistir cinco años (60 meses) entre facturas, clientes y gestorías.",
  },
  {
    id: "heroe_120m",
    code: "HONOR-120M",
    title: "¡Eres un héroe!",
    description: "Sobrevivir diez años completos (120 meses) como trabajador autónomo.",
  },
  {
    id: "ricachon_150k",
    code: "CAJA-150K",
    title: "Ricachón",
    description: "Acumular al menos 150.000 € de liquidez disponible en tu cuenta.",
  },
] as const;

export interface SaveEnvelope {
  save_version: typeof CURRENT_SAVE_VERSION;
  engine_build: string;
  updated_at: string;
  state: GameState;
}

export interface PastRunSummary {
  run_id: string;
  seed: string;
  finished_at: string;
  months_survived: number;
  ending_id: EndingId;
  summary_quote: string;
  final_money: number;
  lifetime_billed: number;
  earned_victories: VictoryBadge[];
  endless_mode: boolean;
}

export interface ProfileSettings {
  reduced_motion: boolean | null;
  locale: string;
}

export interface ProfileEnvelope {
  profile_version: typeof CURRENT_PROFILE_VERSION;
  achievements: Record<string, string>;
  hall_of_fame: PastRunSummary[];
  settings: ProfileSettings;
}

export interface CorruptSaveBackup {
  backed_up_at: string;
  reason: string;
  raw: unknown;
}

export interface LoadActiveRunResult {
  envelope: SaveEnvelope | null;
  corruptedRecovery: { reason: string } | null;
}

export interface SyncRunProgressResult {
  profile: ProfileEnvelope;
  newlyUnlocked: AchievementId[];
  archivedSummary: PastRunSummary | null;
}

export interface KeyValueDriver {
  get<T = unknown>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  del(key: string): Promise<void>;
}

export interface StoragePort {
  loadActiveRun(): Promise<LoadActiveRunResult>;
  saveActiveRun(state: GameState, nowIso?: string): Promise<SaveEnvelope>;
  clearActiveRun(): Promise<void>;
  loadProfile(): Promise<ProfileEnvelope>;
  saveProfile(profile: ProfileEnvelope): Promise<void>;
  syncRunProgress(state: GameState, nowIso?: string): Promise<SyncRunProgressResult>;
  loadCorruptBackup(): Promise<CorruptSaveBackup | null>;
}

export function createDefaultProfileEnvelope(): ProfileEnvelope {
  return {
    profile_version: CURRENT_PROFILE_VERSION,
    achievements: {},
    hall_of_fame: [],
    settings: {
      reduced_motion: null,
      locale: "es-ES",
    },
  };
}

export function evaluateUnlockedAchievements(
  state: GameState,
  existing: Record<string, string>,
  nowIso: string = new Date().toISOString(),
): {
  achievements: Record<string, string>;
  newlyUnlocked: AchievementId[];
} {
  const next = { ...existing };
  const newlyUnlocked: AchievementId[] = [];

  const maybeUnlock = (id: AchievementId, condition: boolean) => {
    if (condition && !next[id]) {
      next[id] = nowIso;
      newlyUnlocked.push(id);
    }
  };

  maybeUnlock("primer_trimestre", state.month >= 3);
  maybeUnlock("primer_ano", state.month >= 12);
  maybeUnlock("cinco_anos", state.month >= 60);
  maybeUnlock("heroe_120m", state.month >= 120 || state.earned_victories.includes("hero_120m"));
  maybeUnlock(
    "ricachon_150k",
    state.indicators.money >= 150_000 || state.earned_victories.includes("rich_150k"),
  );

  return { achievements: next, newlyUnlocked };
}

export function buildPastRunSummary(
  state: GameState,
  finishedAtIso: string = new Date().toISOString(),
): PastRunSummary | null {
  if (!state.ending) {
    return null;
  }
  return {
    run_id: state.run_id,
    seed: state.prng.seed,
    finished_at: finishedAtIso,
    months_survived: state.ending.month,
    ending_id: state.ending.id,
    summary_quote: state.ending.summary_quote,
    final_money: state.indicators.money,
    lifetime_billed: state.finances.lifetime_billed,
    earned_victories: [...state.earned_victories],
    endless_mode: state.endless_mode,
  };
}
