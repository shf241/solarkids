export type OrbitZone = "inner" | "reference" | "outer";

export interface ExploredOrbitZones {
  inner: boolean;
  outer: boolean;
}

export interface OrbitGameState {
  planetId: string;
  radiusRatio: number;
  zone: OrbitZone;
  exploredZones: ExploredOrbitZones;
  score: number;
  completed: boolean;
}

export interface OrbitObservation {
  radiusRatio: number;
  periodRatio: number;
  speedRatio: number;
  zone: OrbitZone;
}

export interface GameResult {
  planetId: string;
  radiusRatio: number;
  zone: OrbitZone;
  exploredZones: ExploredOrbitZones;
  score: number;
  success: boolean;
}
