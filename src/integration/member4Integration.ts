import {
  I18nService,
  loadTranslationData,
  type TranslationData,
} from '../i18n/index.js';
import {
  UserStateStore,
  type LanguageCode,
  type SolarKidsUserState,
} from '../storage/index.js';
import type { PlanetInfo } from '../ui/index.js';

export interface Member4Integration {
  readonly store: UserStateStore;
  readonly i18n: I18nService;
  readonly translationsLoaded: boolean;
  getState(): SolarKidsUserState;
  getLanguage(): LanguageCode;
  toggleLanguage(): LanguageCode;
  translate(key: string): string;
  localizeInfo(info: PlanetInfo | null): PlanetInfo | null;
  applyDocumentLanguage(root?: Document): void;
}

export async function createMember4Integration(
  store = new UserStateStore(),
  translationLoader: () => Promise<TranslationData> = loadTranslationData,
): Promise<Member4Integration> {
  let translationsLoaded = true;
  let i18n: I18nService;

  try {
    const translationData = await translationLoader();
    i18n = new I18nService(store, translationData);
  } catch (error) {
    translationsLoaded = false;
    i18n = new I18nService(store);
    console.warn('语言词典加载失败，已使用内置基础词典。', error);
  }

  const translate = (key: string): string => i18n.translate(key);

  return {
    store,
    i18n,
    translationsLoaded,

    getState(): SolarKidsUserState {
      return store.loadUserState();
    },

    getLanguage(): LanguageCode {
      return i18n.getLanguage();
    },

    toggleLanguage(): LanguageCode {
      const nextLanguage = i18n.getLanguage() === 'zh-CN' ? 'en' : 'zh-CN';
      i18n.setLanguage(nextLanguage);
      return nextLanguage;
    },

    translate,

    localizeInfo(info: PlanetInfo | null): PlanetInfo | null {
      if (!info?.id) return info;
      return info.id.startsWith('scene.')
        ? localizeSceneInfo(info, i18n)
        : localizePlanetInfo(info, i18n);
    },

    applyDocumentLanguage(root = document): void {
      const language = i18n.getLanguage();
      root.documentElement.lang = language === 'zh-CN' ? 'zh-CN' : 'en';
      root.title = translate('app.title');

      root.querySelectorAll<HTMLElement>('[data-i18n]').forEach(element => {
        const key = element.dataset.i18n;
        const value = key ? translate(key) : '';
        if (key && value !== key) element.textContent = value;
      });

      root
        .querySelectorAll<HTMLElement>('[data-i18n-title]')
        .forEach(element => {
          const key = element.dataset.i18nTitle;
          const value = key ? translate(key) : '';
          if (key && value !== key) element.title = value;
        });

      root
        .querySelectorAll<HTMLElement>('[data-i18n-aria-label]')
        .forEach(element => {
          const key = element.dataset.i18nAriaLabel;
          const value = key ? translate(key) : '';
          if (key && value !== key) element.setAttribute('aria-label', value);
        });
    },
  };
}

function localizePlanetInfo(
  info: PlanetInfo,
  i18n: I18nService,
): PlanetInfo {
  const prefix = `planet.${info.id}`;
  if (!i18n.hasTranslation(`${prefix}.name`)) return info;

  return {
    ...info,
    nameCN: i18n.translate(`${prefix}.name`),
    desc: [1, 2]
      .map(index => i18n.translate(`${prefix}.fact${index}`))
      .join(' '),
    stats: [1, 2, 3].map(index => ({
      label: i18n.translate(`planet.feature${index}`),
      value: i18n.translate(`${prefix}.keyword${index}`),
    })),
  };
}

function localizeSceneInfo(
  info: PlanetInfo,
  i18n: I18nService,
): PlanetInfo {
  if (!i18n.hasTranslation(`${info.id}.title`)) return info;

  return {
    ...info,
    nameCN: i18n.translate(`${info.id}.title`),
    desc: i18n.translate(`${info.id}.description`),
    stats: info.stats.map((stat, index) => {
      const prefix = `${info.id}.stat${index + 1}`;
      return {
        label: i18n.hasTranslation(`${prefix}.label`)
          ? i18n.translate(`${prefix}.label`)
          : stat.label,
        value: i18n.hasTranslation(`${prefix}.value`)
          ? i18n.translate(`${prefix}.value`)
          : stat.value,
      };
    }),
  };
}
