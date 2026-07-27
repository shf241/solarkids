export type LanguageCode = "zh-CN" | "en";

export interface LearningProgress {
  visitedPlanetIds: string[];
  completedTaskIds: string[];
}

export interface GameRecord {
  playCount: number;
  successCount: number;
  bestScore: number;
  lastScore: number;
}

export interface SolarKidsUserState {
  version: 1;
  language: LanguageCode;
  skinId: string;
  learningProgress: LearningProgress;
  gameRecord: GameRecord;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
