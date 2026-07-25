import type {
  CanvasRuntimeContext,
  CanvasScene,
  Point2D,
} from '../types.js';
import type { SkinType } from '../../ui/assetLoader.js';
import {
  createToolbarButtons,
  drawBodyLabel,
  drawInfoChip,
  drawSceneHeader,
  drawSkinnedBody,
  drawSpaceBackdrop,
  drawToolbar,
  getCanvasPoint,
  hitButton,
  roundedRect,
  type SceneButton,
} from './sceneVisuals.js';

type MagneticMode = 'compare' | 'sun-field' | 'earth-field';

const SUN_ACCENT = '#ffb34d';
const EARTH_ACCENT = '#58d8ff';

export interface MagneticSceneOptions {
  getSkinType: () => SkinType;
}

export function createMagneticScene(options: MagneticSceneOptions): CanvasScene {
  let mode: MagneticMode = 'compare';
  let elapsedSeconds = 0;
  let runtimeContext: CanvasRuntimeContext | null = null;
  let buttons: SceneButton[] = [];

  const selectMode = (id: string): void => {
    if (id === 'compare' || id === 'sun-field' || id === 'earth-field') {
      mode = id;
      runtimeContext?.invalidate();
    }
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (!runtimeContext) return;
    const hit = hitButton(
      buttons,
      getCanvasPoint(runtimeContext.canvas, event)
    );
    if (hit) selectMode(hit.id);
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (!runtimeContext) return;
    const hit = hitButton(
      buttons,
      getCanvasPoint(runtimeContext.canvas, event)
    );
    runtimeContext.canvas.style.cursor = hit ? 'pointer' : 'default';
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === '1') selectMode('sun-field');
    if (event.key === '2') selectMode('earth-field');
    if (event.key === '3') selectMode('compare');
  };

  return {
    id: 'magnetic',

    enter(context) {
      runtimeContext = context;
      context.canvas.addEventListener('pointerdown', onPointerDown);
      context.canvas.addEventListener('pointermove', onPointerMove);
      window.addEventListener('keydown', onKeyDown);
      context.canvas.style.cursor = 'default';
    },

    update(frame) {
      elapsedSeconds += frame.deltaMs / 1000;
    },

    render(_frame, context) {
      const { width, height } = context.getViewport();
      const skinType = options.getSkinType();
      buttons = createMagneticButtons(width);
      drawSpaceBackdrop(
        context.context2D,
        width,
        height,
        '#172e53',
        skinType
      );
      drawSceneHeader(
        context.context2D,
        width,
        '太阳与地球磁场实验室',
        '跟随发光粒子认识看不见的磁力线和地球磁场屏障',
        EARTH_ACCENT
      );
      drawToolbar(
        context.context2D,
        buttons,
        new Set([mode]),
        mode === 'sun-field' ? SUN_ACCENT : EARTH_ACCENT
      );

      if (mode === 'sun-field') {
        drawSunFieldFocus(
          context.context2D,
          width,
          height,
          elapsedSeconds,
          skinType
        );
      } else if (mode === 'earth-field') {
        drawEarthFieldFocus(
          context.context2D,
          width,
          height,
          elapsedSeconds,
          skinType
        );
      } else {
        drawComparison(
          context.context2D,
          width,
          height,
          elapsedSeconds,
          skinType
        );
      }
    },

    reset(context) {
      mode = 'compare';
      elapsedSeconds = 0;
      context.invalidate();
    },

    exit(context) {
      context.canvas.removeEventListener('pointerdown', onPointerDown);
      context.canvas.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('keydown', onKeyDown);
      context.canvas.style.cursor = 'grab';
      runtimeContext = null;
      buttons = [];
    },
  };
}

function createMagneticButtons(width: number): SceneButton[] {
  return createToolbarButtons(
    width,
    [
      { id: 'compare', label: '磁场对比' },
      { id: 'sun-field', label: '太阳磁场' },
      { id: 'earth-field', label: '地球磁场' },
    ],
    78
  );
}

function drawComparison(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  elapsed: number,
  skinType: SkinType
): void {
  const compact = width < 620;
  const centerY = (compact ? 118 : 132) + (height - (compact ? 180 : 205)) * 0.48;
  const sun = {
    x: width * (compact ? 0.22 : 0.25),
    y: centerY,
    radius: Math.min(width, height) * (compact ? 0.07 : 0.085),
  };
  const earth = {
    x: width * (compact ? 0.76 : 0.73),
    y: centerY,
    radius: Math.max(18, Math.min(width, height) * (compact ? 0.038 : 0.044)),
  };

  drawSolarWind(ctx, sun, earth, elapsed, width);
  drawDipoleField(ctx, sun, sun.radius, SUN_ACCENT, elapsed, 0.8, 1.18);
  drawDipoleField(ctx, earth, earth.radius, EARTH_ACCENT, elapsed, 1.25, 1.45);
  drawSunBody(ctx, sun.x, sun.y, sun.radius, elapsed, skinType);
  drawEarthBody(ctx, earth.x, earth.y, earth.radius, skinType);
  drawPoles(ctx, sun, sun.radius, SUN_ACCENT);
  drawPoles(ctx, earth, earth.radius, EARTH_ACCENT);

  drawBodyLabel(ctx, '太阳', sun.x, sun.y + sun.radius + 12);
  drawBodyLabel(ctx, '地球', earth.x, earth.y + earth.radius + 12);
  drawInfoChip(
    ctx,
    '太阳磁场更巨大，地球磁场像保护伞',
    compact ? 14 : 28,
    height - (compact ? 86 : 102),
    EARTH_ACCENT
  );
  drawLegend(ctx, width, compact ? 126 : 142, [
    { color: SUN_ACCENT, text: '太阳磁力线' },
    { color: EARTH_ACCENT, text: '地球磁力线' },
    { color: '#d9f3ff', text: '太阳风粒子' },
  ]);
}

function drawSunFieldFocus(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  elapsed: number,
  skinType: SkinType
): void {
  const compact = width < 620;
  const center = {
    x: width * 0.5,
    y: (compact ? 118 : 130) + (height - (compact ? 178 : 205)) * 0.48,
  };
  const radius = Math.min(width, height) * (compact ? 0.1 : 0.13);
  const activity = 0.5 + Math.sin(elapsed * 1.25) * 0.5;

  drawDipoleField(
    ctx,
    center,
    radius,
    SUN_ACCENT,
    elapsed,
    0.72 + activity * 0.25,
    1.45
  );
  drawSunBody(ctx, center.x, center.y, radius, elapsed, skinType);
  drawPoles(ctx, center, radius, SUN_ACCENT);
  drawBodyLabel(ctx, '太阳磁场', center.x, center.y + radius + 16);

  drawInfoPanel(
    ctx,
    compact ? 14 : 28,
    compact ? 122 : 140,
    compact ? width - 28 : Math.min(270, width * 0.3),
    '太阳磁场',
    [
      '磁力线从一个区域伸出，再回到另一个区域。',
      '太阳活动增强时，磁场会扭曲并释放带电粒子。',
      `当前活动等级：${activity > 0.68 ? '活跃' : activity > 0.34 ? '平稳' : '较弱'}`,
    ],
    SUN_ACCENT
  );
  drawInfoChip(
    ctx,
    '发光粒子沿磁力线移动',
    compact ? 14 : width - 220,
    height - (compact ? 86 : 102),
    SUN_ACCENT
  );
}

function drawEarthFieldFocus(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  elapsed: number,
  skinType: SkinType
): void {
  const compact = width < 620;
  const center = {
    x: width * 0.5,
    y: (compact ? 118 : 130) + (height - (compact ? 178 : 205)) * 0.5,
  };
  const radius = Math.min(width, height) * (compact ? 0.075 : 0.09);

  drawMagnetosphere(ctx, center, radius, width, elapsed);
  drawDipoleField(ctx, center, radius, EARTH_ACCENT, elapsed, 1.2, 1.75);
  drawEarthBody(ctx, center.x, center.y, radius, skinType);
  drawPoles(ctx, center, radius, EARTH_ACCENT);
  drawBodyLabel(ctx, '地球磁场', center.x, center.y + radius + 16);

  drawInfoPanel(
    ctx,
    compact ? 14 : 28,
    compact ? 122 : 140,
    compact ? width - 28 : Math.min(282, width * 0.32),
    '地球的磁场保护罩',
    [
      '地球内部运动产生了一个巨大的磁场。',
      '磁场会让许多太阳风粒子绕开地球。',
      '靠近南北极的粒子可能形成美丽的极光。',
    ],
    EARTH_ACCENT
  );
  drawInfoChip(
    ctx,
    'N 北磁极 · S 南磁极',
    compact ? 14 : width - 205,
    height - (compact ? 86 : 102),
    EARTH_ACCENT
  );
}

function drawDipoleField(
  ctx: CanvasRenderingContext2D,
  center: Point2D,
  radius: number,
  color: string,
  elapsed: number,
  speed: number,
  spreadScale: number
): void {
  ctx.save();
  ctx.lineWidth = 1.25;
  ctx.globalCompositeOperation = 'lighter';

  for (const direction of [-1, 1] as const) {
    for (let index = 0; index < 6; index += 1) {
      const spread = radius * (1.7 + index * 0.62) * spreadScale;
      const start = {
        x: center.x + direction * radius * 0.2,
        y: center.y - radius * 0.82,
      };
      const end = {
        x: center.x + direction * radius * 0.2,
        y: center.y + radius * 0.82,
      };
      const control1 = {
        x: center.x + direction * spread,
        y: center.y - radius * (1.15 + index * 0.08),
      };
      const control2 = {
        x: center.x + direction * spread,
        y: center.y + radius * (1.15 + index * 0.08),
      };
      const alpha = 0.26 + (5 - index) * 0.045;

      ctx.strokeStyle = withAlpha(color, alpha);
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.bezierCurveTo(
        control1.x,
        control1.y,
        control2.x,
        control2.y,
        end.x,
        end.y
      );
      ctx.stroke();

      const particleProgress =
        (elapsed * speed * 0.09 + index * 0.13 + (direction > 0 ? 0 : 0.47)) % 1;
      const particle = cubicPoint(
        start,
        control1,
        control2,
        end,
        particleProgress
      );
      const glow = ctx.createRadialGradient(
        particle.x,
        particle.y,
        0,
        particle.x,
        particle.y,
        7
      );
      glow.addColorStop(0, '#ffffff');
      glow.addColorStop(0.35, color);
      glow.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, 7, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawSolarWind(
  ctx: CanvasRenderingContext2D,
  sun: { x: number; y: number; radius: number },
  earth: { x: number; y: number; radius: number },
  elapsed: number,
  width: number
): void {
  const startX = sun.x + sun.radius * 1.5;
  const endX = earth.x - earth.radius * 2.8;
  const distance = Math.max(1, endX - startX);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let index = 0; index < 18; index += 1) {
    const progress = (elapsed * 0.12 + index / 18) % 1;
    const x = startX + progress * distance;
    const y =
      sun.y +
      Math.sin(index * 2.17 + elapsed * 1.3) *
        Math.min(44, width * 0.055);
    ctx.fillStyle = `rgba(217, 243, 255, ${0.22 + progress * 0.55})`;
    ctx.beginPath();
    ctx.arc(x, y, 1.3 + (index % 3) * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(153, 223, 255, 0.24)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 11, y);
    ctx.lineTo(x - 3, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawMagnetosphere(
  ctx: CanvasRenderingContext2D,
  center: Point2D,
  radius: number,
  width: number,
  elapsed: number
): void {
  const pulse = 1 + Math.sin(elapsed * 1.4) * 0.035;
  const shield = ctx.createRadialGradient(
    center.x,
    center.y,
    radius,
    center.x,
    center.y,
    radius * 3.8
  );
  shield.addColorStop(0, 'rgba(88, 216, 255, 0.12)');
  shield.addColorStop(0.7, 'rgba(88, 216, 255, 0.05)');
  shield.addColorStop(1, 'rgba(88, 216, 255, 0)');
  ctx.fillStyle = shield;
  ctx.beginPath();
  ctx.ellipse(
    center.x,
    center.y,
    Math.min(radius * 4.2 * pulse, width * 0.34),
    radius * 3.1 * pulse,
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();
}

function drawSunBody(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  elapsed: number,
  skinType: SkinType
): void {
  const pulse = 1 + Math.sin(elapsed * 1.8) * 0.035;
  const glow = ctx.createRadialGradient(x, y, radius * 0.2, x, y, radius * 2.2);
  glow.addColorStop(0, 'rgba(255, 247, 185, 0.95)');
  glow.addColorStop(0.42, 'rgba(255, 164, 62, 0.58)');
  glow.addColorStop(1, 'rgba(255, 118, 40, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, radius * 2.2 * pulse, 0, Math.PI * 2);
  ctx.fill();

  const hasTexture = drawSkinnedBody(ctx, 'sun', skinType, x, y, radius);
  if (!hasTexture) {
    const body = ctx.createRadialGradient(
      x - radius * 0.3,
      y - radius * 0.32,
      1,
      x,
      y,
      radius
    );
    body.addColorStop(0, '#fff9b0');
    body.addColorStop(0.5, '#ffbd4c');
    body.addColorStop(1, '#e86e23');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  if (hasTexture) return;
  ctx.strokeStyle = 'rgba(255, 245, 180, 0.36)';
  ctx.lineWidth = Math.max(1, radius * 0.035);
  for (let index = 0; index < 5; index += 1) {
    ctx.beginPath();
    ctx.arc(
      x,
      y,
      radius * (0.35 + index * 0.12),
      elapsed * 0.08 + index,
      elapsed * 0.08 + index + Math.PI * 0.9
    );
    ctx.stroke();
  }
}

function drawEarthBody(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  skinType: SkinType
): void {
  if (drawSkinnedBody(ctx, 'earth', skinType, x, y, radius)) return;
  const body = ctx.createRadialGradient(
    x - radius * 0.35,
    y - radius * 0.35,
    1,
    x,
    y,
    radius
  );
  body.addColorStop(0, '#c8f4ff');
  body.addColorStop(0.32, '#42a8e8');
  body.addColorStop(1, '#0d438b');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#72cb79';
  ctx.beginPath();
  ctx.ellipse(
    x - radius * 0.2,
    y - radius * 0.1,
    radius * 0.22,
    radius * 0.38,
    0.48,
    0,
    Math.PI * 2
  );
  ctx.ellipse(
    x + radius * 0.25,
    y + radius * 0.2,
    radius * 0.3,
    radius * 0.18,
    -0.25,
    0,
    Math.PI * 2
  );
  ctx.fill();
}

function drawPoles(
  ctx: CanvasRenderingContext2D,
  center: Point2D,
  radius: number,
  accent: string
): void {
  ctx.font = `700 ${Math.max(10, radius * 0.28)}px "Microsoft YaHei", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(center.x, center.y - radius * 0.82, Math.max(6, radius * 0.12), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#07132e';
  ctx.fillText('N', center.x, center.y - radius * 0.82);

  ctx.fillStyle = '#ff6685';
  ctx.beginPath();
  ctx.arc(center.x, center.y + radius * 0.82, Math.max(6, radius * 0.12), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#260916';
  ctx.fillText('S', center.x, center.y + radius * 0.82);
}

function drawLegend(
  ctx: CanvasRenderingContext2D,
  width: number,
  y: number,
  items: ReadonlyArray<{ color: string; text: string }>
): void {
  const compact = width < 620;
  const itemWidth = compact ? Math.max(92, (width - 28) / items.length) : 132;
  const totalWidth = itemWidth * items.length;
  const startX = Math.max(14, (width - totalWidth) / 2);
  ctx.font = `${compact ? 10 : 11}px "Microsoft YaHei", sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  items.forEach((item, index) => {
    const x = startX + index * itemWidth;
    ctx.fillStyle = item.color;
    ctx.beginPath();
    ctx.arc(x + 6, y + 6, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(226, 236, 255, 0.76)';
    ctx.fillText(item.text, x + 16, y + 6);
  });
}

function drawInfoPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  title: string,
  lines: readonly string[],
  accent: string
): void {
  const lineHeight = 19;
  const height = 50 + lines.length * lineHeight;
  roundedRect(ctx, x, y, width, height, 14);
  ctx.fillStyle = 'rgba(7, 15, 40, 0.82)';
  ctx.fill();
  ctx.strokeStyle = withAlpha(accent, 0.52);
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = accent;
  ctx.font = '700 13px "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(title, x + 14, y + 13);

  ctx.fillStyle = 'rgba(226, 236, 255, 0.8)';
  ctx.font = '11px "Microsoft YaHei", sans-serif';
  lines.forEach((line, index) => {
    ctx.fillText(
      `• ${line}`,
      x + 14,
      y + 40 + index * lineHeight,
      width - 28
    );
  });
}

function cubicPoint(
  start: Point2D,
  control1: Point2D,
  control2: Point2D,
  end: Point2D,
  t: number
): Point2D {
  const inverse = 1 - t;
  return {
    x:
      inverse ** 3 * start.x +
      3 * inverse ** 2 * t * control1.x +
      3 * inverse * t ** 2 * control2.x +
      t ** 3 * end.x,
    y:
      inverse ** 3 * start.y +
      3 * inverse ** 2 * t * control1.y +
      3 * inverse * t ** 2 * control2.y +
      t ** 3 * end.y,
  };
}

function withAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  const value = Number.parseInt(normalized, 16);
  const red = (value >> 16) & 0xff;
  const green = (value >> 8) & 0xff;
  const blue = value & 0xff;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
