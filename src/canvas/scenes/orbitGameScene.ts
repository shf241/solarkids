import {
  calculateOrbitObservation,
  createGameState,
  MAX_ORBIT_RADIUS_RATIO,
  MIN_ORBIT_RADIUS_RATIO,
  resetGame,
  saveOrbitGameResult,
  setOrbitRadius,
  type OrbitGameState,
  type OrbitZone,
} from '../../game/index.js';
import { UserStateStore } from '../../storage/index.js';
import type { SkinType } from '../../ui/assetLoader.js';
import type {
  CanvasRuntimeContext,
  CanvasScene,
  CanvasViewport,
  Point2D,
} from '../types.js';
import {
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
  calculateOrbitRadiusRatio,
  createProjectedOrbitGeometry,
  shouldSaveOrbitAttempt,
  type ProjectedOrbitGeometry,
} from './member4SceneLogic.js';

export interface OrbitGameSceneOptions {
  getSkinType: () => SkinType;
  store: UserStateStore;
  translate: (key: string) => string;
}

interface OrbitLayout {
  center: Point2D;
  referenceRadius: number;
  verticalScale: number;
  sunRadius: number;
  earthRadius: number;
}

const ACCENT = '#ffd35c';
const INNER_COLOR = '#61e7ff';
const OUTER_COLOR = '#ffbd62';
const COMPLETE_COLOR = '#73ffb4';
const TAU = Math.PI * 2;

export function createOrbitGameScene(
  options: OrbitGameSceneOptions,
): CanvasScene {
  let state = createGameState('earth');
  let runtimeContext: CanvasRuntimeContext | null = null;
  let dragOffsetX: number | null = null;
  let dragging = false;
  let resultSaved = false;
  let buttons: SceneButton[] = [];

  const resetAttempt = (): void => {
    state = resetGame(state);
    dragOffsetX = null;
    dragging = false;
    resultSaved = false;
    runtimeContext?.invalidate();
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (!runtimeContext) return;
    const point = getCanvasPoint(runtimeContext.canvas, event);
    const resetButton = hitButton(buttons, point);
    if (resetButton?.id === 'reset') {
      resetAttempt();
      return;
    }

    const viewport = runtimeContext.getViewport();
    const layout = getOrbitLayout(viewport);
    const earth = getCurrentOrbit(layout, state).body;
    const hitRadius = Math.max(28, layout.earthRadius * 1.7);
    if (Math.hypot(point.x - earth.x, point.y - earth.y) > hitRadius) {
      return;
    }

    dragOffsetX = point.x - earth.x;
    dragging = true;
    runtimeContext.canvas.setPointerCapture?.(event.pointerId);
    runtimeContext.canvas.style.cursor = 'grabbing';
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (!runtimeContext) return;
    const point = getCanvasPoint(runtimeContext.canvas, event);
    if (dragging && dragOffsetX !== null) {
      const layout = getOrbitLayout(runtimeContext.getViewport());
      const targetX = point.x - dragOffsetX;
      state = setOrbitRadius(
        state,
        calculateOrbitRadiusRatio(
          targetX,
          layout.center.x,
          layout.referenceRadius,
        ),
      );
      runtimeContext.invalidate();
      return;
    }

    const layout = getOrbitLayout(runtimeContext.getViewport());
    const earth = getCurrentOrbit(layout, state).body;
    const overEarth =
      Math.hypot(point.x - earth.x, point.y - earth.y) <=
      Math.max(28, layout.earthRadius * 1.7);
    runtimeContext.canvas.style.cursor =
      overEarth || hitButton(buttons, point) ? 'grab' : 'default';
  };

  const finishAttempt = (event: PointerEvent): void => {
    if (!runtimeContext || !dragging) return;
    dragging = false;
    dragOffsetX = null;
    runtimeContext.canvas.releasePointerCapture?.(event.pointerId);
    runtimeContext.canvas.style.cursor = 'grab';

    if (shouldSaveOrbitAttempt(state.completed, resultSaved)) {
      const saved = saveOrbitGameResult(state, options.store);
      resultSaved = true;
      if (saved.result.success) {
        options.store.markTaskCompleted('orbit-radius-inner-outer');
      }
    }
    runtimeContext.invalidate();
  };

  return {
    id: 'orbit-game',

    enter(context) {
      runtimeContext = context;
      context.canvas.addEventListener('pointerdown', onPointerDown);
      context.canvas.addEventListener('pointermove', onPointerMove);
      context.canvas.addEventListener('pointerup', finishAttempt);
      context.canvas.addEventListener('pointercancel', finishAttempt);
      context.canvas.style.cursor = 'grab';
    },

    render(_frame, context) {
      const { width, height } = context.getViewport();
      const skinType = options.getSkinType();
      buttons = [createResetButton(width)];

      drawSpaceBackdrop(
        context.context2D,
        width,
        height,
        '#26384f',
        skinType,
      );
      drawSceneHeader(
        context.context2D,
        width,
        options.translate('game.title'),
        options.translate('game.instruction'),
        ACCENT,
      );
      drawToolbar(
        context.context2D,
        buttons,
        new Set(resultSaved ? ['reset'] : []),
        ACCENT,
      );
      drawOrbitRadiusLab(
        context.context2D,
        width,
        height,
        state,
        skinType,
        options.translate,
      );
    },

    reset(context) {
      resetAttempt();
      context.invalidate();
    },

    exit(context) {
      context.canvas.removeEventListener('pointerdown', onPointerDown);
      context.canvas.removeEventListener('pointermove', onPointerMove);
      context.canvas.removeEventListener('pointerup', finishAttempt);
      context.canvas.removeEventListener('pointercancel', finishAttempt);
      context.canvas.style.cursor = 'grab';
      runtimeContext = null;
      dragOffsetX = null;
      dragging = false;
      buttons = [];
    },
  };
}

function createResetButton(width: number): SceneButton {
  const buttonWidth = width < 620 ? 44 : 48;
  return {
    id: 'reset',
    label: '↻',
    x: width - buttonWidth - (width < 620 ? 12 : 24),
    y: width < 620 ? 72 : 78,
    width: buttonWidth,
    height: width < 620 ? 32 : 36,
  };
}

function drawOrbitRadiusLab(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: OrbitGameState,
  skinType: SkinType,
  translate: (key: string) => string,
): void {
  const layout = getOrbitLayout({ width, height, dpr: 1 });
  const referenceOrbit = createProjectedOrbitGeometry(
    layout.center,
    layout.referenceRadius,
    layout.verticalScale,
  );
  const currentOrbit = getCurrentOrbit(layout, state);
  const observation = calculateOrbitObservation(state.radiusRatio);
  const orbitColor = getOrbitColor(state.zone, state.completed);

  drawOrbit(ctx, referenceOrbit, 'rgba(205, 224, 255, 0.38)', [7, 7]);
  drawOrbit(ctx, currentOrbit, orbitColor, []);
  drawRadiusGuide(ctx, layout);
  drawSun(ctx, layout.center, layout.sunRadius, skinType);
  drawEarth(
    ctx,
    currentOrbit.body,
    layout.earthRadius,
    skinType,
    state.completed,
  );
  drawBodyLabel(
    ctx,
    translate('solarWind.sun'),
    layout.center.x,
    layout.center.y + layout.sunRadius + 12,
  );
  drawBodyLabel(
    ctx,
    translate('solarWind.earth'),
    currentOrbit.body.x,
    currentOrbit.body.y + layout.earthRadius + 12,
  );

  const compact = width < 620;
  const chipX = compact ? 14 : 28;
  const period = observation.periodRatio.toFixed(2);
  const radius = observation.radiusRatio.toFixed(2);
  drawInfoChip(
    ctx,
    `${translate('game.distance')}: ${radius} AU · ${translate('game.period')}: ${period} ${translate('game.year')}`,
    chipX,
    height - (compact ? 119 : 132),
    orbitColor,
  );
  drawInfoChip(
    ctx,
    `${translate(`game.speed.${getSpeedKey(state.zone)}`)} · ${getProgressMessage(state, translate)}`,
    chipX,
    height - (compact ? 82 : 94),
    state.completed ? COMPLETE_COLOR : ACCENT,
  );
  drawInfoChip(
    ctx,
    translate('game.modelNote'),
    chipX,
    height - (compact ? 45 : 56),
    '#9db9ff',
  );
}

function drawOrbit(
  ctx: CanvasRenderingContext2D,
  orbit: Readonly<ProjectedOrbitGeometry>,
  color: string,
  dash: number[],
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.ellipse(
    orbit.center.x,
    orbit.center.y,
    orbit.radiusX,
    orbit.radiusY,
    0,
    0,
    TAU,
  );
  ctx.stroke();
  ctx.restore();
}

function drawRadiusGuide(
  ctx: CanvasRenderingContext2D,
  layout: OrbitLayout,
): void {
  const minX =
    layout.center.x + layout.referenceRadius * MIN_ORBIT_RADIUS_RATIO;
  const maxX =
    layout.center.x + layout.referenceRadius * MAX_ORBIT_RADIUS_RATIO;
  const y = layout.center.y;

  ctx.save();
  ctx.strokeStyle = 'rgba(214, 227, 255, 0.3)';
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 5]);
  ctx.beginPath();
  ctx.moveTo(minX, y);
  ctx.lineTo(maxX, y);
  ctx.stroke();

  ctx.setLineDash([]);
  const markers: Array<{ ratio: number; color: string }> = [
    { ratio: 0.74, color: INNER_COLOR },
    { ratio: 1, color: '#d7e4ff' },
    { ratio: 1.26, color: OUTER_COLOR },
  ];
  for (const marker of markers) {
    const x = layout.center.x + layout.referenceRadius * marker.ratio;
    ctx.fillStyle = marker.color;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawSun(
  ctx: CanvasRenderingContext2D,
  center: Point2D,
  radius: number,
  skinType: SkinType,
): void {
  if (drawSkinnedBody(ctx, 'sun', skinType, center.x, center.y, radius)) {
    return;
  }
  ctx.fillStyle = '#ffc94a';
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius, 0, TAU);
  ctx.fill();
}

function drawEarth(
  ctx: CanvasRenderingContext2D,
  center: Point2D,
  radius: number,
  skinType: SkinType,
  completed: boolean,
): void {
  if (completed) {
    ctx.strokeStyle = COMPLETE_COLOR;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius * 1.45, 0, TAU);
    ctx.stroke();
  }
  if (drawSkinnedBody(ctx, 'earth', skinType, center.x, center.y, radius)) {
    return;
  }
  ctx.fillStyle = '#3a9be8';
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius, 0, TAU);
  ctx.fill();
}

function getOrbitLayout(
  viewport: Pick<CanvasViewport, 'width' | 'height' | 'dpr'>,
): OrbitLayout {
  const { width, height } = viewport;
  const compact = width < 620;
  const sceneWidth = compact ? width : width * 0.78;
  const center = {
    x: compact ? width * 0.5 : sceneWidth * 0.43,
    y: 112 + Math.max(180, height - 230) * 0.46,
  };
  const horizontalLimit = Math.min(
    center.x - (compact ? 22 : 42),
    sceneWidth - center.x - (compact ? 22 : 42),
  );
  const verticalLimit = Math.max(100, (height - 245) / 0.92);
  const maxRadius = Math.max(86, Math.min(horizontalLimit, verticalLimit));
  const referenceRadius = maxRadius / MAX_ORBIT_RADIUS_RATIO;
  const bodyScale = Math.min(width, height);

  return {
    center,
    referenceRadius,
    verticalScale: 0.42,
    sunRadius: Math.max(28, bodyScale * 0.055),
    earthRadius: Math.max(17, bodyScale * 0.028),
  };
}

function getCurrentOrbit(
  layout: OrbitLayout,
  state: Pick<OrbitGameState, 'radiusRatio'>,
): ProjectedOrbitGeometry {
  return createProjectedOrbitGeometry(
    layout.center,
    layout.referenceRadius * state.radiusRatio,
    layout.verticalScale,
  );
}

function getOrbitColor(zone: OrbitZone, completed: boolean): string {
  if (completed) return COMPLETE_COLOR;
  if (zone === 'inner') return INNER_COLOR;
  if (zone === 'outer') return OUTER_COLOR;
  return ACCENT;
}

function getSpeedKey(zone: OrbitZone): 'fast' | 'same' | 'slow' {
  if (zone === 'inner') return 'fast';
  if (zone === 'outer') return 'slow';
  return 'same';
}

function getProgressMessage(
  state: Pick<OrbitGameState, 'completed' | 'exploredZones'>,
  translate: (key: string) => string,
): string {
  if (state.completed) return translate('game.progress.complete');
  if (state.exploredZones.inner) return translate('game.progress.needOuter');
  if (state.exploredZones.outer) return translate('game.progress.needInner');
  return translate('game.progress.needBoth');
}
