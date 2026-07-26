import { describe, expect, it } from "vitest";

import {
  calculateChangeLevel,
  createGameState,
  finishGame,
  LARGE_CHANGE_DISTANCE_MIN,
  movePlanet,
  resetGame,
  saveOrbitGameResult,
  STABLE_DISTANCE_MAX,
} from "../src/game/index.ts";
import { UserStateStore } from "../src/storage/index.ts";
import { MemoryStorage } from "./helpers/memory-storage";

describe("orbit game teaching model", () => {
  it("G-01 creates a valid initial state", () => {
    const state = createGameState("earth", { x: 10, y: 20 });

    expect(state).toEqual({
      planetId: "earth",
      startPosition: { x: 10, y: 20 },
      currentPosition: { x: 10, y: 20 },
      displacement: 0,
      changeLevel: "stable",
      score: 0,
      completed: false,
    });
  });

  it("G-02 treats zero movement as stable", () => {
    const initial = createGameState("earth", { x: 0, y: 0 });

    expect(movePlanet(initial, { x: 0, y: 0 }).changeLevel).toBe("stable");
  });

  it("G-03 classifies a small drag as a small change", () => {
    const initial = createGameState("mars", { x: 0, y: 0 });
    const state = movePlanet(initial, { x: 10, y: 0 });

    expect(state.changeLevel).toBe("small");
    expect(state.score).toBe(50);
    expect(state.completed).toBe(false);
  });

  it("G-04 classifies a large drag as a large change", () => {
    const initial = createGameState("jupiter", { x: 0, y: 0 });
    const state = movePlanet(initial, { x: 60, y: 0 });

    expect(state.changeLevel).toBe("large");
    expect(state.score).toBe(100);
    expect(state.completed).toBe(true);
  });

  it("G-05 handles both threshold boundaries exactly", () => {
    expect(calculateChangeLevel(STABLE_DISTANCE_MAX)).toBe("stable");
    expect(calculateChangeLevel(STABLE_DISTANCE_MAX + 0.001)).toBe("small");
    expect(calculateChangeLevel(LARGE_CHANGE_DISTANCE_MIN - 0.001)).toBe(
      "small",
    );
    expect(calculateChangeLevel(LARGE_CHANGE_DISTANCE_MIN)).toBe("large");
  });

  it("G-06 measures consecutive drags from the start position", () => {
    const initial = createGameState("saturn", { x: 10, y: 10 });
    const firstMove = movePlanet(initial, { x: 20, y: 10 });
    const secondMove = movePlanet(firstMove, { x: 40, y: 10 });

    expect(firstMove.displacement).toBe(10);
    expect(secondMove.displacement).toBe(30);
    expect(secondMove.currentPosition).toEqual({ x: 40, y: 10 });
  });

  it("G-07 resets position, level, score, and completion", () => {
    const initial = createGameState("venus", { x: 5, y: 8 });
    const moved = movePlanet(initial, { x: 100, y: 8 });

    expect(resetGame(moved)).toEqual(initial);
  });

  it("G-08 rejects non-finite coordinates", () => {
    expect(() =>
      createGameState("earth", { x: Number.NaN, y: 0 }),
    ).toThrow(TypeError);
    expect(() =>
      movePlanet(createGameState("earth", { x: 0, y: 0 }), {
        x: Number.POSITIVE_INFINITY,
        y: 0,
      }),
    ).toThrow(TypeError);
  });

  it("G-09 returns a complete game result", () => {
    const state = movePlanet(
      createGameState("neptune", { x: 0, y: 0 }),
      { x: 60, y: 0 },
    );

    expect(finishGame(state)).toEqual({
      planetId: "neptune",
      displacement: 60,
      changeLevel: "large",
      score: 100,
      success: true,
    });
  });

  it("G-10 saves the finished result through the storage module", () => {
    const store = new UserStateStore(new MemoryStorage());
    const state = movePlanet(
      createGameState("uranus", { x: 0, y: 0 }),
      { x: 60, y: 0 },
    );

    const saved = saveOrbitGameResult(state, store);

    expect(saved.result.success).toBe(true);
    expect(saved.userState.gameRecord).toEqual({
      playCount: 1,
      successCount: 1,
      bestScore: 100,
      lastScore: 100,
    });
  });

  it("G-11 does not mutate the input state", () => {
    const initial = createGameState("mercury", { x: 0, y: 0 });
    const snapshot = structuredClone(initial);

    const moved = movePlanet(initial, { x: 30, y: 40 });

    expect(initial).toEqual(snapshot);
    expect(moved).not.toBe(initial);
    expect(moved.startPosition).not.toBe(initial.startPosition);
    expect(moved.currentPosition).not.toBe(initial.currentPosition);
  });

  it("rejects empty planet IDs and invalid displacement values", () => {
    expect(() => createGameState("  ", { x: 0, y: 0 })).toThrow(TypeError);
    expect(() => calculateChangeLevel(-1)).toThrow(TypeError);
    expect(() => calculateChangeLevel(Number.NaN)).toThrow(TypeError);
  });

  it("returns the same state for the same input", () => {
    const state = createGameState("earth", { x: 2, y: 3 });
    const target = { x: 14, y: 8 };

    expect(movePlanet(state, target)).toEqual(movePlanet(state, target));
  });
});
