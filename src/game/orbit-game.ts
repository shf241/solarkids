import {
  UserStateStore,
  type SolarKidsUserState,
} from "../storage";
import type {
  GameResult,
  OrbitChangeLevel,
  OrbitGameState,
  Point,
} from "./types";

export const STABLE_DISTANCE_MAX = 5;
export const LARGE_CHANGE_DISTANCE_MIN = 60;

const SCORE_BY_CHANGE_LEVEL: Record<OrbitChangeLevel, number> = {
  stable: 0,
  small: 50,
  large: 100,
};

function assertPoint(point: Point): void {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new TypeError("Point coordinates must be finite numbers.");
  }
}

function normalizePlanetId(planetId: string): string {
  const normalized = planetId.trim();
  if (!normalized) {
    throw new TypeError("Planet ID must not be empty.");
  }

  return normalized;
}

function clonePoint(point: Point): Point {
  return { x: point.x, y: point.y };
}

export function calculateDisplacement(start: Point, target: Point): number {
  assertPoint(start);
  assertPoint(target);
  return Math.hypot(target.x - start.x, target.y - start.y);
}

export function calculateChangeLevel(
  displacement: number,
): OrbitChangeLevel {
  if (!Number.isFinite(displacement) || displacement < 0) {
    throw new TypeError("Displacement must be a non-negative finite number.");
  }

  if (displacement <= STABLE_DISTANCE_MAX) {
    return "stable";
  }

  return displacement < LARGE_CHANGE_DISTANCE_MIN ? "small" : "large";
}

export function createGameState(
  planetId: string,
  startPosition: Point,
): OrbitGameState {
  assertPoint(startPosition);

  return {
    planetId: normalizePlanetId(planetId),
    startPosition: clonePoint(startPosition),
    currentPosition: clonePoint(startPosition),
    displacement: 0,
    changeLevel: "stable",
    score: SCORE_BY_CHANGE_LEVEL.stable,
    completed: false,
  };
}

export function movePlanet(
  state: OrbitGameState,
  target: Point,
): OrbitGameState {
  assertPoint(target);
  const displacement = calculateDisplacement(state.startPosition, target);
  const changeLevel = calculateChangeLevel(displacement);

  return {
    ...state,
    startPosition: clonePoint(state.startPosition),
    currentPosition: clonePoint(target),
    displacement,
    changeLevel,
    score: SCORE_BY_CHANGE_LEVEL[changeLevel],
    completed: changeLevel === "large",
  };
}

export function resetGame(state: OrbitGameState): OrbitGameState {
  return createGameState(state.planetId, state.startPosition);
}

export function finishGame(state: OrbitGameState): GameResult {
  return {
    planetId: state.planetId,
    displacement: state.displacement,
    changeLevel: state.changeLevel,
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
