import type { SolarKidsUserState } from "./types";

export const STORAGE_KEY = "solarkids.user-state.v1";

export function createDefaultUserState(): SolarKidsUserState {
  return {
    version: 1,
    language: "zh-CN",
    skinId: "default",
    learningProgress: {
      visitedPlanetIds: [],
      completedTaskIds: [],
    },
    gameRecord: {
      playCount: 0,
      successCount: 0,
      bestScore: 0,
      lastScore: 0,
    },
  };
}
