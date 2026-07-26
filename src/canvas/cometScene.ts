import type { PlanetInfo } from '../ui/index.js';
import {
  drawSpace,
  drawSun,
  type PreviewCallbacks,
} from '../ui/solarSystemPreview.js';
import type {
  CanvasRuntimeContext,
  CanvasScene,
  CanvasViewport,
  Point2D,
} from './types.js';

export const HALLEY_ORBIT = {
  semiMajorAxisAU: 17.834,
  eccentricity: 0.96714,
  periodYears: 75.32,
  compressedPeriodSeconds: 48,
  argumentOfPerihelion: -0.42,
  initialMeanAnomaly: -0.24,
} as const;

export interface HalleyOrbitState {
  meanAnomaly: number;
  eccentricAnomaly: number;
  trueAnomaly: number;
  distanceAU: number;
  progress: number;
  positionAU: Point2D;
  velocityAUPerSecond: Point2D;
}

export interface CometTailAppearance {
  activity: number;
  length: number;
  width: number;
  opacity: number;
  coreColor: string;
  edgeColor: string;
}

type Star = { x: number; y: number; r: number; alpha: number };

type CometSceneState = {
  orbit: HalleyOrbitState;
  tail: CometTailAppearance;
  viewport: CanvasViewport;
  stars: Star[];
  showOrbit: boolean;
  hovered: boolean;
};

const FULL_TURN = Math.PI * 2;
const COMET_RADIUS = 10;
const ACTIVE_TAIL_DISTANCE_AU = 12;
/** 为教学画面压缩偏心率，避免近日点与太阳贴图重叠。 */
const VISUAL_ECCENTRICITY = 0.82;

const HALLEY_INFO: PlanetInfo = {
  id: 'comet',
  name: 'Halley’s Comet',
  nameCN: '哈雷彗星',
  emoji: '☄️',
  desc: '哈雷彗星沿高偏心率椭圆轨道运行，越靠近太阳，冰物质受热释放得越强，彗尾也越长、越明亮。',
  stats: [
    { label: '公转周期', value: '约 75.3 年' },
    { label: '近日点', value: '约 0.59 AU' },
    { label: '远日点', value: '约 35.1 AU' },
  ],
};

/** 模块5：哈雷彗星轨道、速度与动态彗尾场景。 */
export function createCometScene(callbacks: PreviewCallbacks): CanvasScene {
  const initialOrbit = getHalleyOrbitState(0);
  const state: CometSceneState = {
    orbit: initialOrbit,
    tail: getCometTailAppearance(initialOrbit.distanceAU),
    viewport: { width: 1, height: 1, dpr: 1 },
    stars: createStars(180),
    showOrbit: true,
    hovered: false,
  };

  let toggleOrbitsHandler: EventListener | null = null;
  let pointerMoveHandler: ((event: PointerEvent) => void) | null = null;
  let pointerLeaveHandler: (() => void) | null = null;
  let clickHandler: (() => void) | null = null;

  return {
    id: 'comet',

    enter(runtimeContext) {
      state.showOrbit =
        document
          .getElementById('btn-toggle-orbits')
          ?.getAttribute('aria-pressed') !== 'false';
      state.hovered = false;
      runtimeContext.camera.reset();
      updateState(runtimeContext, state, 0);
      centerCameraOnOrbit(runtimeContext, state.viewport);
      callbacks.updatePanel(HALLEY_INFO);

      toggleOrbitsHandler = event => {
        const visible = (
          event as CustomEvent<{ visible?: boolean }>
        ).detail?.visible;
        state.showOrbit =
          visible === undefined ? !state.showOrbit : visible;
        runtimeContext.invalidate();
      };
      document.addEventListener(
        'solarkids:toggleOrbits',
        toggleOrbitsHandler
      );

      pointerMoveHandler = event => {
        const hovered = isCometHit(event, runtimeContext);
        if (hovered === state.hovered) return;
        state.hovered = hovered;
        runtimeContext.canvas.style.cursor = hovered ? 'pointer' : 'grab';
        runtimeContext.invalidate();
      };
      pointerLeaveHandler = () => {
        state.hovered = false;
        runtimeContext.canvas.style.cursor = 'grab';
        runtimeContext.invalidate();
      };
      clickHandler = () => {
        if (!state.hovered) return;
        callbacks.updatePanel(toLiveHalleyInfo(state.orbit, state.tail));
        callbacks.showToast(
          `☄️ 当前距太阳 ${state.orbit.distanceAU.toFixed(2)} AU`
        );
        document.dispatchEvent(
          new CustomEvent('solarkids:bodySelected', {
            detail: { bodyId: 'comet', sceneId: 'comet' },
          })
        );
      };

      runtimeContext.canvas.addEventListener(
        'pointermove',
        pointerMoveHandler
      );
      runtimeContext.canvas.addEventListener(
        'pointerleave',
        pointerLeaveHandler
      );
      runtimeContext.canvas.addEventListener('click', clickHandler);
      runtimeContext.canvas.style.cursor = 'grab';
    },

    update(frame, runtimeContext) {
      updateState(runtimeContext, state, frame.elapsedMs);
    },

    render(frame, runtimeContext) {
      renderCometScene(runtimeContext, state, frame.timeScale);
    },

    resize(viewport, runtimeContext) {
      state.viewport = { ...viewport };
      publishComet(runtimeContext, state);
      centerCameraOnOrbit(runtimeContext, state.viewport);
    },

    reset(runtimeContext) {
      state.hovered = false;
      updateState(runtimeContext, state, 0);
      centerCameraOnOrbit(runtimeContext, state.viewport);
      callbacks.updatePanel(HALLEY_INFO);
    },

    exit(runtimeContext) {
      if (toggleOrbitsHandler) {
        document.removeEventListener(
          'solarkids:toggleOrbits',
          toggleOrbitsHandler
        );
      }
      if (pointerMoveHandler) {
        runtimeContext.canvas.removeEventListener(
          'pointermove',
          pointerMoveHandler
        );
      }
      if (pointerLeaveHandler) {
        runtimeContext.canvas.removeEventListener(
          'pointerleave',
          pointerLeaveHandler
        );
      }
      if (clickHandler) {
        runtimeContext.canvas.removeEventListener('click', clickHandler);
      }
      runtimeContext.canvas.style.cursor = '';
      runtimeContext.world.removeBody('comet');
      toggleOrbitsHandler = null;
      pointerMoveHandler = null;
      pointerLeaveHandler = null;
      clickHandler = null;
    },
  };
}

/**
 * 使用开普勒方程计算哈雷彗星在压缩教学时间中的轨道状态。
 * elapsedMs 已包含公共动画时钟的时间倍率。
 */
export function getHalleyOrbitState(elapsedMs: number): HalleyOrbitState {
  const elapsedSeconds = Math.max(0, elapsedMs) / 1000;
  const progress =
    (elapsedSeconds / HALLEY_ORBIT.compressedPeriodSeconds) % 1;
  const meanAnomaly = normalizeSignedAngle(
    HALLEY_ORBIT.initialMeanAnomaly + progress * FULL_TURN
  );
  const eccentricAnomaly = solveKeplerEquation(
    meanAnomaly,
    HALLEY_ORBIT.eccentricity
  );
  const { semiMajorAxisAU: a, eccentricity: e } = HALLEY_ORBIT;
  const b = a * Math.sqrt(1 - e * e);
  const distanceAU = a * (1 - e * Math.cos(eccentricAnomaly));
  const positionAU = {
    x: a * (Math.cos(eccentricAnomaly) - e),
    y: b * Math.sin(eccentricAnomaly),
  };

  const meanMotion = FULL_TURN / HALLEY_ORBIT.compressedPeriodSeconds;
  const eccentricAnomalySpeed =
    meanMotion / (1 - e * Math.cos(eccentricAnomaly));
  const velocityAUPerSecond = {
    x: -a * Math.sin(eccentricAnomaly) * eccentricAnomalySpeed,
    y: b * Math.cos(eccentricAnomaly) * eccentricAnomalySpeed,
  };
  const trueAnomaly = Math.atan2(positionAU.y, positionAU.x);

  return {
    meanAnomaly,
    eccentricAnomaly,
    trueAnomaly,
    distanceAU,
    progress,
    positionAU,
    velocityAUPerSecond,
  };
}

/** Newton 迭代求解 M = E - e sin(E)。 */
export function solveKeplerEquation(
  meanAnomaly: number,
  eccentricity: number
): number {
  if (!Number.isFinite(meanAnomaly)) {
    throw new RangeError('meanAnomaly must be finite');
  }
  if (
    !Number.isFinite(eccentricity) ||
    eccentricity < 0 ||
    eccentricity >= 1
  ) {
    throw new RangeError('eccentricity must be in [0, 1)');
  }

  const normalizedMeanAnomaly = normalizeSignedAngle(meanAnomaly);
  let eccentricAnomaly =
    eccentricity < 0.8
      ? normalizedMeanAnomaly
      : Math.sign(normalizedMeanAnomaly || 1) * Math.PI;

  for (let index = 0; index < 16; index += 1) {
    const residual =
      eccentricAnomaly -
      eccentricity * Math.sin(eccentricAnomaly) -
      normalizedMeanAnomaly;
    const derivative =
      1 - eccentricity * Math.cos(eccentricAnomaly);
    const correction = residual / derivative;
    eccentricAnomaly -= correction;
    if (Math.abs(correction) < 1e-10) break;
  }
  return eccentricAnomaly;
}

/** 根据日彗距离计算彗尾的长度、宽度、亮度和颜色。 */
export function getCometTailAppearance(
  distanceAU: number
): CometTailAppearance {
  const perihelionAU =
    HALLEY_ORBIT.semiMajorAxisAU * (1 - HALLEY_ORBIT.eccentricity);
  const normalizedProximity =
    1 -
    clamp(
      (Math.max(perihelionAU, distanceAU) - perihelionAU) /
        (ACTIVE_TAIL_DISTANCE_AU - perihelionAU),
      0,
      1
    );
  const activity = smoothStep(normalizedProximity);
  const warmColor = [255, 244, 194] as const;
  const coldColor = [83, 157, 255] as const;
  const edgeWarm = [107, 224, 255] as const;
  const edgeCold = [45, 92, 185] as const;

  return {
    activity,
    length: lerp(20, 174, activity),
    width: lerp(6, 30, activity),
    opacity: lerp(0.2, 0.88, activity),
    coreColor: toRgb(interpolateColor(coldColor, warmColor, activity)),
    edgeColor: toRgb(interpolateColor(edgeCold, edgeWarm, activity)),
  };
}

function updateState(
  runtimeContext: CanvasRuntimeContext,
  state: CometSceneState,
  elapsedMs: number
): void {
  state.orbit = getHalleyOrbitState(elapsedMs);
  state.tail = getCometTailAppearance(state.orbit.distanceAU);
  publishComet(runtimeContext, state);
}

function publishComet(
  runtimeContext: CanvasRuntimeContext,
  state: CometSceneState
): void {
  const visualSemiMajorAxis = getOrbitScale(state.viewport);
  const visualSemiMinorAxis =
    visualSemiMajorAxis *
    Math.sqrt(1 - VISUAL_ECCENTRICITY * VISUAL_ECCENTRICITY);
  const position = rotatePoint(
    {
      x:
        visualSemiMajorAxis *
        (Math.cos(state.orbit.eccentricAnomaly) - VISUAL_ECCENTRICITY),
      y:
        visualSemiMinorAxis *
        Math.sin(state.orbit.eccentricAnomaly),
    },
    HALLEY_ORBIT.argumentOfPerihelion
  );
  const eccentricAnomalySpeed =
    FULL_TURN /
    HALLEY_ORBIT.compressedPeriodSeconds /
    (1 -
      HALLEY_ORBIT.eccentricity *
        Math.cos(state.orbit.eccentricAnomaly));
  const velocity = rotatePoint(
    {
      x:
        -visualSemiMajorAxis *
        Math.sin(state.orbit.eccentricAnomaly) *
        eccentricAnomalySpeed,
      y:
        visualSemiMinorAxis *
        Math.cos(state.orbit.eccentricAnomaly) *
        eccentricAnomalySpeed,
    },
    HALLEY_ORBIT.argumentOfPerihelion
  );

  runtimeContext.world.setBody({
    id: 'comet',
    position,
    velocity,
    displayPosition: { ...position },
    displayVelocity: { ...velocity },
    rotation: Math.atan2(velocity.y, velocity.x),
    orbitAngle: state.orbit.trueAnomaly,
    radius: COMET_RADIUS,
    visible: true,
    metadata: {
      nameCN: '哈雷彗星',
      distanceAU: state.orbit.distanceAU,
      orbitProgress: state.orbit.progress,
      eccentricity: HALLEY_ORBIT.eccentricity,
      periodYears: HALLEY_ORBIT.periodYears,
      compressedPeriodSeconds: HALLEY_ORBIT.compressedPeriodSeconds,
      visualEccentricity: VISUAL_ECCENTRICITY,
      tailActivity: state.tail.activity,
      tailLength: state.tail.length,
      tailColor: state.tail.coreColor,
    },
  });
}

function renderCometScene(
  runtimeContext: CanvasRuntimeContext,
  state: CometSceneState,
  timeScale: number
): void {
  const { context2D, camera } = runtimeContext;
  const { width, height } = state.viewport;
  drawSpace(context2D, width, height, state.stars, {
    zoom: camera.state.zoom,
    rotation: camera.state.rotation,
    position: camera.state.position,
  });

  context2D.save();
  camera.applyTransform(context2D);
  const semiMajorAxis = getOrbitScale(state.viewport);
  const semiMinorAxis =
    semiMajorAxis *
    Math.sqrt(1 - VISUAL_ECCENTRICITY * VISUAL_ECCENTRICITY);
  if (state.showOrbit) {
    drawOrbit(context2D, semiMajorAxis, semiMinorAxis);
  }
  drawSun(context2D, { x: 0, y: 0 }, 0.92);

  const comet = runtimeContext.world.getBody('comet');
  if (comet) {
    drawDynamicComet(
      context2D,
      comet.position,
      COMET_RADIUS,
      state.tail,
      state.hovered,
      state.orbit.progress
    );
  }
  context2D.restore();

  drawStatusPanel(context2D, state, timeScale);
}

function drawOrbit(
  context2D: CanvasRenderingContext2D,
  semiMajorAxis: number,
  semiMinorAxis: number
): void {
  context2D.save();
  context2D.strokeStyle = 'rgba(91, 192, 235, 0.46)';
  context2D.lineWidth = 1.5;
  context2D.setLineDash([8, 9]);
  const orbitCenter = rotatePoint(
    { x: -semiMajorAxis * VISUAL_ECCENTRICITY, y: 0 },
    HALLEY_ORBIT.argumentOfPerihelion
  );
  context2D.beginPath();
  context2D.ellipse(
    orbitCenter.x,
    orbitCenter.y,
    semiMajorAxis,
    semiMinorAxis,
    HALLEY_ORBIT.argumentOfPerihelion,
    0,
    FULL_TURN
  );
  context2D.stroke();
  context2D.setLineDash([]);

  const perihelion = rotatePoint(
    {
      x: semiMajorAxis * (1 - VISUAL_ECCENTRICITY),
      y: 0,
    },
    HALLEY_ORBIT.argumentOfPerihelion
  );
  const aphelion = rotatePoint(
    {
      x: -semiMajorAxis * (1 + VISUAL_ECCENTRICITY),
      y: 0,
    },
    HALLEY_ORBIT.argumentOfPerihelion
  );
  drawOrbitMarker(context2D, perihelion, '近日点 0.59 AU');
  drawOrbitMarker(context2D, aphelion, '远日点 35.1 AU');
  context2D.restore();
}

function drawOrbitMarker(
  context2D: CanvasRenderingContext2D,
  point: Point2D,
  label: string
): void {
  context2D.fillStyle = 'rgba(233, 251, 255, 0.85)';
  context2D.beginPath();
  context2D.arc(point.x, point.y, 3, 0, FULL_TURN);
  context2D.fill();
  context2D.font =
    '600 11px "PingFang SC", "Microsoft YaHei", sans-serif';
  context2D.textAlign = point.x < 0 ? 'right' : 'left';
  context2D.textBaseline = 'bottom';
  context2D.fillText(
    label,
    point.x + (point.x < 0 ? -7 : 7),
    point.y - 5
  );
}

function drawDynamicComet(
  context2D: CanvasRenderingContext2D,
  position: Point2D,
  radius: number,
  tail: CometTailAppearance,
  hovered: boolean,
  progress: number
): void {
  const awayFromSunAngle = Math.atan2(position.y, position.x);
  context2D.save();
  context2D.translate(position.x, position.y);
  context2D.rotate(awayFromSunAngle);

  const gradient = context2D.createLinearGradient(
    radius * 0.2,
    0,
    tail.length,
    0
  );
  gradient.addColorStop(
    0,
    withAlpha(tail.coreColor, tail.opacity)
  );
  gradient.addColorStop(
    0.42,
    withAlpha(tail.edgeColor, tail.opacity * 0.46)
  );
  gradient.addColorStop(1, withAlpha(tail.edgeColor, 0));
  context2D.fillStyle = gradient;
  context2D.beginPath();
  context2D.moveTo(radius * 0.2, -tail.width * 0.42);
  context2D.quadraticCurveTo(
    tail.length * 0.5,
    -tail.width,
    tail.length,
    Math.sin(progress * FULL_TURN) * tail.width * 0.18
  );
  context2D.quadraticCurveTo(
    tail.length * 0.48,
    tail.width,
    radius * 0.2,
    tail.width * 0.42
  );
  context2D.closePath();
  context2D.fill();

  drawTailStreaks(context2D, radius, tail, progress);

  const coma = context2D.createRadialGradient(
    -radius * 0.25,
    -radius * 0.25,
    1,
    0,
    0,
    radius * 2.2
  );
  coma.addColorStop(0, 'rgba(255, 255, 255, 0.96)');
  coma.addColorStop(
    0.35,
    withAlpha(tail.coreColor, 0.72 + tail.activity * 0.2)
  );
  coma.addColorStop(1, withAlpha(tail.edgeColor, 0));
  context2D.fillStyle = coma;
  context2D.beginPath();
  context2D.arc(0, 0, radius * 2.2, 0, FULL_TURN);
  context2D.fill();

  const nucleus = context2D.createRadialGradient(
    -radius * 0.35,
    -radius * 0.35,
    1,
    0,
    0,
    radius
  );
  nucleus.addColorStop(0, '#ffffff');
  nucleus.addColorStop(0.4, '#d9eef2');
  nucleus.addColorStop(1, '#49636b');
  context2D.fillStyle = nucleus;
  context2D.beginPath();
  context2D.arc(0, 0, radius, 0, FULL_TURN);
  context2D.fill();

  if (hovered) {
    context2D.strokeStyle = '#f7c948';
    context2D.lineWidth = 3;
    context2D.beginPath();
    context2D.arc(0, 0, radius + 8, 0, FULL_TURN);
    context2D.stroke();
  }
  context2D.restore();
}

function drawTailStreaks(
  context2D: CanvasRenderingContext2D,
  radius: number,
  tail: CometTailAppearance,
  progress: number
): void {
  context2D.save();
  context2D.lineCap = 'round';
  for (let index = 0; index < 5; index += 1) {
    const offset =
      ((index - 2) / 2) * tail.width * 0.34;
    const shimmer =
      Math.sin(progress * FULL_TURN * 3 + index * 1.7) *
      tail.width *
      0.12;
    context2D.strokeStyle = withAlpha(
      index % 2 === 0 ? tail.coreColor : tail.edgeColor,
      tail.opacity * (0.2 + index * 0.045)
    );
    context2D.lineWidth = Math.max(0.7, 1.5 - index * 0.12);
    context2D.beginPath();
    context2D.moveTo(radius * 0.6, offset);
    context2D.quadraticCurveTo(
      tail.length * 0.46,
      offset + shimmer,
      tail.length * (0.65 + index * 0.055),
      offset * 0.3
    );
    context2D.stroke();
  }
  context2D.restore();
}

function drawStatusPanel(
  context2D: CanvasRenderingContext2D,
  state: CometSceneState,
  timeScale: number
): void {
  const compact = state.viewport.width < 560;
  const x = compact ? 14 : 22;
  const y = compact ? 14 : 22;
  const width = compact ? Math.min(250, state.viewport.width - 28) : 270;
  const height = 88;

  context2D.save();
  context2D.fillStyle = 'rgba(5, 8, 21, 0.78)';
  context2D.strokeStyle = 'rgba(91, 192, 235, 0.35)';
  context2D.lineWidth = 1;
  context2D.beginPath();
  addRoundedRectanglePath(context2D, x, y, width, height, 12);
  context2D.fill();
  context2D.stroke();

  context2D.fillStyle = '#f4f7ff';
  context2D.font =
    '700 14px "PingFang SC", "Microsoft YaHei", sans-serif';
  context2D.textAlign = 'left';
  context2D.fillText('☄️ 哈雷彗星实时状态', x + 14, y + 23);
  context2D.fillStyle = '#c4d0e8';
  context2D.font =
    '12px "PingFang SC", "Microsoft YaHei", sans-serif';
  context2D.fillText(
    `距太阳：${state.orbit.distanceAU.toFixed(2)} AU`,
    x + 14,
    y + 46
  );
  context2D.fillText(
    `彗尾活跃度：${Math.round(state.tail.activity * 100)}%`,
    x + 14,
    y + 66
  );
  context2D.fillText(
    `时间倍率：${formatTimeScale(timeScale)}`,
    x + width - 104,
    y + 66
  );
  context2D.restore();
}

function isCometHit(
  event: PointerEvent,
  runtimeContext: CanvasRuntimeContext
): boolean {
  const comet = runtimeContext.world.getBody('comet');
  if (!comet) return false;
  const rect = runtimeContext.canvas.getBoundingClientRect();
  const point = runtimeContext.camera.screenToWorld({
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  });
  return (
    Math.hypot(
      point.x - comet.position.x,
      point.y - comet.position.y
    ) <=
    COMET_RADIUS + 14
  );
}

function toLiveHalleyInfo(
  orbit: HalleyOrbitState,
  tail: CometTailAppearance
): PlanetInfo {
  return {
    ...HALLEY_INFO,
    stats: [
      {
        label: '当前距离',
        value: `${orbit.distanceAU.toFixed(2)} AU`,
      },
      {
        label: '彗尾活跃度',
        value: `${Math.round(tail.activity * 100)}%`,
      },
      {
        label: '轨道进度',
        value: `${Math.round(orbit.progress * 100)}%`,
      },
    ],
  };
}

function getOrbitScale(viewport: Readonly<CanvasViewport>): number {
  const horizontalFit = viewport.width * 0.42;
  const verticalFit = viewport.height * 0.68;
  return clamp(Math.min(horizontalFit, verticalFit), 112, 330);
}

function centerCameraOnOrbit(
  runtimeContext: CanvasRuntimeContext,
  viewport: Readonly<CanvasViewport>
): void {
  const semiMajorAxis = getOrbitScale(viewport);
  const orbitCenter = rotatePoint(
    { x: -semiMajorAxis * VISUAL_ECCENTRICITY, y: 0 },
    HALLEY_ORBIT.argumentOfPerihelion
  );
  runtimeContext.camera.setState({
    position: orbitCenter,
    mode: 'overview',
    focusTargetId: null,
  });
}

function rotatePoint(point: Point2D, radians: number): Point2D {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  };
}

function createStars(count: number): Star[] {
  return Array.from({ length: count }, (_, index) => ({
    x: (Math.sin(index * 43.17) * 0.5 + 0.5) % 1,
    y: (Math.cos(index * 31.91) * 0.5 + 0.5) % 1,
    r: 0.6 + ((index * 17) % 9) / 10,
    alpha: 0.22 + ((index * 29) % 55) / 100,
  }));
}

function normalizeSignedAngle(angle: number): number {
  return ((angle + Math.PI) % FULL_TURN + FULL_TURN) % FULL_TURN - Math.PI;
}

function smoothStep(value: number): number {
  const clamped = clamp(value, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
}

function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}

function interpolateColor(
  start: readonly [number, number, number],
  end: readonly [number, number, number],
  amount: number
): [number, number, number] {
  return [
    Math.round(lerp(start[0], end[0], amount)),
    Math.round(lerp(start[1], end[1], amount)),
    Math.round(lerp(start[2], end[2], amount)),
  ];
}

function toRgb(color: readonly [number, number, number]): string {
  return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
}

function withAlpha(color: string, alpha: number): string {
  const components = color.match(/\d+/g);
  if (!components || components.length < 3) {
    return color;
  }
  return `rgba(${components[0]}, ${components[1]}, ${components[2]}, ${clamp(alpha, 0, 1)})`;
}

function formatTimeScale(timeScale: number): string {
  return `${Number(timeScale.toFixed(2))}×`;
}

function addRoundedRectanglePath(
  context2D: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  const cornerRadius = Math.min(radius, width / 2, height / 2);
  context2D.moveTo(x + cornerRadius, y);
  context2D.lineTo(x + width - cornerRadius, y);
  context2D.quadraticCurveTo(
    x + width,
    y,
    x + width,
    y + cornerRadius
  );
  context2D.lineTo(x + width, y + height - cornerRadius);
  context2D.quadraticCurveTo(
    x + width,
    y + height,
    x + width - cornerRadius,
    y + height
  );
  context2D.lineTo(x + cornerRadius, y + height);
  context2D.quadraticCurveTo(
    x,
    y + height,
    x,
    y + height - cornerRadius
  );
  context2D.lineTo(x, y + cornerRadius);
  context2D.quadraticCurveTo(x, y, x + cornerRadius, y);
  context2D.closePath();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
