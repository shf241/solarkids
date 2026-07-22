import type { PlanetInfo } from './index.js';
import { getCachedImage, type SkinType } from './assetLoader.js';

let skinType: SkinType = 'svg'; // 当前皮肤类型

/** 外部设置初始皮肤类型 */
export function setSkinType(type: SkinType): void {
  skinType = type;
}

type PreviewCallbacks = {
  updatePanel: (info: PlanetInfo | null) => void;
  showToast: (message: string, duration?: number) => void;
};

type PlanetPreview = {
  id: string;
  name: string;
  nameCN: string;
  emoji: string;
  desc: string;
  radius: number;
  distanceAU: number;
  angle: number;
  color: string;
  stats: { label: string; value: string }[];
};

const PLANETS: PlanetPreview[] = [
  {
    id: 'mercury',
    name: 'Mercury',
    nameCN: '水星',
    emoji: '☿️',
    desc: '水星离太阳最近，表面有很多像月球一样的陨石坑。',
    radius: 8,
    distanceAU: 0.39,
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
    radius: 12,
    distanceAU: 0.72,
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
    radius: 13,
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
    radius: 11,
    distanceAU: 1.52,
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
    radius: 24,
    distanceAU: 5.2,
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
    radius: 22,
    distanceAU: 9.58,
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
    radius: 17,
    distanceAU: 19.2,
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
    radius: 17,
    distanceAU: 30.05,
    angle: 0.55,
    color: '#4b7ef7',
    stats: [
      { label: '特点', value: '深蓝色' },
      { label: '天气', value: '强风暴' },
    ],
  },
  {
    id: 'pluto',
    name: 'Pluto',
    nameCN: '冥王星',
    emoji: '♇',
    desc: '冥王星现在被称为矮行星，它很小很远，是太阳系边缘的有趣小伙伴。',
    radius: 7,
    distanceAU: 39.5,
    angle: -0.95,
    color: '#c7a98b',
    stats: [
      { label: '身份', value: '矮行星' },
      { label: '位置', value: '很遥远' },
    ],
  },
];

const COMET: PlanetPreview = {
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

const ORBIT_BASE = 58;
const ORBIT_SPACING = 76;
const MAX_ORBIT = getCompressedOrbit(39.5);

export function initSolarSystemPreview(
  canvas: HTMLCanvasElement,
  container: HTMLElement,
  callbacks: PreviewCallbacks
): void {
  const context = canvas.getContext('2d');
  if (!context) return;
  const ctx: CanvasRenderingContext2D = context;

  const stars = createStars(180);
  const state = {
    scale: 1,
    hoveredId: null as string | null,
    selectedId: 'earth',
  };

  function resize(): void {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(container.clientWidth * dpr));
    canvas.height = Math.max(1, Math.floor(container.clientHeight * dpr));
    canvas.style.width = `${container.clientWidth}px`;
    canvas.style.height = `${container.clientHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  function draw(): void {
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

    drawHint(ctx, width, height);
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
    const planet = pickPlanet(event);
    const next = planet?.id ?? null;
    if (next !== state.hoveredId) {
      state.hoveredId = next;
      canvas.style.cursor = planet ? 'pointer' : 'grab';
      draw();
    }
  });

  canvas.addEventListener('pointerleave', () => {
    state.hoveredId = null;
    canvas.style.cursor = 'grab';
    draw();
  });

  canvas.addEventListener('click', event => {
    const planet = pickPlanet(event);
    if (!planet) return;
    state.selectedId = planet.id;
    callbacks.updatePanel(toPlanetInfo(planet));
    callbacks.showToast(`你发现了${planet.nameCN}`);
    draw();
  });

  document.addEventListener('solarkids:zoom', event => {
    const delta = (event as CustomEvent<{ delta: number }>).detail?.delta ?? 1;
    state.scale = clamp(state.scale * delta, 0.72, 1.42);
    draw();
  });

  document.addEventListener('solarkids:resetView', () => {
    state.scale = 1;
    state.selectedId = 'earth';
    state.hoveredId = null;
    callbacks.updatePanel(toPlanetInfo(PLANETS.find(p => p.id === 'earth') ?? null));
    draw();
  });

  // 监听换肤事件
  document.addEventListener('solarkids:skinChange', (event) => {
    const detail = (event as CustomEvent<{ skinId: string; skinConfig: { type: SkinType } }>).detail;
    if (detail?.skinConfig?.type) {
      skinType = detail.skinConfig.type;
      draw();
    }
  });

  window.addEventListener('resize', resize);
  callbacks.updatePanel(toPlanetInfo(PLANETS.find(p => p.id === 'earth') ?? null));
  resize();
}

function createStars(count: number): { x: number; y: number; r: number; alpha: number }[] {
  return Array.from({ length: count }, (_, index) => ({
    x: (Math.sin(index * 43.17) * 0.5 + 0.5) % 1,
    y: (Math.cos(index * 31.91) * 0.5 + 0.5) % 1,
    r: 0.6 + ((index * 17) % 9) / 10,
    alpha: 0.22 + ((index * 29) % 55) / 100,
  }));
}

function drawSpace(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  stars: { x: number; y: number; r: number; alpha: number }[]
): void {
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

function drawOrbits(
  ctx: CanvasRenderingContext2D,
  center: { x: number; y: number },
  tilt: number,
  scale: number
): void {
  ctx.save();
  ctx.strokeStyle = 'rgba(196, 208, 232, 0.16)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 8]);

  for (const planet of PLANETS) {
    ctx.beginPath();
    const orbit = getCompressedOrbit(planet.distanceAU);
    ctx.ellipse(center.x, center.y, orbit * scale, orbit * tilt * scale, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawCometPath(
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

function drawSun(ctx: CanvasRenderingContext2D, center: { x: number; y: number }, scale: number): void {
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
    // 使用太阳贴图
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
}

function drawPlanet(
  ctx: CanvasRenderingContext2D,
  planet: PlanetPreview,
  x: number,
  y: number,
  r: number,
  drawState: { hovered: boolean; selected: boolean }
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

  if (hasTexture) {
    // ✅ 使用素材贴图（纯净，不叠加代码纹理和光环）
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, x - r, y - r, r * 2, r * 2);
    ctx.restore();
  } else {
    // ⚠️ 降级：无素材时用代码绘制（含手绘特征和光环）
    if (planet.id === 'saturn') {
      drawSaturnRing(ctx, x, y, r);
    }
    const body = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
    body.addColorStop(0, '#ffffff');
    body.addColorStop(0.2, planet.color);
    body.addColorStop(1, shade(planet.color, -38));
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    drawPlanetFeatures(ctx, planet, x, y, r); // 只有降级时才画手绘特征
  }
  // 切换皮肤调试
  if (planet.id === 'earth') {
    console.log(`🌍 skinType=${skinType}, hasTexture=${hasTexture}`);
  }
}

function drawComet(
  ctx: CanvasRenderingContext2D,
  position: { x: number; y: number },
  r: number,
  state: { hovered: boolean; selected: boolean }
): void {
  const { x, y } = position;

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

  if (state.hovered || state.selected) {
    ctx.strokeStyle = state.selected ? '#f7c948' : '#5bc0eb';
    ctx.lineWidth = state.selected ? 3 : 2;
    ctx.beginPath();
    ctx.arc(x, y, r + 8, 0, Math.PI * 2);
    ctx.stroke();
  }

  const nucleus = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, 1, x, y, r);
  nucleus.addColorStop(0, '#ffffff');
  nucleus.addColorStop(0.45, '#e9fbff');
  nucleus.addColorStop(1, '#5bc0eb');
  ctx.fillStyle = nucleus;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
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
    case 'pluto':
      drawCraters(ctx, x, y, r);
      drawPlutoHeart(ctx, x, y, r);
      break;
    default:
      break;
  }

  ctx.restore();
}

function drawSaturnRing(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.save();
  ctx.strokeStyle = 'rgba(248, 224, 166, 0.8)';
  ctx.lineWidth = Math.max(3, r * 0.18);
  ctx.beginPath();
  ctx.ellipse(x, y, r * 1.75, r * 0.48, -0.28, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.36)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(x, y, r * 2.05, r * 0.58, -0.28, 0, Math.PI * 2);
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

function drawPlutoHeart(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.fillStyle = 'rgba(255, 232, 205, 0.7)';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.12, y - r * 0.05, r * 0.22, r * 0.18, -0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + r * 0.12, y - r * 0.05, r * 0.22, r * 0.18, 0.45, 0, Math.PI * 2);
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

function drawHint(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.fillStyle = 'rgba(196, 208, 232, 0.78)';
  ctx.font = '14px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('点击一颗行星，看看它的小秘密', width * 0.48, Math.max(28, height - 28));
}

function getPlanetPosition(
  planet: PlanetPreview,
  center: { x: number; y: number },
  tilt: number,
  scale: number
): { x: number; y: number } {
  const orbit = getCompressedOrbit(planet.distanceAU);
  return {
    x: center.x + Math.cos(planet.angle) * orbit * scale,
    y: center.y + Math.sin(planet.angle) * orbit * tilt * scale,
  };
}

function getCompressedOrbit(distanceAU: number): number {
  return ORBIT_BASE + Math.sqrt(distanceAU) * ORBIT_SPACING;
}

function getResponsiveOrbitScale(width: number, height: number, tilt: number): number {
  const horizontalFit = (width * 0.44) / MAX_ORBIT;
  const verticalFit = (height * 0.72) / (MAX_ORBIT * tilt);
  return Math.min(1, Math.max(0.58, Math.min(horizontalFit, verticalFit)));
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
