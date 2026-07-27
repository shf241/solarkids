import { createDefaultUserState, STORAGE_KEY } from "./defaults.js";
import type {
  LanguageCode,
  SolarKidsUserState,
  StorageLike,
} from "./types.js";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeLanguage(value: unknown): LanguageCode {
  return value === "en" ? "en" : "zh-CN";
}

function normalizeId(value: unknown, fallback = ""): string {
  if (typeof value !== "string") {
    return fallback;
  }

  return value.trim() || fallback;
}

function normalizeIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const ids = value
    .map((item) => normalizeId(item))
    .filter((item) => item.length > 0);

  return [...new Set(ids)];
}

function normalizeCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
}

export function normalizeUserState(value: unknown): SolarKidsUserState {
  const defaults = createDefaultUserState();
  if (!isRecord(value)) {
    return defaults;
  }

  if (value.version !== undefined && value.version !== 1) {
    return defaults;
  }

  const progress = isRecord(value.learningProgress)
    ? value.learningProgress
    : {};
  const record = isRecord(value.gameRecord) ? value.gameRecord : {};

  return {
    version: 1,
    language: normalizeLanguage(value.language),
    skinId: normalizeId(value.skinId, defaults.skinId),
    learningProgress: {
      visitedPlanetIds: normalizeIds(progress.visitedPlanetIds),
      completedTaskIds: normalizeIds(progress.completedTaskIds),
    },
    gameRecord: {
      playCount: normalizeCount(record.playCount),
      successCount: normalizeCount(record.successCount),
      bestScore: normalizeCount(record.bestScore),
      lastScore: normalizeCount(record.lastScore),
    },
  };
}

function resolveBrowserStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export class UserStateStore {
  readonly #storage: StorageLike | null;
  #storageAvailable: boolean;
  #memoryState = createDefaultUserState();

  constructor(storage: StorageLike | null = resolveBrowserStorage()) {
    this.#storage = storage;
    this.#storageAvailable = storage !== null;
  }

  loadUserState(): SolarKidsUserState {
    if (!this.#storage || !this.#storageAvailable) {
      return normalizeUserState(this.#memoryState);
    }

    try {
      const rawState = this.#storage.getItem(STORAGE_KEY);
      this.#memoryState =
        rawState === null
          ? normalizeUserState(this.#memoryState)
          : normalizeUserState(JSON.parse(rawState));
    } catch {
      this.#storageAvailable = false;
    }

    return normalizeUserState(this.#memoryState);
  }

  saveUserState(state: SolarKidsUserState): void {
    this.#memoryState = normalizeUserState(state);
    if (!this.#storage || !this.#storageAvailable) {
      return;
    }

    try {
      this.#storage.setItem(
        STORAGE_KEY,
        JSON.stringify(this.#memoryState),
      );
    } catch {
      this.#storageAvailable = false;
    }
  }

  updateUserState(
    patch: Partial<SolarKidsUserState>,
  ): SolarKidsUserState {
    const current = this.loadUserState();
    const nextState = normalizeUserState({ ...current, ...patch });
    this.saveUserState(nextState);
    return nextState;
  }

  setLanguage(language: LanguageCode): SolarKidsUserState {
    return this.updateUserState({ language });
  }

  setSkin(skinId: string): SolarKidsUserState {
    return this.updateUserState({ skinId });
  }

  markPlanetVisited(planetId: string): SolarKidsUserState {
    const current = this.loadUserState();
    const normalizedPlanetId = normalizeId(planetId);
    if (!normalizedPlanetId) {
      return current;
    }

    return this.updateUserState({
      learningProgress: {
        ...current.learningProgress,
        visitedPlanetIds: [
          ...current.learningProgress.visitedPlanetIds,
          normalizedPlanetId,
        ],
      },
    });
  }

  markTaskCompleted(taskId: string): SolarKidsUserState {
    const current = this.loadUserState();
    const normalizedTaskId = normalizeId(taskId);
    if (!normalizedTaskId) {
      return current;
    }

    return this.updateUserState({
      learningProgress: {
        ...current.learningProgress,
        completedTaskIds: [
          ...current.learningProgress.completedTaskIds,
          normalizedTaskId,
        ],
      },
    });
  }

  saveGameResult(score: number, success: boolean): SolarKidsUserState {
    const current = this.loadUserState();
    const safeScore = normalizeCount(score);

    return this.updateUserState({
      gameRecord: {
        playCount: current.gameRecord.playCount + 1,
        successCount: current.gameRecord.successCount + (success ? 1 : 0),
        bestScore: Math.max(current.gameRecord.bestScore, safeScore),
        lastScore: safeScore,
      },
    });
  }

  resetUserState(): SolarKidsUserState {
    const defaults = createDefaultUserState();
    this.#memoryState = defaults;
    if (!this.#storage || !this.#storageAvailable) {
      return defaults;
    }

    try {
      this.#storage.removeItem(STORAGE_KEY);
    } catch {
      this.#storageAvailable = false;
    }

    return defaults;
  }
}

const defaultStore = new UserStateStore();

export function loadUserState(): SolarKidsUserState {
  return defaultStore.loadUserState();
}

export function saveUserState(state: SolarKidsUserState): void {
  defaultStore.saveUserState(state);
}

export function updateUserState(
  patch: Partial<SolarKidsUserState>,
): SolarKidsUserState {
  return defaultStore.updateUserState(patch);
}

export function setLanguage(language: LanguageCode): SolarKidsUserState {
  return defaultStore.setLanguage(language);
}

export function setSkin(skinId: string): SolarKidsUserState {
  return defaultStore.setSkin(skinId);
}

export function markPlanetVisited(planetId: string): SolarKidsUserState {
  return defaultStore.markPlanetVisited(planetId);
}

export function markTaskCompleted(taskId: string): SolarKidsUserState {
  return defaultStore.markTaskCompleted(taskId);
}

export function saveGameResult(
  score: number,
  success: boolean,
): SolarKidsUserState {
  return defaultStore.saveGameResult(score, success);
}

export function resetUserState(): SolarKidsUserState {
  return defaultStore.resetUserState();
}
