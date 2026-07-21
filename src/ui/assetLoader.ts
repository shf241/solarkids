/**
 * 素材加载器
 * - 优先加载真实素材文件
 * - 文件不存在时自动生成代码占位图（Canvas → DataURL）
 * - 素材缓存，换肤时自动清空
 */

// ---- 类型 ----

export type PlanetId =
  | 'sun'
  | 'mercury'
  | 'venus'
  | 'earth'
  | 'moon'
  | 'mars'
  | 'jupiter'
  | 'saturn'
  | 'uranus'
  | 'neptune';

export type SkinType = 'svg' | 'png';

export interface SkinConfig {
  name: string;
  type: SkinType;
  assets: Record<PlanetId, string>;
}

export interface SkinsData {
  activeSkin: string;
  skins: Record<string, SkinConfig>;
  planetColors: Record<PlanetId, string>;
}

// ---- 缓存 & 状态 ----

const imageCache = new Map<string, HTMLImageElement>();
let skinsConfig: SkinsData | null = null;

// ---- 加载配置 ----

/** 加载皮肤配置文件 */
export async function loadSkinsConfig(): Promise<SkinsData> {
  if (skinsConfig) return skinsConfig;
  const res = await fetch('src/data/skins.json');
  skinsConfig = await res.json();
  return skinsConfig!;
}

/** 获取当前激活的皮肤配置 */
export function getActiveSkin(config: SkinsData): SkinConfig {
  return config.skins[config.activeSkin];
}

/** 列出所有可用皮肤 */
export function getSkinList(config: SkinsData): { id: string; name: string }[] {
  return Object.entries(config.skins).map(([id, s]) => ({ id, name: s.name }));
}

// ---- 素材加载（自动降级为占位图） ----

/** 加载一个行星素材，失败则返回占位图 */
export async function loadPlanetAsset(
  planetId: PlanetId,
  skinConfig: SkinConfig
): Promise<HTMLImageElement> {
  const path = skinConfig.assets[planetId];
  const cacheKey = `${planetId}_${skinConfig.type}`;

  if (imageCache.has(cacheKey)) {
    return imageCache.get(cacheKey)!;
  }

  const img = new Image();
  img.crossOrigin = 'anonymous';

  const loaded = await tryLoadImage(img, path);
  if (loaded) {
    imageCache.set(cacheKey, img);
    return img;
  }

  // 降级：生成占位图
  console.warn(`⚠️ 素材未找到: ${path}，使用占位图`);
  const color = skinsConfig?.planetColors[planetId] ?? '#888888';
  const placeholderUrl = generatePlaceholderSVG(planetId, color, 128);
  img.src = placeholderUrl;
  await img.decode().catch(() => {});
  imageCache.set(cacheKey, img);
  return img;
}

/** 预加载当前皮肤的全部素材 */
export async function preloadAllAssets(config: SkinsData): Promise<void> {
  const skin = getActiveSkin(config);
  const ids = Object.keys(skin.assets) as PlanetId[];
  await Promise.all(ids.map(id => loadPlanetAsset(id, skin)));
}

/** 清空缓存（换肤时调用） */
export function clearAssetCache(): void {
  imageCache.clear();
}

// ---- 内部工具 ----

function tryLoadImage(img: HTMLImageElement, src: string): Promise<boolean> {
  return new Promise(resolve => {
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = src;
  });
}

/** 用 SVG DataURL 生成行星占位图 */
function generatePlaceholderSVG(
  id: PlanetId,
  color: string,
  size: number
): string {
  const half = size / 2;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg"
    width="${size}" height="${size}"
    viewBox="0 0 ${size} ${size}">`;

  // 行星本体（径向渐变模拟球体立体感）
  svg += `<defs>
    <radialGradient id="g_${id}" cx="35%" cy="35%">
      <stop offset="0%" stop-color="white" stop-opacity="0.4"/>
      <stop offset="40%" stop-color="${color}" stop-opacity="1"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0.6"/>
    </radialGradient>
  </defs>`;
  svg += `<circle cx="${half}" cy="${half}" r="${half - 2}" fill="url(#g_${id})"/>`;

  // 土星光环
  if (id === 'saturn') {
    svg += `<ellipse cx="${half}" cy="${half}" rx="${half + 16}" ry="10"
      fill="none" stroke="#d4b896" stroke-width="4" opacity="0.7"
      transform="rotate(-20, ${half}, ${half})"/>`;
  }

  // 地球特殊标记（简单大陆示意）
  if (id === 'earth') {
    svg += `<ellipse cx="${half - 8}" cy="${half - 6}" rx="10" ry="12"
      fill="#4caf50" opacity="0.5"/>
      <ellipse cx="${half + 10}" cy="${half + 4}" rx="6" ry="8"
      fill="#4caf50" opacity="0.4"/>`;
  }

  // 太阳光晕
  if (id === 'sun') {
    svg += `<circle cx="${half}" cy="${half}" r="${half + 6}"
      fill="none" stroke="${color}" stroke-width="3" opacity="0.3"/>`;
    svg += `<circle cx="${half}" cy="${half}" r="${half + 14}"
      fill="none" stroke="${color}" stroke-width="1" opacity="0.12"/>`;
  }

  svg += '</svg>';
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}
