export { createDefaultUserState, STORAGE_KEY } from "./defaults.js";
export {
  loadUserState,
  markPlanetVisited,
  markTaskCompleted,
  normalizeUserState,
  resetUserState,
  saveGameResult,
  saveUserState,
  setLanguage,
  setSkin,
  updateUserState,
  UserStateStore,
} from "./storage.js";
export type {
  GameRecord,
  LanguageCode,
  LearningProgress,
  SolarKidsUserState,
  StorageLike,
} from "./types.js";
