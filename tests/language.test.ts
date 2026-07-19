import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import languageData from "../src/data/language.json";
import {
  I18nService,
  type TranslationData,
} from "../src/i18n";
import {
  UserStateStore,
  type LanguageCode,
} from "../src/storage";
import { MemoryStorage } from "./helpers/memory-storage";

const dictionaries = languageData as TranslationData;
const planetIds = [
  "mercury",
  "venus",
  "earth",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
] as const;
const planetFields = [
  "name",
  "keyword1",
  "keyword2",
  "keyword3",
  "fact1",
  "fact2",
] as const;

function createService(storage = new MemoryStorage()): I18nService {
  return new I18nService(new UserStateStore(storage));
}

describe("language data and I18nService", () => {
  it("L-01 is valid standard JSON", () => {
    const rawJson = readFileSync(
      new URL("../src/data/language.json", import.meta.url),
      "utf8",
    );

    expect(() => JSON.parse(rawJson)).not.toThrow();
  });

  it("L-02 has exactly the same keys in Chinese and English", () => {
    const chineseKeys = Object.keys(dictionaries["zh-CN"]).sort();
    const englishKeys = Object.keys(dictionaries.en).sort();

    expect(englishKeys).toEqual(chineseKeys);
  });

  it("L-03 contains only non-empty strings", () => {
    for (const dictionary of Object.values(dictionaries)) {
      for (const value of Object.values(dictionary)) {
        expect(typeof value).toBe("string");
        expect(value.trim()).not.toBe("");
      }
    }
  });

  it("L-04 returns Chinese by default", () => {
    const service = createService();

    expect(service.getLanguage()).toBe("zh-CN");
    expect(service.translate("action.start")).toBe("开始探索");
  });

  it("L-05 returns English after switching language", () => {
    const service = createService();

    service.setLanguage("en");

    expect(service.translate("action.start")).toBe("Start Exploring");
  });

  it("L-06 falls back to Chinese and then the key", () => {
    const partialData: TranslationData = {
      "zh-CN": { "only.chinese": "中文回退" },
      en: {},
    };
    const service = new I18nService(
      new UserStateStore(new MemoryStorage()),
      partialData,
    );

    expect(service.translate("only.chinese", "en")).toBe("中文回退");
    expect(service.translate("missing.key", "en")).toBe("missing.key");
    expect(service.hasTranslation("missing.key", "en")).toBe(false);
  });

  it("L-07 keeps English after creating a new service", () => {
    const storage = new MemoryStorage();
    createService(storage).setLanguage("en");

    expect(createService(storage).getLanguage()).toBe("en");
  });

  it("L-08 falls back to Chinese for an invalid language code", () => {
    const service = createService();

    service.setLanguage("fr" as LanguageCode);

    expect(service.getLanguage()).toBe("zh-CN");
    expect(service.translate("action.start")).toBe("开始探索");
  });

  it("L-09 includes all required fields for all eight planets", () => {
    for (const language of ["zh-CN", "en"] as const) {
      for (const planetId of planetIds) {
        for (const field of planetFields) {
          const key = `planet.${planetId}.${field}`;
          expect(
            dictionaries[language][key],
            `${language} is missing ${key}`,
          ).toBeTruthy();
        }
      }
    }
  });

  it("L-10 keeps children's English facts short and friendly", () => {
    const forbiddenWords = /\b(error|failed|invalid)\b/i;
    const englishFacts = Object.entries(dictionaries.en).filter(([key]) =>
      key.endsWith(".fact1") || key.endsWith(".fact2"),
    );

    for (const [, fact] of englishFacts) {
      expect(fact.length).toBeLessThanOrEqual(100);
      expect(fact).not.toMatch(forbiddenWords);
    }
  });
});
