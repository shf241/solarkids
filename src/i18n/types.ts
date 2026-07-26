import type { LanguageCode } from "../storage/index.js";

export type TranslationDictionary = Record<string, string>;

export type TranslationData = Record<
  LanguageCode,
  TranslationDictionary
>;

export type TranslationFetcher = (
  input: string,
) => Promise<Pick<Response, "ok" | "status" | "json">>;
