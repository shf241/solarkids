import type { PlanetInfo } from './index.js';
import { getCachedImage, type RenderSkinType } from './assetLoader.js';

let skinType: RenderSkinType = 'cartoon'; // 当前皮肤类型

// 哈雷彗星专属素材
const halleyImg = new Image();
halleyImg.src = 'assets/svg/halley.svg';

// 写实背景素材
const bgRealistic = new Image();
bgRealistic.src = 'assets/skins/2k_stars_milky_way.jpg';
const bgCartoon = new Image();
bgCartoon.src =
  'assets/cartoon_skin/stars-milky-way-cartoon-small-stars.png';

export type SpaceViewOptions = {
  zoom?: number;
  rotation?: number;
  position?: Readonly<{ x: number; y: number }>;
};

/** 外部设置初始皮肤类型 */
export function setSkinType(type: RenderSkinType): void {
  skinType = type;
}

export function getSkinType(): RenderSkinType {
  return skinType;
}

export type PreviewCallbacks = {
  updatePanel: (info: PlanetInfo | null) => void;
  showToast: (message: string, duration?: number) => void;
  onPlanetSelected?: (info: PlanetInfo) => void;
  translate?: (key: string) => string;
};

export interface SolarSystemPreviewController {
  setActive(active: boolean): void;
  isActive(): boolean;
}

export type PlanetPreview = {
  id: string;
  name: string;
  nameCN: string;
  emoji: string;
  desc: string;
  /** 相对地球平均半径的真实半径比。 */
  radiusEarths?: number;
  /** 经过统一非线性映射后的 Canvas 显示半径。 */
  radius: number;
  distanceAU: number;
  angle: number;
  color: string;
  stats: { label: string; value: string }[];
};

export type PlanetRotationVisual = {
  /** 当前自转相位，单位弧度；用于驱动天体外侧的圆形箭头。 */
  rotation?: number;
  /** 自转轴相对画面竖直方向的倾角，单位弧度；用于确定箭头轨迹方向。 */
  axialTilt?: number;
  /** 自转方向：1 为顺向，-1 为逆向。 */
  rotationDirection?: 1 | -1;
};

export const PLANETS: PlanetPreview[] = [
  {
    id: 'mercury',
    name: 'Mercury',
    nameCN: '水星',
    emoji: '☿️',
    desc: '水星离太阳最近，表面有很多像月球一样的陨石坑。',
    radiusEarths: 0.383,
    radius: getPhysicalDisplayRadius(0.383),
    distanceAU: 0.387,
    angle: -0.4,
    color: '#b0b0b0',
    stats: [
      { label: '特点', value: '最近太阳' },
      { label: '颜色', value: '岩石灰' },
    ],
  },
  {
    id: 'venus',
    name: 'Venus',
    nameCN: '金星',
    emoji: '♀️',
    desc: '金星被厚厚的云层包住，是太阳系里非常明亮的行星。',
    radiusEarths: 0.949,
    radius: getPhysicalDisplayRadius(0.949),
    distanceAU: 0.723,
    angle: 0.8,
    color: '#e8cda0',
    stats: [
      { label: '特点', value: '云层厚' },
      { label: '颜色', value: '米黄色' },
    ],
  },
  {
    id: 'earth',
    name: 'Earth',
    nameCN: '地球',
    emoji: '🌍',
    desc: '地球有海洋、陆地和云，是我们生活的蓝色星球。',
    radiusEarths: 1,
    radius: getPhysicalDisplayRadius(1),
    distanceAU: 1,
    angle: 1.9,
    color: '#4da6e8',
    stats: [
      { label: '特点', value: '有生命' },
      { label: '卫星', value: '月球' },
    ],
  },
  {
    id: 'mars',
    name: 'Mars',
    nameCN: '火星',
    emoji: '♂️',
    desc: '火星因为表面有红色氧化铁，看起来像一颗红色星球。',
    radiusEarths: 0.532,
    radius: getPhysicalDisplayRadius(0.532),
    distanceAU: 1.524,
    angle: 2.8,
    color: '#d45a3a',
    stats: [
      { label: '特点', value: '红色星球' },
      { label: '地貌', value: '沙漠山谷' },
    ],
  },
  {
    id: 'jupiter',
    name: 'Jupiter',
    nameCN: '木星',
    emoji: '♃',
    desc: '木星是太阳系最大的行星，表面有条纹和著名的大红斑。',
    radiusEarths: 10.973,
    radius: getPhysicalDisplayRadius(10.973),
    distanceAU: 5.203,
    angle: -2.6,
    color: '#d4b896',
    stats: [
      { label: '特点', value: '最大行星' },
      { label: '标志', value: '大红斑' },
    ],
  },
  {
    id: 'saturn',
    name: 'Saturn',
    nameCN: '土星',
    emoji: '♄',
    desc: '土星有漂亮的光环，像戴着一顶宽宽的帽子。',
    radiusEarths: 9.14,
    radius: getPhysicalDisplayRadius(9.14),
    distanceAU: 9.537,
    angle: -1.5,
    color: '#e8d5a3',
    stats: [
      { label: '特点', value: '有光环' },
      { label: '颜色', value: '暖金色' },
    ],
  },
  {
    id: 'uranus',
    name: 'Uranus',
    nameCN: '天王星',
    emoji: '⛢',
    desc: '天王星是冰蓝色的行星，自转方向很特别，像躺着转。',
    radiusEarths: 3.981,
    radius: getPhysicalDisplayRadius(3.981),
    distanceAU: 19.191,
    angle: -0.15,
    color: '#7ec8e3',
    stats: [
      { label: '特点', value: '冰蓝色' },
      { label: '姿态', value: '像躺着转' },
    ],
  },
  {
    id: 'neptune',
    name: 'Neptune',
    nameCN: '海王星',
    emoji: '♆',
    desc: '海王星离太阳很远，颜色深蓝，风暴非常猛烈。',
    radiusEarths: 3.865,
    radius: getPhysicalDisplayRadius(3.865),
    distanceAU: 30.07,
    angle: 0.55,
    color: '#4b7ef7',
    stats: [
      { label: '特点', value: '深蓝色' },
      { label: '天气', value: '强风暴' },
    ],
  },
];

export const COMET: PlanetPreview = {
  id: 'comet',
  name: 'Comet',
  nameCN: '彗星',
  emoji: '☄️',
  desc: '彗星像带着尾巴的冰雪球，靠近太阳时会拖出明亮的彗尾。',
  radius: 8,
  distanceAU: 0,
  angle: 0,
  color: '#e9fbff',
  stats: [
    { label: '特点', value: '有彗尾' },
    { label: '组成', value: '冰和尘埃' },
  ],
};

/** 保留中心可读空间，再用统一幂函数压缩真实 AU 距离。 */
export const ORBIT_BASE = 42;
export const ORBIT_SPACING = 40.3;
export const ORBIT_DISTANCE_EXPONENT = 0.68;
export const MAX_ORBIT = getCompressedOrbit(30.07);

export function initSolarSystemPreview(
  canvas: HTMLCanvasElement,
  container: HTMLElement,
  callbacks: PreviewCallbacks
): SolarSystemPreviewController | null {
  const context = canvas.getContext('2d');
  if (!context) return null;
  const ctx: CanvasRenderingContext2D = context;
  let active = true;

  const stars = createStars(180);
  const state = {
    scale: 1,
    hoveredId: null as string | null,
    selectedId: 'earth',
  };

  function resize(): void {
    if (!active) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(container.clientWidth * dpr));
    canvas.height = Math.max(1, Math.floor(container.clientHeight * dpr));
    canvas.style.width = `${container.clientWidth}px`;
    canvas.style.height = `${container.clientHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  function draw(): void {
    if (!active) return;
    const width = container.clientWidth;
    const height = container.clientHeight;
    const center = { x: width * 0.48, y: height * 0.49 };
    const orbitTilt = width < 768 ? 0.58 : 0.46;
    const viewScale = state.scale * getResponsiveOrbitScale(width, height, orbitTilt);

    ctx.clearRect(0, 0, width, height);
    drawSpace(ctx, width, height, stars);
    drawOrbits(ctx, center, orbitTilt, viewScale);
    drawCometPath(ctx, center, orbitTilt, viewScale);
    drawSun(ctx, center, state.scale);
    drawComet(ctx, getCometPosition(center, orbitTilt, viewScale), COMET.radius * state.scale, {
      hovered: COMET.id === state.hoveredId,
      selected: COMET.id === state.selectedId,
    });

    for (const planet of PLANETS) {
      const pos = getPlanetPosition(planet, center, orbitTilt, viewScale);
      drawPlanet(ctx, planet, pos.x, pos.y, planet.radius * state.scale, {
        hovered: planet.id === state.hoveredId,
        selected: planet.id === state.selectedId,
      });
    }

    drawHint(
      ctx,
      width,
      height,
      callbacks.translate?.('hint.clickPlanet') ??
        '点击一颗行星，看看它的小秘密',
    );
  }

  function pickPlanet(event: PointerEvent): PlanetPreview | null {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const center = { x: container.clientWidth * 0.48, y: container.clientHeight * 0.49 };
    const orbitTilt = container.clientWidth < 768 ? 0.58 : 0.46;
    const viewScale = state.scale * getResponsiveOrbitScale(container.clientWidth, container.clientHeight, orbitTilt);

    const cometPosition = getCometPosition(center, orbitTilt, viewScale);
    if (Math.hypot(x - cometPosition.x, y - cometPosition.y) <= Math.max(20, COMET.radius * state.scale + 12)) {
      return COMET;
    }

    for (const planet of [...PLANETS].reverse()) {
      const pos = getPlanetPosition(planet, center, orbitTilt, viewScale);
      const hitRadius = Math.max(18, planet.radius * state.scale + 8);
      if (Math.hypot(x - pos.x, y - pos.y) <= hitRadius) {
        return planet;
      }
    }

    return null;
  }

  canvas.addEventListener('pointermove', event => {
    if (!active) return;
    const planet = pickPlanet(event);
    const next = planet?.id ?? null;
    if (next !== state.hoveredId) {
      state.hoveredId = next;
      canvas.style.cursor = planet ? 'pointer' : 'grab';
      draw();
    }
  });

  canvas.addEventListener('pointerleave', () => {
    if (!active) return;
    state.hoveredId = null;
    canvas.style.cursor = 'grab';
    draw();
  });

  canvas.addEventListener('click', event => {
    if (!active) return;
    const planet = pickPlanet(event);
    if (!planet) return;
    state.selectedId = planet.id;
    const info = toPlanetInfo(planet);
    callbacks.updatePanel(info);
    if (info && callbacks.onPlanetSelected) {
      callbacks.onPlanetSelected(info);
    } else {
      callbacks.showToast(`你发现了${planet.nameCN}`);
    }
    draw();
  });

  document.addEventListener('solarkids:zoom', event => {
    if (!active) return;
    const delta = (event as CustomEvent<{ delta: number }>).detail?.delta ?? 1;
    state.scale = clamp(state.scale * delta, 0.72, 1.42);
    draw();
  });

  document.addEventListener('solarkids:resetView', () => {
    if (!active) return;
    state.scale = 1;
    state.selectedId = 'earth';
    state.hoveredId = null;
    callbacks.updatePanel(toPlanetInfo(PLANETS.find(p => p.id === 'earth') ?? null));
    draw();
  });

  // 监听换肤事件
  document.addEventListener('solarkids:skinChange', (event) => {
    if (!active) return;
    const detail = (event as CustomEvent<{
      skinId: string;
      skinConfig: { type: RenderSkinType };
    }>).detail;
    if (detail?.skinConfig?.type) {
      skinType = detail.skinConfig.type;
      draw();
    }
  });

  window.addEventListener('resize', resize);
  callbacks.updatePanel(toPlanetInfo(PLANETS.find(p => p.id === 'earth') ?? null));
  resize();

  return {
    setActive(nextActive: boolean): void {
      if (active === nextActive) return;
      active = nextActive;
      state.hoveredId = null;
      canvas.style.cursor = active ? 'grab' : 'default';
      if (active) {
        state.scale = 1;
        state.selectedId = 'earth';
        callbacks.updatePanel(
          toPlanetInfo(PLANETS.find(planet => planet.id === 'earth') ?? null)
        );
        resize();
      }
    },
    isActive(): boolean {
      return active;
    },
  };
}

function createStars(count: number): { x: number; y: number; r: number; alpha: number }[] {
  return Array.from({ length: count }, (_, index) => ({
    x: (Math.sin(index * 43.17) * 0.5 + 0.5) % 1,
    y: (Math.cos(index * 31.91) * 0.5 + 0.5) % 1,
    r: 0.6 + ((index * 17) % 9) / 10,
    alpha: 0.22 + ((index * 29) % 55) / 100,
  }));
}

export function drawSpace(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  stars: { x: number; y: number; r: number; alpha: number }[],
  view: Readonly<SpaceViewOptions> = {}
): void {
  const background =
    skinType === 'cartoon' ? bgCartoon : bgRealistic;
  if (background.complete && background.naturalWidth > 0) {
    ctx.fillStyle = '#050815';
    ctx.fillRect(0, 0, width, height);

    const imgRatio =
      background.naturalWidth / background.naturalHeight;
    const canvasRatio = width / height;
    let dw: number, dh: number;
    if (imgRatio > canvasRatio) {
      dh = height;
      dw = height * imgRatio;
    } else {
      dw = width;
      dh = width / imgRatio;
    }

    const zoom = Math.max(0.01, view.zoom ?? 1);
    const rotation = view.rotation ?? 0;
    const position = view.position ?? { x: 0, y: 0 };
    const tileOriginX = Math.floor(position.x / dw) * dw;
    const tileOriginY = Math.floor(position.y / dh) * dh;

    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(zoom, zoom);
    ctx.rotate(rotation);
    ctx.translate(-position.x, -position.y);
    for (let row = -2; row <= 2; row += 1) {
      for (let column = -2; column <= 2; column += 1) {
        ctx.drawImage(
          background,
          tileOriginX + column * dw - dw / 2,
          tileOriginY + row * dh - dh / 2,
          dw,
          dh
        );
      }
    }
    ctx.restore();
    return;
  }

  // 卡通模式：深空渐变 + 星星
  const gradient = ctx.createRadialGradient(width * 0.48, height * 0.5, 80, width * 0.5, height * 0.5, width);
  gradient.addColorStop(0, '#152056');
  gradient.addColorStop(0.55, '#0d1536');
  gradient.addColorStop(1, '#050815');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  for (const star of stars) {
    ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha})`;
    ctx.beginPath();
    ctx.arc(star.x * width, star.y * height, star.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawOrbits(
  ctx: CanvasRenderingContext2D,
  center: { x: number; y: number },
  tilt: number,
  scale: number
): void {
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 0.7;
  ctx.setLineDash([4, 7]);

  for (const planet of PLANETS) {
    ctx.beginPath();
    const orbit = getCompressedOrbit(planet.distanceAU);
    ctx.ellipse(center.x, center.y, orbit * scale, orbit * tilt * scale, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

export function drawCometPath(
  ctx: CanvasRenderingContext2D,
  center: { x: number; y: number },
  tilt: number,
  scale: number
): void {
  ctx.save();
  ctx.strokeStyle = 'rgba(91, 192, 235, 0.22)';
  ctx.lineWidth = 1.4;
  ctx.setLineDash([8, 10]);
  ctx.beginPath();
  ctx.ellipse(center.x + 28 * scale, center.y - 10 * scale, 290 * scale, 82 * tilt * scale, -0.58, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function drawSun(
  ctx: CanvasRenderingContext2D,
  center: { x: number; y: number },
  scale: number,
  rotation?: number,
  axialTilt = 0,
  rotationDirection: 1 | -1 = 1
): void {
  const r = 34 * scale;
  const sunImg = getCachedImage('sun', skinType);
  const hasTexture = sunImg && sunImg.complete && sunImg.naturalWidth > 0;

  // 外发光（无论有没有贴图都有）
  const glow = ctx.createRadialGradient(center.x, center.y, r * 0.1, center.x, center.y, r * 2.2);
  glow.addColorStop(0, 'rgba(247, 201, 72, 0.95)');
  glow.addColorStop(0.32, 'rgba(240, 140, 42, 0.55)');
  glow.addColorStop(1, 'rgba(240, 140, 42, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(center.x, center.y, r * 2.3, 0, Math.PI * 2);
  ctx.fill();

  if (hasTexture) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(center.x, center.y, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(sunImg, center.x - r, center.y - r, r * 2, r * 2);
    ctx.restore();
  } else {
    // 降级：渐变代码画太阳
    const body = ctx.createRadialGradient(center.x - r * 0.35, center.y - r * 0.35, r * 0.1, center.x, center.y, r);
    body.addColorStop(0, '#fff3a6');
    body.addColorStop(0.55, '#f7c948');
    body.addColorStop(1, '#f08c2a');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(center.x, center.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  if (rotation !== undefined) {
    drawRotationArrow(
      ctx,
      center.x,
      center.y,
      r,
      rotation,
      axialTilt,
      rotationDirection
    );
  }
}

export function drawPlanet(
  ctx: CanvasRenderingContext2D,
  planet: PlanetPreview,
  x: number,
  y: number,
  r: number,
  drawState: { hovered: boolean; selected: boolean },
  rotationVisual: PlanetRotationVisual = {}
): void {
  // 选中/悬停高亮圈
  if (drawState.hovered || drawState.selected) {
    ctx.strokeStyle = drawState.selected ? '#f7c948' : '#5bc0eb';
    ctx.lineWidth = drawState.selected ? 3 : 2;
    ctx.beginPath();
    ctx.arc(x, y, r + 8, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 尝试用贴图素材
  const img = getCachedImage(planet.id, skinType);
  const hasTexture = img && img.complete && img.naturalWidth > 0;
  const rotation = rotationVisual.rotation ?? 0;
  const axialTilt = rotationVisual.axialTilt ?? 0;
  const rotationDirection = rotationVisual.rotationDirection ?? 1;

  if (hasTexture) {
    ctx.save();
    if (planet.id === 'saturn') {
      ctx.drawImage(img, x - r * 1.8, y - r * 1.3, r * 3.6, r * 2.6);
    } else {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, x - r, y - r, r * 2, r * 2);
    }
    ctx.restore();
  } else {
    // ⚠️ 降级：无素材时用代码绘制（含手绘特征和光环）
    if (planet.id === 'saturn') {
      drawSaturnRingBack(ctx, x, y, r, axialTilt);
    }
    const body = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
    body.addColorStop(0, '#ffffff');
    body.addColorStop(0.2, planet.color);
    body.addColorStop(1, shade(planet.color, -38));
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    drawPlanetFeatures(ctx, planet, x, y, r);
    if (planet.id === 'saturn') {
      drawSaturnRingFront(ctx, x, y, r, axialTilt);
    }
  }

  if (rotationVisual.rotation !== undefined) {
    drawRotationArrow(
      ctx,
      x,
      y,
      r,
      rotation,
      axialTilt,
      rotationDirection,
      planet.id === 'saturn' ? 1.55 : 1.28
    );
  }
}

function drawRotationArrow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  rotation: number,
  axialTilt: number,
  direction: 1 | -1,
  arrowScale = 1.28
): void {
  const axisLineAngle = normalizeAxisLineAngle(axialTilt);
  const orbitRadiusX = r * arrowScale;
  const orbitRadiusY = Math.max(3, r * 0.34);
  const phase = normalizeTurn(rotation);
  const arrowX = Math.cos(phase) * orbitRadiusX;
  const arrowY = Math.sin(phase) * orbitRadiusY;
  const tangentX = -Math.sin(phase) * orbitRadiusX * direction;
  const tangentY = Math.cos(phase) * orbitRadiusY * direction;
  const arrowAngle = Math.atan2(tangentY, tangentX);
  const arrowSize = Math.max(3, r * 0.22);

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(axisLineAngle);
  ctx.strokeStyle = 'rgba(247, 201, 72, 0.48)';
  ctx.lineWidth = Math.max(1.2, r * 0.09);
  ctx.beginPath();
  ctx.ellipse(
    0,
    0,
    orbitRadiusX,
    orbitRadiusY,
    0,
    0,
    Math.PI * 2
  );
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255, 221, 105, 0.96)';
  ctx.lineWidth = Math.max(2, r * 0.13);
  const trailLength = direction * 1.15;
  ctx.beginPath();
  ctx.ellipse(
    0,
    0,
    orbitRadiusX,
    orbitRadiusY,
    0,
    phase - trailLength,
    phase,
    direction < 0
  );
  ctx.stroke();

  ctx.translate(arrowX, arrowY);
  ctx.rotate(arrowAngle);
  ctx.beginPath();
  ctx.moveTo(arrowSize, 0);
  ctx.lineTo(-arrowSize * 0.72, -arrowSize * 0.58);
  ctx.lineTo(-arrowSize * 0.72, arrowSize * 0.58);
  ctx.closePath();
  ctx.fillStyle = '#ffe47a';
  ctx.shadowColor = 'rgba(247, 201, 72, 0.85)';
  ctx.shadowBlur = Math.max(3, r * 0.25);
  ctx.fill();
  ctx.restore();
}

function normalizeAxisLineAngle(angle: number): number {
  const halfTurn = Math.PI;
  return (
    ((angle + Math.PI / 2) % halfTurn + halfTurn) % halfTurn -
    Math.PI / 2
  );
}

function normalizeTurn(angle: number): number {
  const fullTurn = Math.PI * 2;
  return ((angle % fullTurn) + fullTurn) % fullTurn;
}

export function drawComet(
  ctx: CanvasRenderingContext2D,
  position: { x: number; y: number },
  r: number,
  drawState: { hovered: boolean; selected: boolean }
): void {
  const { x, y } = position;
  const hasHalley = halleyImg.complete && halleyImg.naturalWidth > 0;

  // 彗尾（贴图和降级都会画）
  const tail = ctx.createLinearGradient(x + r * 0.2, y, x - r * 8, y + r * 2.6);
  tail.addColorStop(0, 'rgba(233, 251, 255, 0.85)');
  tail.addColorStop(0.45, 'rgba(91, 192, 235, 0.28)');
  tail.addColorStop(1, 'rgba(91, 192, 235, 0)');
  ctx.fillStyle = tail;
  ctx.beginPath();
  ctx.moveTo(x + r * 0.35, y - r * 0.55);
  ctx.quadraticCurveTo(x - r * 4.2, y - r * 0.9, x - r * 8, y + r * 1.8);
  ctx.quadraticCurveTo(x - r * 3.5, y + r * 1.25, x + r * 0.35, y + r * 0.55);
  ctx.closePath();
  ctx.fill();

  if (hasHalley) {
    // ✅ SVG 彗星本体 + 手绘彗尾
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.3);
    ctx.drawImage(halleyImg, -r * 0.8, -r * 0.6, r * 1.6, r * 1.2);
    ctx.restore();
  } else {
    // ⚠️ 降级：代码绘制彗核
    const nucleus = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, 1, x, y, r);
    nucleus.addColorStop(0, '#ffffff');
    nucleus.addColorStop(0.45, '#e9fbff');
    nucleus.addColorStop(1, '#5bc0eb');
    ctx.fillStyle = nucleus;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // 选中/悬停高亮
  if (drawState.hovered || drawState.selected) {
    ctx.strokeStyle = drawState.selected ? '#f7c948' : '#5bc0eb';
    ctx.lineWidth = drawState.selected ? 3 : 2;
    ctx.beginPath();
    ctx.arc(x, y, r + 8, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawPlanetFeatures(ctx: CanvasRenderingContext2D, planet: PlanetPreview, x: number, y: number, r: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();

  switch (planet.id) {
    case 'mercury':
      drawCraters(ctx, x, y, r);
      break;
    case 'venus':
      drawCloudBands(ctx, x, y, r, 'rgba(255, 244, 204, 0.55)');
      break;
    case 'earth':
      drawEarth(ctx, x, y, r);
      break;
    case 'mars':
      drawMarsMarks(ctx, x, y, r);
      break;
    case 'jupiter':
      drawGasBands(ctx, x, y, r, '#b98a5a', '#f1d5a6');
      drawStorm(ctx, x + r * 0.38, y + r * 0.16, r * 0.22);
      break;
    case 'uranus':
      drawCloudBands(ctx, x, y, r, 'rgba(207, 250, 255, 0.35)');
      break;
    case 'neptune':
      drawStorm(ctx, x + r * 0.25, y - r * 0.2, r * 0.17);
      drawCloudBands(ctx, x, y, r, 'rgba(196, 221, 255, 0.28)');
      break;
    default:
      break;
  }

  ctx.restore();
}

export function drawSaturnRingBack(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  axialTilt = 0.466
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-axialTilt);
  ctx.strokeStyle = 'rgba(248, 224, 166, 0.8)';
  ctx.lineWidth = Math.max(3, r * 0.18);
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.85, r * 0.48, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.36)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 2.08, r * 0.58, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function drawSaturnRingFront(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  axialTilt = 0.466
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-axialTilt);
  ctx.strokeStyle = 'rgba(255, 224, 154, 0.92)';
  ctx.lineWidth = Math.max(3, r * 0.2);
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.85, r * 0.48, 0, 0, Math.PI);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 2.08, r * 0.58, 0, 0, Math.PI);
  ctx.stroke();
  ctx.restore();
}

function drawCraters(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.fillStyle = 'rgba(74, 80, 96, 0.36)';
  for (const [dx, dy, size] of [[-0.25, -0.2, 0.16], [0.25, -0.05, 0.12], [-0.05, 0.28, 0.1]]) {
    ctx.beginPath();
    ctx.arc(x + r * dx, y + r * dy, r * size, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCloudBands(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, r * 0.14);
  for (const offset of [-0.35, 0, 0.34]) {
    ctx.beginPath();
    ctx.ellipse(x, y + r * offset, r * 0.9, r * 0.16, -0.18, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawEarth(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.fillStyle = '#66c26f';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.25, y - r * 0.1, r * 0.24, r * 0.38, 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + r * 0.25, y + r * 0.18, r * 0.3, r * 0.2, -0.25, 0, Math.PI * 2);
  ctx.fill();
  drawCloudBands(ctx, x, y, r, 'rgba(255, 255, 255, 0.55)');
}

function drawMarsMarks(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.fillStyle = 'rgba(104, 45, 34, 0.42)';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.18, y - r * 0.2, r * 0.3, r * 0.12, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + r * 0.2, y + r * 0.16, r * 0.25, r * 0.1, -0.4, 0, Math.PI * 2);
  ctx.fill();
}

function drawGasBands(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, dark: string, light: string): void {
  for (let i = -3; i <= 3; i += 1) {
    ctx.fillStyle = i % 2 === 0 ? light : dark;
    ctx.fillRect(x - r, y + i * r * 0.24, r * 2, r * 0.15);
  }
}

function drawStorm(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.fillStyle = 'rgba(214, 82, 60, 0.85)';
  ctx.beginPath();
  ctx.ellipse(x, y, r * 1.3, r * 0.72, -0.2, 0, Math.PI * 2);
  ctx.fill();
}

export function drawHint(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  text = '点击一颗行星，看看它的小秘密',
): void {
  ctx.fillStyle = 'rgba(196, 208, 232, 0.78)';
  ctx.font = '14px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, width * 0.48, Math.max(28, height - 28));
}

export function getPlanetPosition(
  planet: PlanetPreview,
  center: { x: number; y: number },
  tilt: number,
  scale: number,
  angle = planet.angle
): { x: number; y: number } {
  const orbit = getCompressedOrbit(planet.distanceAU);
  return {
    x: center.x + Math.cos(angle) * orbit * scale,
    y: center.y + Math.sin(angle) * orbit * tilt * scale,
  };
}

export function getCompressedOrbit(distanceAU: number): number {
  return (
    ORBIT_BASE +
    Math.pow(Math.max(0, distanceAU), ORBIT_DISTANCE_EXPONENT) *
      ORBIT_SPACING
  );
}

export function getResponsiveOrbitScale(width: number, height: number, tilt: number): number {
  const horizontalFit = (width * 0.44) / MAX_ORBIT;
  const verticalFit = (height * 0.72) / (MAX_ORBIT * tilt);
  return Math.min(1, Math.max(0.36, Math.min(horizontalFit, verticalFit)));
}

/**
 * 将真实地球半径比映射为可读的 Canvas 半径。
 * 指数小于 1 是为了让类地行星仍可点击，同时保留巨行星的明显体积优势。
 */
export function getPhysicalDisplayRadius(radiusEarths: number): number {
  return Math.max(3.5, 6 * Math.pow(Math.max(0, radiusEarths), 0.6));
}

function getCometPosition(
  center: { x: number; y: number },
  tilt: number,
  scale: number
): { x: number; y: number } {
  const angle = -2.15;
  const orbitX = 290 * scale;
  const orbitY = 82 * tilt * scale;
  const rotation = -0.58;
  const rawX = Math.cos(angle) * orbitX;
  const rawY = Math.sin(angle) * orbitY;
  return {
    x: center.x + 28 * scale + rawX * Math.cos(rotation) - rawY * Math.sin(rotation),
    y: center.y - 10 * scale + rawX * Math.sin(rotation) + rawY * Math.cos(rotation),
  };
}

function toPlanetInfo(planet: PlanetPreview | null): PlanetInfo | null {
  if (!planet) return null;
  return {
    id: planet.id,
    name: planet.name,
    nameCN: planet.nameCN,
    emoji: planet.emoji,
    desc: planet.desc,
    stats: planet.stats,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function shade(hex: string, amount: number): string {
  const normalized = hex.replace('#', '');
  const number = Number.parseInt(normalized, 16);
  const r = clamp((number >> 16) + amount, 0, 255);
  const g = clamp(((number >> 8) & 0xff) + amount, 0, 255);
  const b = clamp((number & 0xff) + amount, 0, 255);
  return `rgb(${r}, ${g}, ${b})`;
}
