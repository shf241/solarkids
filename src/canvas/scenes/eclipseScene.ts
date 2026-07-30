import type {
  CanvasRuntimeContext,
  CanvasScene,
  FrameSnapshot,
} from '../types.js';
import type { SkinType } from '../../ui/assetLoader.js';
import {
  clamp,
  createToolbarButtons,
  drawBodyLabel,
  drawInfoChip,
  drawSceneHeader,
  drawSkinnedBody,
  drawSpaceBackdrop,
  drawTimeline,
  drawToolbar,
  getCanvasPoint,
  hitButton,
  roundedRect,
  type SceneButton,
} from './sceneVisuals.js';

type EclipseKind = 'solar' | 'lunar';
type EclipseView = 'overview' | 'earth';

const ACCENT = '#ffd35c';
const CYCLE_MS = 12_000;

export interface EclipseSceneOptions {
  getSkinType: () => SkinType;
  translate: (key: string) => string;
}

export function createEclipseScene(options: EclipseSceneOptions): CanvasScene {
  let kind: EclipseKind = 'solar';
  let view: EclipseView = 'overview';
  let progress = 0.5;
  let runtimeContext: CanvasRuntimeContext | null = null;
  let buttons: SceneButton[] = [];

  const setSelection = (id: string): void => {
    if (id === 'solar' || id === 'lunar') {
      kind = id;
      progress = 0.5;
    } else if (id === 'overview' || id === 'earth') {
      view = id;
    }
    runtimeContext?.invalidate();
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (!runtimeContext) return;
    const hit = hitButton(
      buttons,
      getCanvasPoint(runtimeContext.canvas, event)
    );
    if (hit) setSelection(hit.id);
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
    if (event.key === '1') setSelection('solar');
    if (event.key === '2') setSelection('lunar');
    if (event.key.toLowerCase() === 'v') {
      setSelection(view === 'overview' ? 'earth' : 'overview');
    }
  };

  return {
    id: 'eclipse',

    enter(context) {
      runtimeContext = context;
      context.canvas.addEventListener('pointerdown', onPointerDown);
      context.canvas.addEventListener('pointermove', onPointerMove);
      window.addEventListener('keydown', onKeyDown);
      context.canvas.style.cursor = 'default';
    },

    update(frame) {
      progress = (progress + frame.deltaMs / CYCLE_MS) % 1;
    },

    render(frame, context) {
      const { width, height } = context.getViewport();
      const skinType = options.getSkinType();
      const translate = options.translate;
      buttons = createEclipseButtons(width, translate);
      drawSpaceBackdrop(
        context.context2D,
        width,
        height,
        '#1d2854',
        skinType
      );
      drawSceneHeader(
        context.context2D,
        width,
        translate('scene.eclipse.title'),
        translate('scene.eclipse.description'),
        ACCENT
      );
      drawToolbar(
        context.context2D,
        buttons,
        new Set([kind, view]),
        ACCENT
      );

      if (view === 'earth') {
        drawEarthView(
          context.context2D,
          width,
          height,
          kind,
          progress,
          skinType,
          translate
        );
      } else {
        drawOverview(
          context.context2D,
          width,
          height,
          kind,
          progress,
          frame,
          skinType,
          translate
        );
      }

      drawTimeline(
        context.context2D,
        width,
        height,
        progress,
        [
          translate('eclipse.timeline.start'),
          translate('eclipse.timeline.align'),
          translate('eclipse.timeline.end'),
        ],
        ACCENT
      );
    },

    reset(context) {
      kind = 'solar';
      view = 'overview';
      progress = 0.5;
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

function createEclipseButtons(
  width: number,
  translate: (key: string) => string,
): SceneButton[] {
  return createToolbarButtons(
    width,
    [
      { id: 'solar', label: translate('eclipse.mode.solar') },
      { id: 'lunar', label: translate('eclipse.mode.lunar') },
      { id: 'overview', label: translate('eclipse.mode.overview') },
      { id: 'earth', label: translate('eclipse.mode.earth') },
    ],
    78
  );
}

function drawOverview(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  kind: EclipseKind,
  progress: number,
  frame: Readonly<FrameSnapshot>,
  skinType: SkinType,
  translate: (key: string) => string,
): void {
  const compact = width < 620;
  const top = compact ? 120 : 132;
  const bottom = compact ? 68 : 82;
  const centerY = top + (height - top - bottom) * 0.52;
  const sun = { x: width * (compact ? 0.14 : 0.16), y: centerY };
  const earth = {
    x: width * (kind === 'solar' ? (compact ? 0.81 : 0.76) : 0.52),
    y: centerY,
  };
  const moonOrbitRadius = Math.max(
    compact ? 72 : 100,
    Math.min(width * 0.25, 190)
  );
  const moonOrbitYRadius = compact ? 38 : 58;
  // 日食在月球运行到地球朝向太阳的一侧发生，月食则在背向太阳的一侧发生。
  // 两种模式都从食甚附近开始，但月球始终沿完整椭圆轨道绕地球运行。
  const orbitAngle =
    progress * Math.PI * 2 + (kind === 'lunar' ? Math.PI : 0);
  const moon = {
    x: earth.x + Math.cos(orbitAngle) * moonOrbitRadius,
    y: earth.y + Math.sin(orbitAngle) * moonOrbitYRadius,
  };
  const eclipseSide = kind === 'solar' ? -1 : 1;
  const alignment = Math.pow(
    clamp((1 + eclipseSide * Math.cos(orbitAngle)) / 2, 0, 1),
    3
  );

  drawLightBeams(ctx, sun, width, height);
  drawMoonOrbit(ctx, earth, moonOrbitRadius, moonOrbitYRadius);

  if (kind === 'solar') {
    drawShadowCone(ctx, moon, earth, 14, 29, alignment, '#11172a');
  } else {
    drawShadowCone(ctx, earth, moon, 29, 14, alignment, '#121729');
  }

  drawSun(ctx, sun.x, sun.y, compact ? 34 : 48, frame.elapsedMs, skinType);
  drawEarth(ctx, earth.x, earth.y, compact ? 22 : 29, skinType);
  drawMoon(
    ctx,
    moon.x,
    moon.y,
    compact ? 11 : 14,
    kind === 'lunar' ? alignment : 0,
    skinType
  );

  drawBodyLabel(ctx, translate('solarWind.sun'), sun.x, sun.y + (compact ? 42 : 58));
  drawBodyLabel(ctx, translate('solarWind.earth'), earth.x, earth.y + (compact ? 30 : 38));
  drawBodyLabel(ctx, translate('body.moon'), moon.x, moon.y + (compact ? 18 : 22));

  const status =
    alignment > 0.82
      ? kind === 'solar'
        ? translate('eclipse.status.solarAligned')
        : translate('eclipse.status.lunarAligned')
      : kind === 'solar'
        ? translate('eclipse.status.solarApproach')
        : translate('eclipse.status.lunarApproach');
  drawInfoChip(ctx, status, compact ? 14 : 28, height - (compact ? 104 : 124), ACCENT);

  const noteWidth = Math.min(compact ? width - 28 : 260, width - 32);
  const noteX = compact ? 14 : width - noteWidth - 28;
  const noteY = compact ? top + 4 : top + 8;
  drawTeachingCard(
    ctx,
    noteX,
    noteY,
    noteWidth,
    kind === 'solar'
      ? translate('eclipse.note.solar')
      : translate('eclipse.note.lunar'),
    kind === 'solar'
      ? translate('eclipse.order.solar')
      : translate('eclipse.order.lunar')
  );
}

function drawEarthView(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  kind: EclipseKind,
  progress: number,
  skinType: SkinType,
  translate: (key: string) => string,
): void {
  const compact = width < 620;
  const centerX = width * 0.5;
  const centerY = (compact ? 118 : 130) + (height - (compact ? 180 : 210)) * 0.48;
  const phaseOffset = Math.sin(progress * Math.PI * 2);

  if (kind === 'solar') {
    const sunRadius = Math.min(width, height) * (compact ? 0.11 : 0.13);
    const moonRadius = sunRadius * 0.94;
    const moonX = centerX + phaseOffset * sunRadius * 2.2;
    const moonY = centerY + Math.sin(progress * Math.PI * 4) * sunRadius * 0.22;
    const coverage = Math.round(
      (1 - clamp(Math.abs(moonX - centerX) / (sunRadius * 2), 0, 1)) * 100
    );

    const sky = ctx.createLinearGradient(0, 110, 0, height);
    sky.addColorStop(0, `rgba(38, 70, 124, ${0.72 - coverage / 180})`);
    sky.addColorStop(1, '#090d20');
    ctx.fillStyle = sky;
    ctx.fillRect(0, compact ? 108 : 120, width, height);

    drawSun(ctx, centerX, centerY, sunRadius, 0, skinType);
    drawMoon(ctx, moonX, moonY, moonRadius, 0, skinType);
    ctx.fillStyle = 'rgba(4, 7, 15, 0.93)';
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonRadius * 0.96, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(190, 211, 242, 0.32)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    drawInfoChip(
      ctx,
      translate('eclipse.coverage').replace('{value}', String(coverage)),
      22,
      height - 112,
      ACCENT,
    );
  } else {
    const moonRadius = Math.min(width, height) * (compact ? 0.12 : 0.15);
    const shadowX = centerX + phaseOffset * moonRadius * 2.2;
    drawMoon(ctx, centerX, centerY, moonRadius, 0.72, skinType);

    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, moonRadius, 0, Math.PI * 2);
    ctx.clip();
    const shadow = ctx.createRadialGradient(
      shadowX - moonRadius * 0.25,
      centerY,
      moonRadius * 0.1,
      shadowX,
      centerY,
      moonRadius * 1.05
    );
    shadow.addColorStop(0, 'rgba(38, 12, 14, 0.94)');
    shadow.addColorStop(0.62, 'rgba(120, 34, 25, 0.72)');
    shadow.addColorStop(1, 'rgba(145, 49, 30, 0)');
    ctx.fillStyle = shadow;
    ctx.beginPath();
    ctx.arc(shadowX, centerY, moonRadius * 1.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    drawInfoChip(
      ctx,
      translate('eclipse.atmosphere'),
      22,
      height - 112,
      ACCENT,
    );
  }

  ctx.fillStyle = 'rgba(224, 234, 255, 0.82)';
  ctx.font = `${compact ? 12 : 14}px "Microsoft YaHei", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(
    kind === 'solar'
      ? translate('eclipse.view.solar')
      : translate('eclipse.view.lunar'),
    centerX,
    compact ? 124 : 138
  );
}

function drawLightBeams(
  ctx: CanvasRenderingContext2D,
  sun: { x: number; y: number },
  width: number,
  height: number
): void {
  const gradient = ctx.createLinearGradient(sun.x, sun.y, width, sun.y);
  gradient.addColorStop(0, 'rgba(255, 211, 92, 0.16)');
  gradient.addColorStop(1, 'rgba(255, 211, 92, 0.015)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(sun.x, sun.y - 36);
  ctx.lineTo(width, Math.max(105, sun.y - height * 0.27));
  ctx.lineTo(width, Math.min(height - 64, sun.y + height * 0.27));
  ctx.lineTo(sun.x, sun.y + 36);
  ctx.closePath();
  ctx.fill();
}

function drawMoonOrbit(
  ctx: CanvasRenderingContext2D,
  earth: { x: number; y: number },
  radiusX: number,
  radiusY: number
): void {
  ctx.save();
  ctx.strokeStyle = 'rgba(160, 183, 228, 0.28)';
  ctx.lineWidth = 1.2;
  ctx.setLineDash([5, 8]);
  ctx.beginPath();
  ctx.ellipse(
    earth.x,
    earth.y,
    radiusX,
    radiusY,
    0,
    0,
    Math.PI * 2
  );
  ctx.stroke();
  ctx.restore();
}

function drawShadowCone(
  ctx: CanvasRenderingContext2D,
  caster: { x: number; y: number },
  target: { x: number; y: number },
  casterRadius: number,
  targetRadius: number,
  alignment: number,
  color: string
): void {
  const direction = Math.sign(target.x - caster.x) || 1;
  const endX = target.x + direction * targetRadius * 1.8;
  const gradient = ctx.createLinearGradient(caster.x, caster.y, endX, target.y);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, 'rgba(4, 6, 14, 0)');
  ctx.fillStyle = gradient;
  ctx.globalAlpha = 0.16 + alignment * 0.58;
  ctx.beginPath();
  ctx.moveTo(caster.x, caster.y - casterRadius);
  ctx.lineTo(endX, target.y - targetRadius * 0.48);
  ctx.lineTo(endX, target.y + targetRadius * 0.48);
  ctx.lineTo(caster.x, caster.y + casterRadius);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawSun(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  elapsedMs: number,
  skinType: SkinType
): void {
  const pulse = 1 + Math.sin(elapsedMs / 450) * 0.035;
  const glow = ctx.createRadialGradient(x, y, radius * 0.2, x, y, radius * 1.9);
  glow.addColorStop(0, 'rgba(255, 245, 173, 0.96)');
  glow.addColorStop(0.42, 'rgba(255, 191, 54, 0.72)');
  glow.addColorStop(1, 'rgba(255, 140, 32, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, radius * 1.9 * pulse, 0, Math.PI * 2);
  ctx.fill();

  if (!drawSkinnedBody(ctx, 'sun', skinType, x, y, radius)) {
    const body = ctx.createRadialGradient(
      x - radius * 0.28,
      y - radius * 0.28,
      radius * 0.05,
      x,
      y,
      radius
    );
    body.addColorStop(0, '#fffbd0');
    body.addColorStop(0.5, '#ffd35c');
    body.addColorStop(1, '#f28a24');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawEarth(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  skinType: SkinType
): void {
  if (drawSkinnedBody(ctx, 'earth', skinType, x, y, radius)) return;
  const ocean = ctx.createRadialGradient(
    x - radius * 0.35,
    y - radius * 0.3,
    1,
    x,
    y,
    radius
  );
  ocean.addColorStop(0, '#b7edff');
  ocean.addColorStop(0.28, '#42a7e8');
  ocean.addColorStop(1, '#145099');
  ctx.fillStyle = ocean;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#72c878';
  ctx.beginPath();
  ctx.ellipse(
    x - radius * 0.24,
    y - radius * 0.08,
    radius * 0.24,
    radius * 0.4,
    0.45,
    0,
    Math.PI * 2
  );
  ctx.ellipse(
    x + radius * 0.27,
    y + radius * 0.18,
    radius * 0.28,
    radius * 0.18,
    -0.3,
    0,
    Math.PI * 2
  );
  ctx.fill();
}

function drawMoon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  lunarTint: number,
  skinType: SkinType
): void {
  const hasTexture = drawSkinnedBody(ctx, 'moon', skinType, x, y, radius);
  if (!hasTexture) {
    const body = ctx.createRadialGradient(
      x - radius * 0.3,
      y - radius * 0.35,
      1,
      x,
      y,
      radius
    );
    body.addColorStop(
      0,
      lunarTint > 0.4 ? 'rgb(255, 184, 128)' : '#ffffff'
    );
    body.addColorStop(
      0.58,
      lunarTint > 0.4 ? 'rgb(184, 91, 65)' : '#cbd2dc'
    );
    body.addColorStop(1, lunarTint > 0.4 ? '#71372f' : '#7b8492');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle =
    lunarTint > 0.4
      ? `rgba(132, 43, 28, ${Math.min(0.52, lunarTint * 0.55)})`
      : 'rgba(53, 58, 69, 0.22)';
  for (const [dx, dy, size] of [
    [-0.28, -0.18, 0.16],
    [0.24, -0.08, 0.12],
    [-0.02, 0.3, 0.1],
  ] as const) {
    ctx.beginPath();
    ctx.arc(x + radius * dx, y + radius * dy, radius * size, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawTeachingCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  message: string,
  order: string
): void {
  const height = width < 250 ? 82 : 90;
  roundedRect(ctx, x, y, width, height, 14);
  ctx.fillStyle = 'rgba(8, 16, 43, 0.78)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 211, 92, 0.4)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = ACCENT;
  ctx.font = '700 12px "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(order, x + 14, y + 12);

  ctx.fillStyle = 'rgba(231, 238, 255, 0.84)';
  ctx.font = '11px "Microsoft YaHei", sans-serif';
  drawWrappedText(ctx, message, x + 14, y + 35, width - 28, 17, 3);
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number
): void {
  const characters = [...text];
  let line = '';
  let lineIndex = 0;
  for (const character of characters) {
    const next = line + character;
    if (ctx.measureText(next).width > maxWidth && line) {
      ctx.fillText(line, x, y + lineIndex * lineHeight);
      line = character;
      lineIndex += 1;
      if (lineIndex >= maxLines) return;
    } else {
      line = next;
    }
  }
  if (lineIndex < maxLines) {
    ctx.fillText(line, x, y + lineIndex * lineHeight);
  }
}
