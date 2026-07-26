import { describe, expect, it } from "vitest";

import {
  createDefaultUserState,
  STORAGE_KEY,
  UserStateStore,
} from "../src/storage/index.ts";
import { MemoryStorage, ThrowingStorage } from "./helpers/memory-storage";

describe("UserStateStore", () => {
  it("S-01 returns complete defaults on first visit", () => {
    const store = new UserStateStore(new MemoryStorage());

    expect(store.loadUserState()).toEqual(createDefaultUserState());
  });

  it("S-02 reads the same valid state after saving", () => {
    const storage = new MemoryStorage();
    const firstStore = new UserStateStore(storage);
    const expected = {
      ...createDefaultUserState(),
      language: "en" as const,
      skinId: "night",
    };

    firstStore.saveUserState(expected);
    const reloadedStore = new UserStateStore(storage);

    expect(reloadedStore.loadUserState()).toEqual(expected);
  });

  it("S-03 changes language without losing other fields", () => {
    const store = new UserStateStore(new MemoryStorage());
    store.setSkin("night");

    const state = store.setLanguage("en");

    expect(state.language).toBe("en");
    expect(state.skinId).toBe("night");
  });

  it("S-04 changes skin without losing other fields", () => {
    const store = new UserStateStore(new MemoryStorage());
    store.setLanguage("en");

    const state = store.setSkin("colorful");

    expect(state.skinId).toBe("colorful");
    expect(state.language).toBe("en");
  });

  it("uses the UI cartoon skin as the default", () => {
    const store = new UserStateStore(new MemoryStorage());

    expect(store.loadUserState().skinId).toBe("cartoon");
  });

  it("S-05 records a visited planet once", () => {
    const store = new UserStateStore(new MemoryStorage());

    store.markPlanetVisited("earth");
    const state = store.markPlanetVisited(" earth ");

    expect(state.learningProgress.visitedPlanetIds).toEqual(["earth"]);
  });

  it("S-06 updates all counters for a successful game", () => {
    const store = new UserStateStore(new MemoryStorage());

    const state = store.saveGameResult(80, true);

    expect(state.gameRecord).toEqual({
      playCount: 1,
      successCount: 1,
      bestScore: 80,
      lastScore: 80,
    });
  });

  it("S-07 does not lower the best score", () => {
    const store = new UserStateStore(new MemoryStorage());
    store.saveGameResult(90, true);

    const state = store.saveGameResult(40, false);

    expect(state.gameRecord).toEqual({
      playCount: 2,
      successCount: 1,
      bestScore: 90,
      lastScore: 40,
    });
  });

  it("S-08 recovers from malformed JSON", () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, "{bad-json");
    const store = new UserStateStore(storage);

    expect(store.loadUserState()).toEqual(createDefaultUserState());
  });

  it("S-09 fills fields missing from stored data", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        language: "en",
        learningProgress: { visitedPlanetIds: ["mars"] },
      }),
    );
    const store = new UserStateStore(storage);

    expect(store.loadUserState()).toEqual({
      ...createDefaultUserState(),
      language: "en",
      learningProgress: {
        visitedPlanetIds: ["mars"],
        completedTaskIds: [],
      },
    });
  });

  it("S-10 falls back to Chinese for an invalid language", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, language: "fr" }),
    );
    const store = new UserStateStore(storage);

    expect(store.loadUserState().language).toBe("zh-CN");
  });

  it("S-11 normalizes negative and non-finite scores", () => {
    const store = new UserStateStore(new MemoryStorage());

    expect(store.saveGameResult(-20, false).gameRecord.lastScore).toBe(0);
    expect(store.saveGameResult(Number.NaN, false).gameRecord.lastScore).toBe(0);
    expect(
      store.saveGameResult(Number.POSITIVE_INFINITY, false).gameRecord.lastScore,
    ).toBe(0);
  });

  it("S-12 removes stored data and returns defaults", () => {
    const storage = new MemoryStorage();
    const store = new UserStateStore(storage);
    store.setLanguage("en");

    expect(store.resetUserState()).toEqual(createDefaultUserState());
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
    expect(store.loadUserState()).toEqual(createDefaultUserState());
  });

  it("S-13 recovers when storage reads throw", () => {
    const store = new UserStateStore(new ThrowingStorage("get"));

    expect(() => store.loadUserState()).not.toThrow();
    expect(store.loadUserState()).toEqual(createDefaultUserState());
  });

  it("S-14 remains usable when storage writes throw", () => {
    const store = new UserStateStore(new ThrowingStorage("set"));

    expect(() => store.setLanguage("en")).not.toThrow();
    expect(store.setLanguage("en").language).toBe("en");
    expect(store.loadUserState().language).toBe("en");
  });

  it("records completed task IDs without duplicates", () => {
    const store = new UserStateStore(new MemoryStorage());

    store.markTaskCompleted("learn-earth");
    const state = store.markTaskCompleted("learn-earth");

    expect(state.learningProgress.completedTaskIds).toEqual(["learn-earth"]);
  });

  it("falls back to defaults for an unsupported data version", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 2, language: "en" }),
    );

    expect(new UserStateStore(storage).loadUserState()).toEqual(
      createDefaultUserState(),
    );
  });
});
