export interface Point {
  x: number;
  y: number;
}

export type OrbitChangeLevel = "stable" | "small" | "large";

export interface OrbitGameState {
  planetId: string;
  startPosition: Point;
  currentPosition: Point;
  displacement: number;
  changeLevel: OrbitChangeLevel;
  score: number;
  completed: boolean;
}

export interface GameResult {
  planetId: string;
  displacement: number;
  changeLevel: OrbitChangeLevel;
  score: number;
  success: boolean;
}
