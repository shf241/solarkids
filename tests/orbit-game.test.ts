import { describe, expect, it } from "vitest";

import {
  calculateOrbitObservation,
  calculateOrbitZone,
  createGameState,
  finishGame,
  INNER_ORBIT_MAX,
  MAX_ORBIT_RADIUS_RATIO,
  MIN_ORBIT_RADIUS_RATIO,
  OUTER_ORBIT_MIN,
  resetGame,
  saveOrbitGameResult,
  setOrbitRadius,
} from "../src/game/index.ts";
import { UserStateStore } from "../src/storage/index.ts";
import { MemoryStorage } from "./helpers/memory-storage";

describe("orbit radius teaching model", () => {
  it("G-01 creates a reference circular-orbit state", () => {
    expect(createGameState("earth")).toEqual({
      planetId: "earth",
      radiusRatio: 1,
      zone: "reference",
      exploredZones: {
        inner: false,
        outer: false,
      },
      score: 0,
      completed: false,
    });
  });

  it("G-02 classifies both teaching-zone boundaries exactly", () => {
    expect(calculateOrbitZone(INNER_ORBIT_MAX)).toBe("inner");
    expect(calculateOrbitZone(INNER_ORBIT_MAX + 0.001)).toBe("reference");
    expect(calculateOrbitZone(OUTER_ORBIT_MIN - 0.001)).toBe("reference");
    expect(calculateOrbitZone(OUTER_ORBIT_MIN)).toBe("outer");
  });

  it("G-03 records an inner-orbit exploration once", () => {
    const state = setOrbitRadius(createGameState("earth"), 0.75);

    expect(state.zone).toBe("inner");
    expect(state.exploredZones).toEqual({ inner: true, outer: false });
    expect(state.score).toBe(50);
    expect(state.completed).toBe(false);
  });

  it("G-04 records an outer-orbit exploration once", () => {
    const state = setOrbitRadius(createGameState("earth"), 1.25);

    expect(state.zone).toBe("outer");
    expect(state.exploredZones).toEqual({ inner: false, outer: true });
    expect(state.score).toBe(50);
    expect(state.completed).toBe(false);
  });

  it("G-05 completes only after exploring both sides", () => {
    const inner = setOrbitRadius(createGameState("earth"), 0.75);
    const completed = setOrbitRadius(inner, 1.25);

    expect(completed.exploredZones).toEqual({ inner: true, outer: true });
    expect(completed.score).toBe(100);
    expect(completed.completed).toBe(true);
  });

  it("G-06 clamps dragging to the visible teaching range", () => {
    const initial = createGameState("earth");

    expect(setOrbitRadius(initial, 0.1).radiusRatio).toBe(
      MIN_ORBIT_RADIUS_RATIO,
    );
    expect(setOrbitRadius(initial, 3).radiusRatio).toBe(
      MAX_ORBIT_RADIUS_RATIO,
    );
  });

  it("G-07 follows circular-orbit speed and period relationships", () => {
    const reference = calculateOrbitObservation(1);
    const inner = calculateOrbitObservation(0.75);
    const outer = calculateOrbitObservation(1.25);

    expect(reference.periodRatio).toBe(1);
    expect(reference.speedRatio).toBe(1);
    expect(inner.periodRatio).toBeLessThan(1);
    expect(inner.speedRatio).toBeGreaterThan(1);
    expect(outer.periodRatio).toBeGreaterThan(1);
    expect(outer.speedRatio).toBeLessThan(1);
  });

  it("G-08 resets radius, progress, score, and completion", () => {
    const completed = setOrbitRadius(
      setOrbitRadius(createGameState("earth"), 0.75),
      1.25,
    );

    expect(resetGame(completed)).toEqual(createGameState("earth"));
  });

  it("G-09 rejects invalid planet IDs and radius ratios", () => {
    expect(() => createGameState("  ")).toThrow(TypeError);
    expect(() =>
      setOrbitRadius(createGameState("earth"), Number.NaN),
    ).toThrow(TypeError);
    expect(() => calculateOrbitObservation(0)).toThrow(TypeError);
  });

  it("G-10 returns a complete immutable game result", () => {
    const completed = setOrbitRadius(
      setOrbitRadius(createGameState("earth"), 0.75),
      1.25,
    );
    const result = finishGame(completed);

    expect(result).toEqual({
      planetId: "earth",
      radiusRatio: 1.25,
      zone: "outer",
      exploredZones: { inner: true, outer: true },
      score: 100,
      success: true,
    });
    expect(result.exploredZones).not.toBe(completed.exploredZones);
  });

  it("G-11 saves a completed exploration through the storage module", () => {
    const store = new UserStateStore(new MemoryStorage());
    const completed = setOrbitRadius(
      setOrbitRadius(createGameState("earth"), 0.75),
      1.25,
    );
    const saved = saveOrbitGameResult(completed, store);

    expect(saved.result.success).toBe(true);
    expect(saved.userState.gameRecord).toEqual({
      playCount: 1,
      successCount: 1,
      bestScore: 100,
      lastScore: 100,
    });
  });

  it("G-12 does not mutate the input state", () => {
    const initial = createGameState("earth");
    const snapshot = structuredClone(initial);
    const moved = setOrbitRadius(initial, 0.75);

    expect(initial).toEqual(snapshot);
    expect(moved).not.toBe(initial);
    expect(moved.exploredZones).not.toBe(initial.exploredZones);
  });

  it("G-13 returns the same state for the same input", () => {
    const initial = createGameState("earth");

    expect(setOrbitRadius(initial, 1.25)).toEqual(
      setOrbitRadius(initial, 1.25),
    );
  });
});
