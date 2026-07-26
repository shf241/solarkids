import type { LanguageCode } from "../storage";

export type TranslationDictionary = Record<string, string>;

export type TranslationData = Record<
  LanguageCode,
  TranslationDictionary
>;
