import languageData from "../data/language.json";
import {
  UserStateStore,
  type LanguageCode,
} from "../storage";
import type { TranslationData } from "./types";

const DEFAULT_LANGUAGE: LanguageCode = "zh-CN";
const dictionaries = languageData as TranslationData;

export class I18nService {
  readonly #store: UserStateStore;
  readonly #dictionaries: TranslationData;

  constructor(
    store = new UserStateStore(),
    translationData: TranslationData = dictionaries,
  ) {
    this.#store = store;
    this.#dictionaries = translationData;
  }

  getLanguage(): LanguageCode {
    return this.#store.loadUserState().language;
  }

  setLanguage(language: LanguageCode): void {
    this.#store.setLanguage(language);
  }

  translate(key: string, language = this.getLanguage()): string {
    const selected = this.#dictionaries[language];
    const fallback = this.#dictionaries[DEFAULT_LANGUAGE];

    return selected?.[key] || fallback[key] || key;
  }

  hasTranslation(key: string, language = this.getLanguage()): boolean {
    const value = this.#dictionaries[language]?.[key];
    return typeof value === "string" && value.length > 0;
  }
}

const defaultI18n = new I18nService();

export function getLanguage(): LanguageCode {
  return defaultI18n.getLanguage();
}

export function setLanguage(language: LanguageCode): void {
  defaultI18n.setLanguage(language);
}

export function translate(
  key: string,
  language?: LanguageCode,
): string {
  return defaultI18n.translate(key, language);
}

export function hasTranslation(
  key: string,
  language?: LanguageCode,
): boolean {
  return defaultI18n.hasTranslation(key, language);
}
