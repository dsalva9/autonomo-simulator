import { del as idbDel, get as idbGet, set as idbSet } from "idb-keyval";
import type { GameState } from "../../engine/index.ts";
import {
  ACTIVE_RUN_KEY,
  CORRUPT_BACKUP_KEY,
  CURRENT_SAVE_VERSION,
  type CorruptSaveBackup,
  ENGINE_BUILD,
  type KeyValueDriver,
  type LoadActiveRunResult,
  MAX_HALL_OF_FAME_ENTRIES,
  PROFILE_KEY,
  type ProfileEnvelope,
  type SaveActiveRunOptions,
  type SaveEnvelope,
  type StoragePort,
  type SyncRunProgressResult,
  buildPastRunSummary,
  createDefaultProfileEnvelope,
  evaluateUnlockedAchievements,
} from "./StoragePort.ts";
import { migrateProfileEnvelope, migrateSaveEnvelope } from "./migrations.ts";

export function createMemoryStorageDriver(
  initialEntries?: Record<string, unknown>,
): KeyValueDriver {
  const map = new Map<string, unknown>();
  if (initialEntries) {
    for (const [key, val] of Object.entries(initialEntries)) {
      map.set(key, structuredClone(val));
    }
  }

  return {
    async get<T = unknown>(key: string): Promise<T | undefined> {
      const value = map.get(key);
      return value === undefined ? undefined : (structuredClone(value) as T);
    },
    async set(key: string, value: unknown): Promise<void> {
      map.set(key, structuredClone(value));
    },
    async del(key: string): Promise<void> {
      map.delete(key);
    },
  };
}

export function createHybridIndexedDbDriver(): KeyValueDriver {
  const memoryFallback = createMemoryStorageDriver();
  let useFallback = typeof indexedDB === "undefined";

  return {
    async get<T = unknown>(key: string): Promise<T | undefined> {
      if (useFallback) {
        return memoryFallback.get<T>(key);
      }
      try {
        return await idbGet<T>(key);
      } catch {
        useFallback = true;
        return memoryFallback.get<T>(key);
      }
    },
    async set(key: string, value: unknown): Promise<void> {
      if (useFallback) {
        return memoryFallback.set(key, value);
      }
      try {
        await idbSet(key, value);
      } catch {
        useFallback = true;
        await memoryFallback.set(key, value);
      }
    },
    async del(key: string): Promise<void> {
      if (useFallback) {
        return memoryFallback.del(key);
      }
      try {
        await idbDel(key);
      } catch {
        useFallback = true;
        await memoryFallback.del(key);
      }
    },
  };
}

export function createStorageAdapter(
  driver: KeyValueDriver = createHybridIndexedDbDriver(),
): StoragePort {
  return {
    async loadActiveRun(): Promise<LoadActiveRunResult> {
      const raw = await driver.get(ACTIVE_RUN_KEY);
      if (raw === undefined || raw === null) {
        return { envelope: null, corruptedRecovery: null };
      }

      const migrated = migrateSaveEnvelope(raw);
      if (!migrated.ok) {
        const backup: CorruptSaveBackup = {
          backed_up_at: new Date().toISOString(),
          reason: migrated.reason,
          raw,
        };
        await driver.set(CORRUPT_BACKUP_KEY, backup);
        await driver.del(ACTIVE_RUN_KEY);
        return {
          envelope: null,
          corruptedRecovery: { reason: migrated.reason },
        };
      }

      return { envelope: migrated.envelope, corruptedRecovery: null };
    },

    async saveActiveRun(
      state: GameState,
      nowIso: string = new Date().toISOString(),
      options?: SaveActiveRunOptions,
    ): Promise<SaveEnvelope> {
      const envelope: SaveEnvelope = {
        save_version: CURRENT_SAVE_VERSION,
        engine_build: ENGINE_BUILD,
        updated_at: nowIso,
        state,
        ...(options?.pendingTurn ? { pending_turn: options.pendingTurn } : {}),
      };
      await driver.set(ACTIVE_RUN_KEY, envelope);
      return envelope;
    },

    async clearActiveRun(): Promise<void> {
      await driver.del(ACTIVE_RUN_KEY);
    },

    async loadProfile(): Promise<ProfileEnvelope> {
      const raw = await driver.get(PROFILE_KEY);
      if (raw === undefined || raw === null) {
        return createDefaultProfileEnvelope();
      }
      return migrateProfileEnvelope(raw);
    },

    async saveProfile(profile: ProfileEnvelope): Promise<void> {
      await driver.set(PROFILE_KEY, profile);
    },

    async syncRunProgress(
      state: GameState,
      nowIso: string = new Date().toISOString(),
      options?: SaveActiveRunOptions,
    ): Promise<SyncRunProgressResult> {
      const currentProfile = await this.loadProfile();
      const { achievements, newlyUnlocked } = evaluateUnlockedAchievements(
        state,
        currentProfile.achievements,
        nowIso,
      );

      if (state.ending !== null) {
        await driver.del(ACTIVE_RUN_KEY);
        const archivedSummary = buildPastRunSummary(state, nowIso);
        const deduplicatedHall = currentProfile.hall_of_fame.filter(
          (entry) => entry.run_id !== state.run_id,
        );
        const nextHall = archivedSummary
          ? [archivedSummary, ...deduplicatedHall].slice(0, MAX_HALL_OF_FAME_ENTRIES)
          : deduplicatedHall;

        const nextProfile: ProfileEnvelope = {
          ...currentProfile,
          achievements,
          hall_of_fame: nextHall,
        };
        await driver.set(PROFILE_KEY, nextProfile);

        return {
          profile: nextProfile,
          newlyUnlocked,
          archivedSummary,
        };
      }

      await this.saveActiveRun(state, nowIso, options);

      let nextProfile = currentProfile;
      if (newlyUnlocked.length > 0) {
        nextProfile = {
          ...currentProfile,
          achievements,
        };
        await driver.set(PROFILE_KEY, nextProfile);
      }

      return {
        profile: nextProfile,
        newlyUnlocked,
        archivedSummary: null,
      };
    },

    async loadCorruptBackup(): Promise<CorruptSaveBackup | null> {
      const raw = await driver.get<CorruptSaveBackup>(CORRUPT_BACKUP_KEY);
      return raw ?? null;
    },
  };
}

export const defaultStorageAdapter: StoragePort = createStorageAdapter();
