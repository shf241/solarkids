import type { PlanetInfo } from './index.js';

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
  orbit: number;
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
    orbit: 62,
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
    orbit: 88,
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
    orbit: 118,
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
    orbit: 150,
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
    orbit: 200,
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
    orbit: 248,
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
    orbit: 292,
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
    orbit: 332,
    angle: 0.55,
    color: '#4b7ef7',
    stats: [
      { label: '特点', value: '深蓝色' },
      { label: '天气', value: '强风暴' },
    ],
  },
];

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

    ctx.clearRect(0, 0, width, height);
    drawSpace(ctx, width, height, stars);
    drawOrbits(ctx, center, orbitTilt, state.scale);
    drawSun(ctx, center, state.scale);

    for (const planet of PLANETS) {
      const pos = getPlanetPosition(planet, center, orbitTilt, state.scale);
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

    for (const planet of [...PLANETS].reverse()) {
      const pos = getPlanetPosition(planet, center, orbitTilt, state.scale);
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
    ctx.ellipse(center.x, center.y, planet.orbit * scale, planet.orbit * tilt * scale, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawSun(ctx: CanvasRenderingContext2D, center: { x: number; y: number }, scale: number): void {
  const r = 34 * scale;
  const glow = ctx.createRadialGradient(center.x, center.y, r * 0.1, center.x, center.y, r * 2.2);
  glow.addColorStop(0, 'rgba(247, 201, 72, 0.95)');
  glow.addColorStop(0.32, 'rgba(240, 140, 42, 0.55)');
  glow.addColorStop(1, 'rgba(240, 140, 42, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(center.x, center.y, r * 2.3, 0, Math.PI * 2);
  ctx.fill();

  const body = ctx.createRadialGradient(center.x - r * 0.35, center.y - r * 0.35, r * 0.1, center.x, center.y, r);
  body.addColorStop(0, '#fff3a6');
  body.addColorStop(0.55, '#f7c948');
  body.addColorStop(1, '#f08c2a');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(center.x, center.y, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawPlanet(
  ctx: CanvasRenderingContext2D,
  planet: PlanetPreview,
  x: number,
  y: number,
  r: number,
  state: { hovered: boolean; selected: boolean }
): void {
  if (state.hovered || state.selected) {
    ctx.strokeStyle = state.selected ? '#f7c948' : '#5bc0eb';
    ctx.lineWidth = state.selected ? 3 : 2;
    ctx.beginPath();
    ctx.arc(x, y, r + 8, 0, Math.PI * 2);
    ctx.stroke();
  }

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

  drawPlanetFeatures(ctx, planet, x, y, r);
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
  return {
    x: center.x + Math.cos(planet.angle) * planet.orbit * scale,
    y: center.y + Math.sin(planet.angle) * planet.orbit * tilt * scale,
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
