import {
  createGameState,
  movePlanet,
  resetGame,
  saveOrbitGameResult,
  type OrbitGameState,
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
  GAME_COORDINATE_SPAN,
  normalizeOrbitDrag,
  shouldSaveOrbitAttempt,
} from './member4SceneLogic.js';

export interface OrbitGameSceneOptions {
  getSkinType: () => SkinType;
  store: UserStateStore;
  translate: (key: string) => string;
}

const ACCENT = '#ffd35c';
const TAU = Math.PI * 2;

export function createOrbitGameScene(
  options: OrbitGameSceneOptions,
): CanvasScene {
  let state = createGameState('earth', { x: 0, y: 0 });
  let runtimeContext: CanvasRuntimeContext | null = null;
  let dragStart: Point2D | null = null;
  let dragging = false;
  let resultSaved = false;
  let buttons: SceneButton[] = [];

  const resetAttempt = (): void => {
    state = resetGame(state);
    dragStart = null;
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
    const earth = getEarthScreenPosition(state, viewport);
    const hitRadius = Math.max(26, Math.min(viewport.width, viewport.height) * 0.06);
    if (Math.hypot(point.x - earth.x, point.y - earth.y) > hitRadius) {
      return;
    }

    dragStart = {
      x: point.x - gameToScreen(state.currentPosition.x, viewport),
      y: point.y - gameToScreen(state.currentPosition.y, viewport),
    };
    dragging = true;
    runtimeContext.canvas.setPointerCapture?.(event.pointerId);
    runtimeContext.canvas.style.cursor = 'grabbing';
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (!runtimeContext) return;
    const point = getCanvasPoint(runtimeContext.canvas, event);
    if (dragging && dragStart) {
      state = movePlanet(
        state,
        normalizeOrbitDrag(dragStart, point, runtimeContext.getViewport()),
      );
      runtimeContext.invalidate();
      return;
    }

    const viewport = runtimeContext.getViewport();
    const earth = getEarthScreenPosition(state, viewport);
    const overEarth =
      Math.hypot(point.x - earth.x, point.y - earth.y) <=
      Math.max(26, Math.min(viewport.width, viewport.height) * 0.06);
    runtimeContext.canvas.style.cursor =
      overEarth || hitButton(buttons, point) ? 'grab' : 'default';
  };

  const finishAttempt = (event: PointerEvent): void => {
    if (!runtimeContext || !dragging) return;
    dragging = false;
    dragStart = null;
    runtimeContext.canvas.releasePointerCapture?.(event.pointerId);
    runtimeContext.canvas.style.cursor = 'grab';

    if (shouldSaveOrbitAttempt(state.completed, resultSaved)) {
      const saved = saveOrbitGameResult(state, options.store);
      resultSaved = true;
      if (saved.result.success) {
        options.store.markTaskCompleted('orbit-game-large-change');
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
      drawOrbitGame(
        context.context2D,
        width,
        height,
        state,
        skinType,
        options.translate,
        options.store.loadUserState().gameRecord.bestScore,
        resultSaved,
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
      dragStart = null;
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

function drawOrbitGame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: OrbitGameState,
  skinType: SkinType,
  translate: (key: string) => string,
  bestScore: number,
  resultSaved: boolean,
): void {
  const viewport = { width, height };
  const compact = width < 620;
  const sun = getSunPosition(viewport);
  const earthStart = getEarthStartPosition(viewport);
  const earth = getEarthScreenPosition(state, viewport);
  const sunRadius = Math.max(30, Math.min(width, height) * 0.075);
  const earthRadius = Math.max(18, Math.min(width, height) * 0.038);

  drawOrbit(
    ctx,
    sun,
    earthStart,
    'rgba(205, 224, 255, 0.38)',
    [7, 7],
  );
  if (state.changeLevel !== 'stable') {
    drawOrbit(
      ctx,
      sun,
      earth,
      state.completed ? '#73ffb4' : ACCENT,
      [],
    );
  }
  drawDistanceGuide(ctx, earthStart, earth, state.completed);
  drawSun(ctx, sun, sunRadius, skinType);
  drawEarth(ctx, earth, earthRadius, skinType, state.completed);
  drawBodyLabel(ctx, translate('solarWind.sun'), sun.x, sun.y + sunRadius + 12);
  drawBodyLabel(ctx, translate('solarWind.earth'), earth.x, earth.y + earthRadius + 12);

  const status = translate(`game.change.${state.changeLevel}`);
  drawInfoChip(
    ctx,
    `${translate('game.score')}: ${state.score} · ${status}`,
    compact ? 14 : 28,
    height - (compact ? 82 : 96),
    state.completed ? '#73ffb4' : ACCENT,
  );
  drawInfoChip(
    ctx,
    resultSaved
      ? `${translate('game.saved')} · ${translate('game.best')}: ${bestScore}`
      : translate('hint.dragPlanet'),
    compact ? 14 : 28,
    height - (compact ? 45 : 57),
    '#61e7ff',
  );
}

function drawOrbit(
  ctx: CanvasRenderingContext2D,
  sun: Point2D,
  earth: Point2D,
  color: string,
  dash: number[],
): void {
  const radiusX = Math.max(55, Math.abs(earth.x - sun.x));
  const radiusY = Math.max(34, radiusX * 0.42 + Math.abs(earth.y - sun.y) * 0.25);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.ellipse(sun.x, sun.y, radiusX, radiusY, 0, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

function drawDistanceGuide(
  ctx: CanvasRenderingContext2D,
  start: Point2D,
  current: Point2D,
  completed: boolean,
): void {
  ctx.save();
  ctx.strokeStyle = completed ? '#73ffb4' : 'rgba(255, 211, 92, 0.75)';
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 5]);
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(current.x, current.y);
  ctx.stroke();
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
    ctx.strokeStyle = '#73ffb4';
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

function getSunPosition(viewport: Pick<CanvasViewport, 'width' | 'height'>): Point2D {
  return {
    x: viewport.width * (viewport.width < 620 ? 0.26 : 0.31),
    y: 120 + (viewport.height - 190) * 0.5,
  };
}

function getEarthStartPosition(
  viewport: Pick<CanvasViewport, 'width' | 'height'>,
): Point2D {
  const sun = getSunPosition(viewport);
  return {
    x: viewport.width * (viewport.width < 620 ? 0.72 : 0.7),
    y: sun.y,
  };
}

function getEarthScreenPosition(
  state: OrbitGameState,
  viewport: Pick<CanvasViewport, 'width' | 'height'>,
): Point2D {
  const start = getEarthStartPosition(viewport);
  return {
    x: start.x + gameToScreen(state.currentPosition.x, viewport),
    y: start.y + gameToScreen(state.currentPosition.y, viewport),
  };
}

function gameToScreen(
  value: number,
  viewport: Pick<CanvasViewport, 'width' | 'height'>,
): number {
  return value * Math.max(1, Math.min(viewport.width, viewport.height)) /
    GAME_COORDINATE_SPAN;
}
