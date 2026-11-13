import type {
  ChoiceOutcomeSummary,
  EndingId,
  EventDef,
  GameState,
  HistoryEntryKind,
  Indicators,
  MonthStartSummary,
  VictoryBadge,
} from "../../engine/index.ts";

export const ACTIVE_RUN_KEY = "autonomo:active_run";
export const PROFILE_KEY = "autonomo:profile";
export const CORRUPT_BACKUP_KEY = "autonomo:corrupt_backup";

export const CURRENT_SAVE_VERSION = 1 as const;
export const CURRENT_PROFILE_VERSION = 1 as const;
export const ENGINE_BUILD = "0.3.0-phase2";
export const MAX_HALL_OF_FAME_ENTRIES = 50;

export type AchievementId =
  | "primer_trimestre"
  | "primer_ano"
  | "gestor_contratado"
  | "aplazamiento_solicitado"
  | "numeros_rojos_superados"
  | "superviviente_hacienda"
  | "colchon_10k"
  | "primer_empleado"
  | "familia_formada"
  | "criatura_en_casa"
  | "cinco_anos"
  | "facturacion_100k"
  | "heroe_120m"
  | "ricachon_150k"
  | "modo_infinito";

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
    id: "gestor_contratado",
    code: "GEST-01",
    title: "Papeles Delegados",
    description:
      "Contratar los servicios de una gestoría para no pelearte a solas con los modelos fiscales.",
  },
  {
    id: "aplazamiento_solicitado",
    code: "MOD-APLZ",
    title: "Patada Hacia Adelante",
    description:
      "Solicitar un aplazamiento trimestral con recargo para ganar tres meses de oxígeno financiero.",
  },
  {
    id: "numeros_rojos_superados",
    code: "DESC-OK",
    title: "Equilibrista del Descubierto",
    description:
      "Sobrevivir a un episodio en números rojos y remontar la cuenta corriente a saldo positivo.",
  },
  {
    id: "superviviente_hacienda",
    code: "AEAT-OK",
    title: "Superviviente de Hacienda",
    description:
      "Resolver tu primer expediente o requerimiento de la Agencia Tributaria y seguir en activo.",
  },
  {
    id: "colchon_10k",
    code: "CAJA-10K",
    title: "Colchón de Supervivencia",
    description:
      "Reunir al menos 10.000 € de liquidez disponible sin que el trimestre te los volatilice.",
  },
  {
    id: "primer_empleado",
    code: "TGSS-01",
    title: "Primera Nómina a Cargo",
    description: "Contratar a tu primer empleado en plantilla y asumir su coste social cada mes.",
  },
  {
    id: "familia_formada",
    code: "HOGAR-01",
    title: "Hogar en Conciliación",
    description:
      "Formar un hogar en convivencia o ampliar la familia mientras malabareas entregas.",
  },
  {
    id: "criatura_en_casa",
    code: "CONCIL-01",
    title: "Conciliación Malabarista",
    description:
      "Criar al menos una criatura en casa mientras atiendes clientes, guarderías y cierres.",
  },
  {
    id: "cinco_anos",
    code: "RETA-60M",
    title: "Media Década en el RETA",
    description: "Resistir cinco años (60 meses) entre facturas, clientes y gestorías.",
  },
  {
    id: "facturacion_100k",
    code: "MOD-390",
    title: "Cien Mil Facturados",
    description:
      "Alcanzar 100.000 € de facturación oficial acumulada ante la mirada atenta del fisco.",
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
  {
    id: "modo_infinito",
    code: "RETA-INF",
    title: "Masoquista Cotizante",
    description:
      "Rechazar el retiro tras conquistar una victoria y seguir cotizando en Modo Infinito.",
  },
] as const;

export const KNOWN_ACHIEVEMENT_IDS: ReadonlySet<AchievementId> = new Set<AchievementId>(
  ACHIEVEMENT_CATALOG.map((entry) => entry.id),
);

const CASH_MUTATING_HISTORY_KINDS: ReadonlySet<HistoryEntryKind> = new Set<HistoryEntryKind>([
  "month_start",
  "event_choice",
  "quarterly_tax",
  "invoice_paid",
]);

function hasRecoveredFromNegativeCash(state: GameState): boolean {
  if (state.ending !== null || state.indicators.money < 0) {
    return false;
  }

  if (state.finances.consecutive_negative_months > 0) {
    return true;
  }

  let cursorMoney = state.indicators.money;
  for (let i = state.history.length - 1; i >= 0; i -= 1) {
    const entry = state.history[i];
    if (
      entry &&
      CASH_MUTATING_HISTORY_KINDS.has(entry.kind) &&
      typeof entry.money_delta === "number" &&
      Number.isFinite(entry.money_delta)
    ) {
      cursorMoney -= entry.money_delta;
      if (cursorMoney < 0) {
        return true;
      }
    }
  }

  return false;
}

export interface PersistedPendingOutcome {
  event: EventDef;
  choiceId: string;
  choiceLabel: string;
  outcome: ChoiceOutcomeSummary;
}

export interface PersistedPendingTurn {
  pending_outcome: PersistedPendingOutcome;
  outcome_preview_state: GameState | null;
  queued_final_state: GameState | null;
  queued_post_outcome_deltas: Partial<Record<keyof Indicators, number>> | null;
  queued_month_start: MonthStartSummary | null;
  last_deltas: Partial<Record<keyof Indicators, number>>;
  last_month_start: MonthStartSummary | null;
}

export interface SaveActiveRunOptions {
  pendingTurn?: PersistedPendingTurn | null;
}

export interface SaveEnvelope {
  save_version: typeof CURRENT_SAVE_VERSION;
  engine_build: string;
  updated_at: string;
  state: GameState;
  pending_turn?: PersistedPendingTurn | null;
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
  saveActiveRun(
    state: GameState,
    nowIso?: string,
    options?: SaveActiveRunOptions,
  ): Promise<SaveEnvelope>;
  clearActiveRun(): Promise<void>;
  loadProfile(): Promise<ProfileEnvelope>;
  saveProfile(profile: ProfileEnvelope): Promise<void>;
  syncRunProgress(
    state: GameState,
    nowIso?: string,
    options?: SaveActiveRunOptions,
  ): Promise<SyncRunProgressResult>;
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

  const hasSettledFirstQuarter =
    state.month > 3 ||
    state.annual_snapshot.taxes_paid > 0 ||
    state.finances.deferred_tax !== null ||
    state.history.some((entry) => entry.kind === "quarterly_tax");

  const hasSurvivedMilestoneMonth = (targetMonth: number): boolean =>
    state.month > targetMonth ||
    (state.month === targetMonth &&
      (state.phase === "annual_summary" ||
        state.phase === "victory_prompt" ||
        (state.ending !== null && state.earned_victories.length > 0) ||
        (state.ending === null &&
          state.history.some(
            (entry) => entry.kind === "quarterly_tax" && entry.month >= targetMonth,
          ))));

  const hasResolvedHaciendaEvent =
    state.history.some(
      (entry) => entry.kind === "event_choice" && entry.event_id?.startsWith("hacienda_"),
    ) ||
    Object.entries(state.occurrences).some(
      ([id, count]) => id.startsWith("hacienda_") && count > 0,
    );
  const survivedHacienda =
    state.ending === null &&
    state.phase !== "game_over" &&
    state.indicators.stress < 100 &&
    state.indicators.moral > 0 &&
    hasResolvedHaciendaEvent;

  const mandatoryDeferredDue =
    state.phase === "quarterly_tax" &&
    state.finances.deferred_tax !== null &&
    state.finances.deferred_tax.due_month <= state.month
      ? state.finances.deferred_tax.principal + state.finances.deferred_tax.surcharge
      : 0;
  const effectiveMoney =
    state.phase === "quarterly_tax"
      ? state.indicators.money - state.finances.accrued_tax_liability - mandatoryDeferredDue
      : state.indicators.money;
  const canUnlockWealthSeal = state.ending === null || state.earned_victories.length > 0;

  maybeUnlock("primer_trimestre", hasSettledFirstQuarter);
  maybeUnlock("primer_ano", hasSurvivedMilestoneMonth(12));
  maybeUnlock("gestor_contratado", state.gestor.tier !== "self");
  maybeUnlock("aplazamiento_solicitado", state.finances.deferred_tax !== null);
  maybeUnlock("numeros_rojos_superados", hasRecoveredFromNegativeCash(state));
  maybeUnlock("superviviente_hacienda", survivedHacienda);
  maybeUnlock("colchon_10k", canUnlockWealthSeal && effectiveMoney >= 10_000);
  maybeUnlock("primer_empleado", state.employee !== null);
  maybeUnlock(
    "familia_formada",
    state.family.status === "cohabiting" || state.family.children_count > 0,
  );
  maybeUnlock("criatura_en_casa", state.family.children_count >= 1);
  maybeUnlock("cinco_anos", hasSurvivedMilestoneMonth(60));
  maybeUnlock("facturacion_100k", state.finances.lifetime_billed >= 100_000);
  maybeUnlock("heroe_120m", state.earned_victories.includes("hero_120m"));
  maybeUnlock(
    "ricachon_150k",
    (canUnlockWealthSeal && effectiveMoney >= 150_000) ||
      state.earned_victories.includes("rich_150k"),
  );
  maybeUnlock("modo_infinito", state.endless_mode === true);

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
