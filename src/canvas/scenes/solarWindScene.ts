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
  type SceneButton,
} from './sceneVisuals.js';
import {
  advanceSolarWindParticle,
  createSolarWindParticles,
  type SolarWindParticle,
} from './member4SceneLogic.js';

export type SolarWindMode = 'radial' | 'shield' | 'aurora';

export interface SolarWindSceneOptions {
  getSkinType: () => SkinType;
  translate: (key: string) => string;
}

const ACCENT = '#61e7ff';
const TAU = Math.PI * 2;

export function createSolarWindScene(
  options: SolarWindSceneOptions,
): CanvasScene {
  let mode: SolarWindMode = 'shield';
  let particles = createSolarWindParticles();
  let solarRotation = 0;
  let runtimeContext: CanvasRuntimeContext | null = null;
  let buttons: SceneButton[] = [];

  const selectMode = (id: string): void => {
    if (id === 'radial' || id === 'shield' || id === 'aurora') {
      mode = id;
      runtimeContext?.invalidate();
    }
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (!runtimeContext) return;
    const button = hitButton(
      buttons,
      getCanvasPoint(runtimeContext.canvas, event),
    );
    if (button) selectMode(button.id);
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (!runtimeContext) return;
    const button = hitButton(
      buttons,
      getCanvasPoint(runtimeContext.canvas, event),
    );
    runtimeContext.canvas.style.cursor = button ? 'pointer' : 'default';
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === '1') selectMode('radial');
    if (event.key === '2') selectMode('shield');
    if (event.key === '3') selectMode('aurora');
  };

  return {
    id: 'solar-wind',

    enter(context) {
      runtimeContext = context;
      context.canvas.addEventListener('pointerdown', onPointerDown);
      context.canvas.addEventListener('pointermove', onPointerMove);
      window.addEventListener('keydown', onKeyDown);
      context.canvas.style.cursor = 'default';
    },

    update(frame) {
      const deltaSeconds = frame.deltaMs / 1000;
      solarRotation = (solarRotation + deltaSeconds * 0.42) % TAU;
      particles = particles.map(particle =>
        advanceSolarWindParticle(particle, deltaSeconds)
      );
    },

    render(_frame, context) {
      const { width, height } = context.getViewport();
      const skinType = options.getSkinType();
      buttons = createToolbarButtons(
        width,
        [
          { id: 'radial', label: options.translate('solarWind.mode.radial') },
          { id: 'shield', label: options.translate('solarWind.mode.shield') },
          { id: 'aurora', label: options.translate('solarWind.mode.aurora') },
        ],
        78,
      );

      drawSpaceBackdrop(
        context.context2D,
        width,
        height,
        '#173b59',
        skinType,
      );
      drawSceneHeader(
        context.context2D,
        width,
        options.translate('scene.solar-wind.title'),
        options.translate('solarWind.subtitle'),
        ACCENT,
      );
      drawToolbar(context.context2D, buttons, new Set([mode]), ACCENT);

      if (mode === 'radial') {
        drawRadialMode(
          context.context2D,
          width,
          height,
          particles,
          solarRotation,
          skinType,
          options.translate,
        );
      } else {
        drawEarthInteraction(
          context.context2D,
          width,
          height,
          particles,
          solarRotation,
          skinType,
          mode,
          options.translate,
        );
      }
    },

    reset(context) {
      mode = 'shield';
      particles = createSolarWindParticles();
      solarRotation = 0;
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

function drawRadialMode(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  particles: readonly SolarWindParticle[],
  rotation: number,
  skinType: SkinType,
  translate: (key: string) => string,
): void {
  const compact = width < 620;
  const center = {
    x: width * 0.5,
    y: 120 + (height - 190) * 0.5,
  };
  const sunRadius = Math.max(32, Math.min(width, height) * 0.09);
  const maxRadius = Math.max(width, height) * 0.58;

  for (const particle of particles) {
    const angle = particle.angle + rotation * (1 - particle.progress) * 0.5;
    const radius = sunRadius * 1.35 + particle.progress * maxRadius;
    drawParticle(
      ctx,
      center.x + Math.cos(angle) * radius,
      center.y + Math.sin(angle) * radius,
      1.4 + particle.phase * 1.6,
      particle.progress,
    );
  }

  drawSun(ctx, center, sunRadius, rotation, skinType);
  drawBodyLabel(
    ctx,
    translate('solarWind.sun'),
    center.x,
    center.y + sunRadius + 12,
  );
  drawInfoChip(
    ctx,
    translate('solarWind.chip.radial'),
    compact ? 14 : 28,
    height - (compact ? 48 : 62),
    ACCENT,
  );
}

function drawEarthInteraction(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  particles: readonly SolarWindParticle[],
  rotation: number,
  skinType: SkinType,
  mode: Exclude<SolarWindMode, 'radial'>,
  translate: (key: string) => string,
): void {
  const compact = width < 620;
  const centerY = 120 + (height - 190) * 0.5;
  const sun = {
    x: width * (compact ? 0.16 : 0.18),
    y: centerY,
  };
  const earth = {
    x: width * (compact ? 0.78 : 0.76),
    y: centerY,
  };
  const sunRadius = Math.max(27, Math.min(width, height) * 0.075);
  const earthRadius = Math.max(17, Math.min(width, height) * 0.035);
  const startX = sun.x + sunRadius * 1.2;
  const travel = earth.x - startX + earthRadius * 4.8;

  drawMagnetosphere(ctx, earth, earthRadius, mode, rotation);

  for (const particle of particles) {
    const progress = particle.progress;
    const x = startX + progress * travel;
    const baseY = centerY + particle.lane * Math.min(height * 0.42, 190);
    const proximity = clamp01(
      (x - (earth.x - earthRadius * 5.2)) / (earthRadius * 5.4),
    );
    const side = particle.lane < 0 ? -1 : 1;
    let y = baseY;

    if (mode === 'shield') {
      y += side * Math.sin(proximity * Math.PI * 0.5) * earthRadius * 3.6;
    } else {
      const poleY = earth.y + side * earthRadius * 0.82;
      y = baseY * (1 - proximity) + poleY * proximity;
    }

    drawParticle(ctx, x, y, 1.6 + particle.phase * 1.7, progress);
  }

  drawSun(ctx, sun, sunRadius, rotation, skinType);
  drawEarth(ctx, earth, earthRadius, skinType);
  drawBodyLabel(
    ctx,
    translate('solarWind.sun'),
    sun.x,
    sun.y + sunRadius + 12,
  );
  drawBodyLabel(
    ctx,
    translate('solarWind.earth'),
    earth.x,
    earth.y + earthRadius + 12,
  );
  drawInfoChip(
    ctx,
    translate(`solarWind.chip.${mode}`),
    compact ? 14 : 28,
    height - (compact ? 48 : 62),
    mode === 'aurora' ? '#73ffb4' : ACCENT,
  );
}

function drawSun(
  ctx: CanvasRenderingContext2D,
  center: Point2D,
  radius: number,
  rotation: number,
  skinType: SkinType,
): void {
  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.rotate(rotation);
  ctx.strokeStyle = 'rgba(255, 201, 71, 0.5)';
  ctx.lineWidth = 3;
  for (let ray = 0; ray < 12; ray += 1) {
    ctx.rotate(TAU / 12);
    ctx.beginPath();
    ctx.moveTo(radius * 1.18, 0);
    ctx.lineTo(radius * 1.46, 0);
    ctx.stroke();
  }
  ctx.restore();

  if (!drawSkinnedBody(ctx, 'sun', skinType, center.x, center.y, radius)) {
    const gradient = ctx.createRadialGradient(
      center.x - radius * 0.2,
      center.y - radius * 0.2,
      radius * 0.1,
      center.x,
      center.y,
      radius,
    );
    gradient.addColorStop(0, '#fff6a8');
    gradient.addColorStop(0.55, '#ffc94a');
    gradient.addColorStop(1, '#ff7c28');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, 0, TAU);
    ctx.fill();
  }
}

function drawEarth(
  ctx: CanvasRenderingContext2D,
  center: Point2D,
  radius: number,
  skinType: SkinType,
): void {
  if (drawSkinnedBody(ctx, 'earth', skinType, center.x, center.y, radius)) {
    return;
  }

  ctx.fillStyle = '#3a9be8';
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius, 0, TAU);
  ctx.fill();
}

function drawMagnetosphere(
  ctx: CanvasRenderingContext2D,
  earth: Point2D,
  radius: number,
  mode: Exclude<SolarWindMode, 'radial'>,
  rotation: number,
): void {
  ctx.save();
  ctx.strokeStyle =
    mode === 'aurora' ? 'rgba(115, 255, 180, 0.7)' : 'rgba(97, 231, 255, 0.58)';
  ctx.lineWidth = 2;
  for (let line = 0; line < 4; line += 1) {
    const spread = radius * (2.1 + line * 0.75);
    ctx.beginPath();
    ctx.ellipse(earth.x, earth.y, spread * 0.72, spread, 0, 0, TAU);
    ctx.stroke();
  }

  if (mode === 'aurora') {
    const pulse = 0.62 + Math.sin(rotation * 6) * 0.18;
    ctx.fillStyle = `rgba(115, 255, 180, ${pulse})`;
    ctx.beginPath();
    ctx.arc(earth.x, earth.y - radius * 0.85, radius * 0.42, 0, TAU);
    ctx.arc(earth.x, earth.y + radius * 0.85, radius * 0.42, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawParticle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  progress: number,
): void {
  const alpha = 0.35 + Math.sin(progress * Math.PI) * 0.65;
  ctx.fillStyle = `rgba(218, 248, 255, ${alpha})`;
  ctx.shadowColor = '#61e7ff';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, TAU);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
