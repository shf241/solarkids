import {
  UserStateStore,
  type LanguageCode,
} from "../storage/index.js";
import type {
  TranslationData,
  TranslationDictionary,
  TranslationFetcher,
} from "./types.js";

const DEFAULT_LANGUAGE: LanguageCode = "zh-CN";

const FALLBACK_TRANSLATIONS: TranslationData = {
  "zh-CN": {
    "app.title": "SolarKids",
    "canvas.ariaLabel": "太阳系交互画布：总览中拖动旋转，按住 Shift 拖动平移；地表视角中拖动环顾天空。",
    "action.play": "继续",
    "action.pause": "暂停",
    "action.reset": "重置",
    "nav.experiences": "视角与天文现象",
    "nav.overview": "太阳系总览",
    "nav.earthView": "地表视角",
    "nav.orbits": "轨道",
    "nav.language": "语言",
    "nav.skin": "天体皮肤",
    "nav.game": "轨道小游戏",
    "nav.eclipse": "日食/月食",
    "nav.comet": "彗星",
    "nav.magnetic": "磁场",
    "nav.solarWind": "太阳风",
    "nav.solarRain": "太阳雨",
    "nav.help": "操作帮助",
    "toast.welcome": "欢迎来到 SolarKids！点击行星开始探索吧。",
    "toast.play": "已继续播放",
    "toast.pause": "已暂停",
    "toast.zoomIn": "已放大",
    "toast.zoomOut": "已缩小",
    "toast.resetView": "视角已重置",
    "toast.overview": "已切换到太阳系总览",
    "toast.earthView": "已站在地球表面观察天空",
    "toast.earthViewUnavailable": "地表视角仅在太阳系总览中可用",
    "toast.orbitsShown": "已显示轨道",
    "toast.orbitsHidden": "已隐藏轨道",
    "toast.skinChanged": "已切换天体皮肤",
    "toast.languageChanged": "语言词典不可用，继续使用中文",
    "toast.planetFound": "你发现了",
    "skin.title": "天体换肤",
    "skin.cartoon.name": "卡通模式",
    "skin.realistic.name": "写实模式",
    "skin.current": "当前",
    "skin.instruction": "选择一套皮肤，太阳系会立刻换上新装。",
    "skin.detail": "两种模式共享球面动画，只替换天体、光环和星空纹理。",
    "help.title": "操作帮助",
    "help.drag": "鼠标或手指拖拽：旋转视角或移动游戏行星",
    "help.pan": "按住 Shift 拖拽：平移太阳系画面",
    "help.zoom": "滚轮或缩放按钮：缩放画面",
    "help.gesture": "双指手势：平移和缩放画面",
    "help.planet": "点击天体：查看详细信息并记录学习进度",
    "help.view": "太阳系总览和地表视角：切换观察位置",
    "help.keyboard": "方向键平移，+/- 缩放，0/E 切换视角",
    "help.play": "播放/暂停和速度滑块：控制动画",
    "help.skin": "天体皮肤：切换卡通或写实模式",
    "help.language": "语言：切换中文或英文",
    "hint.clickPlanet": "点一点行星，看看它的小秘密。",
    "hint.dragPlanet": "沿引导线拖动地球，比较近轨道和远轨道。",
    "game.title": "轨道半径实验",
    "game.instruction": "沿引导线向内、向外拖动地球，比较公转变化",
    "game.distance": "日地距离",
    "game.period": "公转周期",
    "game.year": "年",
    "game.speed.fast": "近轨道：更快",
    "game.speed.same": "参考轨道",
    "game.speed.slow": "远轨道：更慢",
    "game.zone.inner": "近轨道",
    "game.zone.reference": "参考轨道",
    "game.zone.outer": "远轨道",
    "game.progress.needBoth": "试试近 + 远",
    "game.progress.needInner": "再试近轨道",
    "game.progress.needOuter": "再试远轨道",
    "game.progress.complete": "探索完成 2/2",
    "game.modelNote": "模型：太阳引力下的圆轨道",
    "scene.eclipse.title": "日食与月食实验室",
    "scene.eclipse.description": "观察太阳、地球与月球排成一线时，光和影如何变化。",
    "scene.magnetic.title": "太阳与地球磁场",
    "scene.magnetic.description": "跟随发光粒子认识磁力线和地球磁场屏障。",
    "scene.solar-rain.title": "太阳风实验室",
    "scene.solar-rain.description": "观察太阳风与地球磁场的互动。",
    "scene.orbit-game.title": "轨道半径实验",
    "scene.orbit-game.description": "沿日地方向拖动地球，在太阳引力的简化圆轨道模型中比较距离、公转快慢和周期。",
    "solarWind.mode.radial": "向外辐射",
    "solarWind.mode.shield": "磁层屏障",
    "solarWind.mode.aurora": "极区互动",
    "solarWind.subtitle": "太阳自转不断把带电粒子送向行星空间",
    "solarWind.chip.radial": "粒子从太阳向四周传播",
    "solarWind.chip.shield": "多数粒子被地球磁层绕开",
    "solarWind.chip.aurora": "少量粒子沿磁力线进入极区",
    "solarWind.sun": "太阳",
    "solarWind.earth": "地球",
    "view.label": "视角",
    "view.overview": "太阳系总览",
    "view.focus": "聚焦",
    "view.earthFirstPerson": "地球地表观察",
    "body.celestial": "天体",
    "body.comet": "哈雷彗星",
    "body.moon": "月球",
    "eclipse.mode.solar": "日食",
    "eclipse.mode.lunar": "月食",
    "eclipse.mode.overview": "全景视角",
    "eclipse.mode.earth": "地球视角",
    "eclipse.timeline.start": "开始接近",
    "eclipse.timeline.align": "排成一线",
    "eclipse.timeline.end": "逐渐离开",
    "eclipse.status.solarAligned": "关键位置：月球影子落到地球上",
    "eclipse.status.lunarAligned": "关键位置：月球进入地球的影子",
    "eclipse.status.solarApproach": "月球正在靠近太阳与地球的连线",
    "eclipse.status.lunarApproach": "月球正在靠近地球背向太阳的一侧",
    "eclipse.note.solar": "日食时，月球位于太阳和地球之间。",
    "eclipse.note.lunar": "月食时，地球位于太阳和月球之间。",
    "eclipse.order.solar": "太阳 → 月球 → 地球",
    "eclipse.order.lunar": "太阳 → 地球 → 月球",
    "eclipse.coverage": "太阳遮挡约 {value}%",
    "eclipse.atmosphere": "地球大气会让月球呈现暗红色",
    "eclipse.view.solar": "从地面观察：月球圆面逐渐遮住太阳",
    "eclipse.view.lunar": "从地面观察：地球的影子缓慢掠过月球",
    "magnetic.mode.compare": "磁场对比",
    "magnetic.mode.sun": "太阳磁场",
    "magnetic.mode.earth": "地球磁场",
    "magnetic.compare.chip": "太阳磁场更巨大，地球磁场像保护伞",
    "magnetic.legend.sun": "太阳磁力线",
    "magnetic.legend.earth": "地球磁力线",
    "magnetic.legend.wind": "太阳风粒子",
    "magnetic.sun.label": "太阳磁场",
    "magnetic.sun.title": "太阳磁场",
    "magnetic.sun.fact1": "磁力线从一个区域伸出，再回到另一个区域。",
    "magnetic.sun.fact2": "太阳活动增强时，磁场会扭曲并释放带电粒子。",
    "magnetic.sun.activity": "当前活动等级：{value}",
    "magnetic.activity.active": "活跃",
    "magnetic.activity.steady": "平稳",
    "magnetic.activity.weak": "较弱",
    "magnetic.sun.chip": "发光粒子沿磁力线移动",
    "magnetic.earth.label": "地球磁场",
    "magnetic.earth.title": "地球的磁场保护罩",
    "magnetic.earth.fact1": "地球内部运动产生了一个巨大的磁场。",
    "magnetic.earth.fact2": "磁场会让许多太阳风粒子绕开地球。",
    "magnetic.earth.fact3": "靠近南北极的粒子可能形成美丽的极光。",
    "magnetic.earth.poles": "N 北磁极 · S 南磁极",
  },
  en: {
    "app.title": "SolarKids",
    "action.play": "Play",
    "action.pause": "Pause",
    "action.reset": "Reset",
    "nav.language": "Language",
  },
};

function isDictionary(value: unknown): value is TranslationDictionary {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every(
    item => typeof item === "string" && item.trim().length > 0,
  );
}

export function isTranslationData(value: unknown): value is TranslationData {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Partial<Record<LanguageCode, unknown>>;
  if (!isDictionary(candidate["zh-CN"]) || !isDictionary(candidate.en)) {
    return false;
  }

  const chineseKeys = Object.keys(candidate["zh-CN"]).sort();
  const englishKeys = Object.keys(candidate.en).sort();
  return (
    chineseKeys.length > 0 &&
    chineseKeys.length === englishKeys.length &&
    chineseKeys.every((key, index) => key === englishKeys[index])
  );
}

export async function loadTranslationData(
  url = "src/data/language.json",
  fetcher: TranslationFetcher = input => fetch(input),
): Promise<TranslationData> {
  const response = await fetcher(url);
  if (!response.ok) {
    throw new Error(`Failed to load translations: HTTP ${response.status}`);
  }

  const data: unknown = await response.json();
  if (!isTranslationData(data)) {
    throw new TypeError("Translation data is incomplete or invalid.");
  }

  return data;
}

export class I18nService {
  readonly #store: UserStateStore;
  readonly #dictionaries: TranslationData;

  constructor(
    store = new UserStateStore(),
    translationData: TranslationData = FALLBACK_TRANSLATIONS,
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

let defaultI18n = new I18nService();

export function initializeI18n(
  translationData: TranslationData,
  store = new UserStateStore(),
): I18nService {
  defaultI18n = new I18nService(store, translationData);
  return defaultI18n;
}

export async function loadAndInitializeI18n(
  url = "src/data/language.json",
  store = new UserStateStore(),
  fetcher?: TranslationFetcher,
): Promise<I18nService> {
  const data = await loadTranslationData(url, fetcher);
  return initializeI18n(data, store);
}

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
