export { createDefaultUserState, STORAGE_KEY } from "./defaults";
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
} from "./storage";
export type {
  GameRecord,
  LanguageCode,
  LearningProgress,
  SolarKidsUserState,
  StorageLike,
} from "./types";
