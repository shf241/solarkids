import {
  UserStateStore,
  type SolarKidsUserState,
} from "../storage/index.js";
import type {
  ExploredOrbitZones,
  GameResult,
  OrbitGameState,
  OrbitObservation,
  OrbitZone,
} from "./types.js";

export const MIN_ORBIT_RADIUS_RATIO = 0.65;
export const MAX_ORBIT_RADIUS_RATIO = 1.35;
export const INNER_ORBIT_MAX = 0.82;
export const OUTER_ORBIT_MIN = 1.18;

function normalizePlanetId(planetId: string): string {
  const normalized = planetId.trim();
  if (!normalized) {
    throw new TypeError("Planet ID must not be empty.");
  }

  return normalized;
}

function assertRadiusRatio(radiusRatio: number): void {
  if (!Number.isFinite(radiusRatio) || radiusRatio <= 0) {
    throw new TypeError("Orbit radius ratio must be a positive finite number.");
  }
}

function clampRadiusRatio(radiusRatio: number): number {
  return Math.min(
    MAX_ORBIT_RADIUS_RATIO,
    Math.max(MIN_ORBIT_RADIUS_RATIO, radiusRatio),
  );
}

function cloneExploredZones(
  exploredZones: Readonly<ExploredOrbitZones>,
): ExploredOrbitZones {
  return { ...exploredZones };
}

export function calculateOrbitZone(radiusRatio: number): OrbitZone {
  assertRadiusRatio(radiusRatio);

  if (radiusRatio <= INNER_ORBIT_MAX) return "inner";
  if (radiusRatio >= OUTER_ORBIT_MIN) return "outer";
  return "reference";
}

export function calculateOrbitObservation(
  radiusRatio: number,
): OrbitObservation {
  assertRadiusRatio(radiusRatio);

  return {
    radiusRatio,
    periodRatio: radiusRatio ** 1.5,
    speedRatio: radiusRatio ** -0.5,
    zone: calculateOrbitZone(radiusRatio),
  };
}

export function createGameState(planetId: string): OrbitGameState {
  return {
    planetId: normalizePlanetId(planetId),
    radiusRatio: 1,
    zone: "reference",
    exploredZones: {
      inner: false,
      outer: false,
    },
    score: 0,
    completed: false,
  };
}

export function setOrbitRadius(
  state: OrbitGameState,
  radiusRatio: number,
): OrbitGameState {
  assertRadiusRatio(radiusRatio);
  const nextRadiusRatio = clampRadiusRatio(radiusRatio);
  const zone = calculateOrbitZone(nextRadiusRatio);
  const exploredZones = {
    inner: state.exploredZones.inner || zone === "inner",
    outer: state.exploredZones.outer || zone === "outer",
  };
  const score =
    (exploredZones.inner ? 50 : 0) + (exploredZones.outer ? 50 : 0);

  return {
    ...state,
    radiusRatio: nextRadiusRatio,
    zone,
    exploredZones,
    score,
    completed: exploredZones.inner && exploredZones.outer,
  };
}

export function resetGame(state: OrbitGameState): OrbitGameState {
  return createGameState(state.planetId);
}

export function finishGame(state: OrbitGameState): GameResult {
  return {
    planetId: state.planetId,
    radiusRatio: state.radiusRatio,
    zone: state.zone,
    exploredZones: cloneExploredZones(state.exploredZones),
    score: state.score,
    success: state.completed,
  };
}

export function saveOrbitGameResult(
  state: OrbitGameState,
  store = new UserStateStore(),
): { result: GameResult; userState: SolarKidsUserState } {
  const result = finishGame(state);
  const userState = store.saveGameResult(result.score, result.success);

  return { result, userState };
}
