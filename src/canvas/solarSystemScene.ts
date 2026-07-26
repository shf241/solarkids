import type { PlanetInfo } from '../ui/index.js';
import type { SkinType } from '../ui/assetLoader.js';
import {
  PLANETS,
  drawHint,
  drawPlanet,
  drawSaturnRingBack,
  drawSaturnRingFront,
  drawSpace,
  drawSun,
  getCompressedOrbit,
  getResponsiveOrbitScale,
  getSkinType,
  type PlanetPreview,
  type PreviewCallbacks,
} from '../ui/solarSystemPreview.js';
import type {
  CanvasRuntimeContext,
  CanvasScene,
  CelestialBodyState,
  Point2D,
  Point3D,
} from './types.js';
import {
  getEarthObserverHorizonY,
  getObserverLatitude,
  getObserverSiderealAngle,
  projectBodyToEarthSky,
} from './EarthObserverView.js';
import { EquirectangularPlanetRenderer } from './EquirectangularPlanetRenderer.js';
import { SaturnRingRenderer } from './SaturnRingRenderer.js';

type SolarSystemBody = {
  id: string;
  position: Point2D;
  position3D: Point3D;
  velocity: Point2D;
  displayPosition: Point2D;
  displayVelocity: Point2D;
  rotation: number;
  orbitAngle?: number;
  radius: number;
  visible: boolean;
  metadata: Readonly<Record<string, unknown>>;
};

type OrbitKind = 'earth' | 'moon';

type Quaternion = {
  x: number;
  y: number;
  z: number;
  w: number;
};

type SolarSystemSceneState = {
  angles: Map<string, number>;
  elapsedMs: number;
  selectedId: string;
  hoveredId: string | null;
  hoveredOrbit: OrbitKind | null;
  hoverScreenPoint: Point2D | null;
  visitingBodyId: string | null;
  visitTransitionProgress: number;
  visitStartScreenRadius: number;
  visitReferenceZoom: number;
  viewOrientation: Quaternion;
  showOrbits: boolean;
  stars: { x: number; y: number; r: number; alpha: number }[];
  viewport: { width: number; height: number; dpr: number };
  textureRenderers: Readonly<
    Record<SkinType, ReadonlyMap<string, EquirectangularPlanetRenderer>>
  >;
  saturnRingRenderers: Readonly<
    Record<SkinType, SaturnRingRenderer>
  >;
};

/** 教学压缩时间：地球完成一周公转需要 36 秒。 */
const EARTH_YEAR_SECONDS = 36;
const VISIT_REFERENCE_ZOOM = 3.6;
const EARTH_YEAR_DAYS = 365.256;
const MOON_ORBIT_PERIOD_DAYS = 27.3217;
const MOON_ORBIT_SPEED =
  (Math.PI * 2) /
  (EARTH_YEAR_SECONDS * (MOON_ORBIT_PERIOD_DAYS / EARTH_YEAR_DAYS));
/** 教学压缩时间：地球完成一周自转需要 2.4 秒。 */
const EARTH_ROTATION_SECONDS = 2.4;
/** 地表观察模式中，一昼夜压缩为 24 秒，便于观察天体升落。 */
const EARTH_OBSERVER_DAY_SECONDS = 24;
const DEFAULT_OBSERVER_LATITUDE_DEGREES = 35;
const EARTH_ORBIT_COLOR = '#35d6ff';
const MOON_ORBIT_COLOR = '#ffd166';
const ORBIT_PERIOD_YEARS: Record<string, number> = {
  mercury: 0.2408467,
  venus: 0.615197,
  earth: 1,
  mars: 1.8808,
  jupiter: 11.862,
  saturn: 29.457,
  uranus: 84.016,
  neptune: 164.8,
};
const ORBIT_INCLINATION_DEGREES: Record<string, number> = {
  mercury: 7.005,
  venus: 3.3947,
  earth: 0,
  mars: 1.8506,
  jupiter: 1.303,
  saturn: 2.485,
  uranus: 0.773,
  neptune: 1.77,
};
const ASCENDING_NODE_DEGREES: Record<string, number> = {
  mercury: 48.331,
  venus: 76.68,
  earth: 0,
  mars: 49.558,
  jupiter: 100.464,
  saturn: 113.665,
  uranus: 74.006,
  neptune: 131.784,
};
const MOON_ORBIT_INCLINATION_DEGREES = 5.145;
const MOON_ASCENDING_NODE_DEGREES = 125.08;
const MOON_DISTANCE_AU = 0.00257;
const ROTATION_PERIOD_DAYS: Record<string, number> = {
  sun: 25.38,
  mercury: 58.646,
  venus: -243.025,
  earth: 0.99726968,
  mars: 1.025957,
  jupiter: 0.41354,
  saturn: 0.444,
  uranus: -0.71833,
  neptune: 0.67125,
};
const AXIAL_TILT_DEGREES: Record<string, number> = {
  sun: 7.25,
  mercury: 0.034,
  venus: 177.36,
  earth: 23.44,
  moon: 6.68,
  mars: 25.19,
  jupiter: 3.13,
  saturn: 26.73,
  uranus: 97.77,
  neptune: 28.32,
};

const PLANET_BY_ID = new Map(PLANETS.map(planet => [planet.id, planet]));
const REALISTIC_TEXTURES: Readonly<Record<string, string>> = {
  sun: 'assets/skins/2k_sun.jpg',
  mercury: 'assets/skins/2k_mercury.jpg',
  venus: 'assets/skins/2k_venus_surface.jpg',
  earth: 'assets/skins/2k_earth_daymap.jpg',
  moon: 'assets/skins/2k_moon.jpg',
  mars: 'assets/skins/2k_mars.jpg',
  jupiter: 'assets/skins/2k_jupiter.jpg',
  saturn: 'assets/skins/2k_saturn.jpg',
  uranus: 'assets/skins/2k_uranus.jpg',
  neptune: 'assets/skins/2k_neptune.jpg',
};

const CARTOON_TEXTURES: Readonly<Record<string, string>> = {
  sun: 'assets/cartoon_skin/sun-cartoon.png',
  mercury: 'assets/cartoon_skin/mercury-cartoon.png',
  venus: 'assets/cartoon_skin/venus-cartoon.png',
  earth: 'assets/cartoon_skin/earth-cartoon.png',
  moon: 'assets/cartoon_skin/moon-cartoon.png',
  mars: 'assets/cartoon_skin/mars-cartoon.png',
  jupiter: 'assets/cartoon_skin/jupiter-cartoon.png',
  saturn: 'assets/cartoon_skin/saturn-cartoon.png',
  uranus: 'assets/cartoon_skin/uranus-cartoon.png',
  neptune: 'assets/cartoon_skin/neptune-cartoon.png',
};

function createTextureRenderers(
  textures: Readonly<Record<string, string>>
): ReadonlyMap<
  string,
  EquirectangularPlanetRenderer
> {
  return new Map(
    Object.entries(textures).map(([bodyId, textureSrc]) => [
      bodyId,
      new EquirectangularPlanetRenderer({
        textureSrc,
        rotationSpeed:
          bodyId === 'moon'
            ? MOON_ORBIT_SPEED
            : getSpinSpeed(bodyId),
        lightingModel: bodyId === 'sun' ? 'emissive' : 'diffuse',
      }),
    ])
  );
}

function getAllTextureRenderers(
  state: SolarSystemSceneState
): EquirectangularPlanetRenderer[] {
  return Object.values(state.textureRenderers).flatMap(
    renderers => [...renderers.values()]
  );
}

function getActiveTextureRenderer(
  state: SolarSystemSceneState,
  bodyId: string
): EquirectangularPlanetRenderer | null {
  return state.textureRenderers[getSkinType()].get(bodyId) ?? null;
}

function getActiveSaturnRingRenderer(
  state: SolarSystemSceneState
): SaturnRingRenderer {
  return state.saturnRingRenderers[getSkinType()];
}

/**
 * 模块1：太阳系总览场景。
 *
 * 该场景是天体状态的唯一写入方。其他专题只读取 runtime.world 中的快照。
 */
export function createSolarSystemScene(
  callbacks: PreviewCallbacks
): CanvasScene {
  const textureRenderers = {
    cartoon: createTextureRenderers(CARTOON_TEXTURES),
    realistic: createTextureRenderers(REALISTIC_TEXTURES),
  } satisfies Record<
    SkinType,
    ReadonlyMap<string, EquirectangularPlanetRenderer>
  >;
  const saturnRingRenderers = {
    cartoon: new SaturnRingRenderer({
      textureSrc:
        'assets/cartoon_skin/saturn-ring-cartoon.png',
      radialAxis: 'vertical',
    }),
    realistic: new SaturnRingRenderer({
      textureSrc: 'assets/skins/2k_saturn_ring_alpha.png',
      radialAxis: 'horizontal',
    }),
  } satisfies Record<SkinType, SaturnRingRenderer>;
  const state: SolarSystemSceneState = {
    angles: new Map(PLANETS.map(planet => [planet.id, planet.angle])),
    elapsedMs: 0,
    selectedId: 'earth',
    hoveredId: null,
    hoveredOrbit: null,
    hoverScreenPoint: null,
    visitingBodyId: null,
    visitTransitionProgress: 0,
    visitStartScreenRadius: 0,
    visitReferenceZoom: VISIT_REFERENCE_ZOOM,
    viewOrientation: identityQuaternion(),
    showOrbits: true,
    stars: createStars(180),
    viewport: { width: 1, height: 1, dpr: 1 },
    textureRenderers,
    saturnRingRenderers,
  };

  let skinChangeHandler: EventListener | null = null;
  let toggleOrbitsHandler: EventListener | null = null;
  let pointerMoveHandler: ((event: PointerEvent) => void) | null = null;
  let pointerLeaveHandler: (() => void) | null = null;
  let clickHandler: ((event: MouseEvent) => void) | null = null;
  let panelActionHandler: EventListener | null = null;
  let rotateVisitedBodyHandler: EventListener | null = null;
  let rotateSolarSystemHandler: EventListener | null = null;

  const scene: CanvasScene = {
    id: 'solar-system',

    enter(runtimeContext) {
      runtimeContext.camera.reset();
      state.angles = new Map(PLANETS.map(planet => [planet.id, planet.angle]));
      state.elapsedMs = 0;
      state.selectedId = 'earth';
      state.hoveredId = null;
      state.hoveredOrbit = null;
      state.hoverScreenPoint = null;
      state.visitingBodyId = null;
      state.visitTransitionProgress = 0;
      state.visitStartScreenRadius = 0;
      state.visitReferenceZoom = VISIT_REFERENCE_ZOOM;
      state.viewOrientation = identityQuaternion();
      delete runtimeContext.canvas.dataset.sphereRotationTarget;
      setSolarSystemArcball(runtimeContext.canvas, true);
      for (const renderer of getAllTextureRenderers(state)) {
        renderer.reset();
        renderer.setTextureReadyCallback(() => {
          runtimeContext.invalidate();
        });
      }
      for (const ringRenderer of Object.values(
        state.saturnRingRenderers
      )) {
        ringRenderer.setTextureReadyCallback(() => {
          runtimeContext.invalidate();
        });
      }
      state.showOrbits =
        document
          .getElementById('btn-toggle-orbits')
          ?.getAttribute('aria-pressed') !== 'false';
      publishBodies(runtimeContext, state, 0);
      callbacks.updatePanel(getBodySummaryInfo('earth'));

      skinChangeHandler = event => {
        const detail = (event as CustomEvent<{ skinConfig?: { type?: string } }>).detail;
        if (detail?.skinConfig?.type) {
          if (state.visitingBodyId) {
            setSphereRotationTarget(
              runtimeContext.canvas,
              state.visitingBodyId
            );
          }
          runtimeContext.invalidate();
        }
      };
      document.addEventListener('solarkids:skinChange', skinChangeHandler);

      toggleOrbitsHandler = event => {
        const visible = (
          event as CustomEvent<{ visible?: boolean }>
        ).detail?.visible;
        state.showOrbits =
          visible === undefined ? !state.showOrbits : visible;
        if (!state.showOrbits) {
          state.hoveredOrbit = null;
          state.hoverScreenPoint = null;
        }
        runtimeContext.invalidate();
      };
      document.addEventListener(
        'solarkids:toggleOrbits',
        toggleOrbitsHandler
      );

      panelActionHandler = event => {
        const detail = (
          event as CustomEvent<{
            actionId?: string;
            bodyId?: string;
          }>
        ).detail;
        const bodyId = detail?.bodyId;
        if (!bodyId || !getBodyPreview(bodyId)) return;
        if (detail.actionId === 'visit-body') {
          state.visitingBodyId = bodyId;
          state.selectedId = bodyId;
          state.visitTransitionProgress = 0;
          state.visitStartScreenRadius =
            getBodyBaseRadius(state, bodyId) *
            runtimeContext.camera.state.zoom;
          state.visitReferenceZoom = VISIT_REFERENCE_ZOOM;
          callbacks.updatePanel(getBodyDetailInfo(bodyId));
          setSolarSystemArcball(runtimeContext.canvas, false);
          setSphereRotationTarget(
            runtimeContext.canvas,
            bodyId,
            state.visitReferenceZoom
          );
          document.dispatchEvent(
            new CustomEvent('solarkids:visitBody', {
              detail: {
                bodyId,
                zoom: state.visitReferenceZoom,
              },
            })
          );
          callbacks.showToast(`🚀 正在接近${getBodyName(bodyId)}`);
        } else if (
          detail.actionId === 'leave-visit' &&
          state.visitingBodyId === bodyId
        ) {
          state.visitingBodyId = null;
          state.visitTransitionProgress = 0;
          callbacks.updatePanel(getBodySummaryInfo(bodyId));
          setSphereRotationTarget(runtimeContext.canvas, null);
          setSolarSystemArcball(runtimeContext.canvas, true);
          document.dispatchEvent(
            new CustomEvent('solarkids:leaveVisit', {
              detail: { bodyId },
            })
          );
        }
      };
      document.addEventListener(
        'solarkids:panelAction',
        panelActionHandler
      );

      rotateVisitedBodyHandler = event => {
        const detail = (
          event as CustomEvent<{
            bodyId?: string;
            from?: Point2D;
            to?: Point2D;
          }>
        ).detail;
        if (
          !detail?.bodyId ||
          state.visitingBodyId !== detail.bodyId
        ) {
          return;
        }
        if (detail.from && detail.to) {
          for (const renderers of Object.values(
            state.textureRenderers
          )) {
            renderers
              .get(detail.bodyId)
              ?.rotateTrackball(detail.from, detail.to);
          }
        }
        runtimeContext.invalidate();
      };
      document.addEventListener(
        'solarkids:rotateVisitedBody',
        rotateVisitedBodyHandler
      );

      rotateSolarSystemHandler = event => {
        const detail = (
          event as CustomEvent<{
            from?: Point2D;
            to?: Point2D;
          }>
        ).detail;
        if (
          state.visitingBodyId !== null ||
          runtimeContext.camera.state.mode !== 'overview' ||
          !detail?.from ||
          !detail.to
        ) {
          return;
        }
        const delta = quaternionFromTrackball(detail.from, detail.to);
        state.viewOrientation = normalizeQuaternion(
          multiplyQuaternions(delta, state.viewOrientation)
        );
        publishBodies(runtimeContext, state, state.elapsedMs);
        runtimeContext.invalidate();
      };
      document.addEventListener(
        'solarkids:rotateSolarSystem',
        rotateSolarSystemHandler
      );

      pointerMoveHandler = event => {
        const nextBody = pickBody(
          event.clientX,
          event.clientY,
          runtimeContext,
          state.visitingBodyId
        );
        const nextOrbit =
          nextBody === null &&
          state.showOrbits &&
          state.visitingBodyId === null
            ? pickOrbit(event.clientX, event.clientY, runtimeContext, state)
            : null;
        const rect = runtimeContext.canvas.getBoundingClientRect();
        const hoverScreenPoint =
          nextOrbit === null
            ? null
            : {
                x: event.clientX - rect.left,
                y: event.clientY - rect.top,
              };
        if (
          nextBody !== state.hoveredId ||
          nextOrbit !== state.hoveredOrbit ||
          nextOrbit !== null
        ) {
          state.hoveredId = nextBody;
          state.hoveredOrbit = nextOrbit;
          state.hoverScreenPoint = hoverScreenPoint;
          runtimeContext.canvas.style.cursor = nextBody
            ? 'pointer'
            : nextOrbit
              ? 'help'
              : 'grab';
          runtimeContext.invalidate();
        }
      };
      pointerLeaveHandler = () => {
        state.hoveredId = null;
        state.hoveredOrbit = null;
        state.hoverScreenPoint = null;
        runtimeContext.canvas.style.cursor = 'grab';
        runtimeContext.invalidate();
      };
      clickHandler = event => {
        const bodyId = pickBody(
          event.clientX,
          event.clientY,
          runtimeContext,
          state.visitingBodyId
        );
        if (!bodyId) return;
        if (state.visitingBodyId && bodyId !== state.visitingBodyId) {
          const previousBodyId = state.visitingBodyId;
          state.visitingBodyId = null;
          state.visitTransitionProgress = 0;
          setSphereRotationTarget(runtimeContext.canvas, null);
          setSolarSystemArcball(runtimeContext.canvas, true);
          document.dispatchEvent(
            new CustomEvent('solarkids:leaveVisit', {
              detail: { bodyId: previousBodyId },
            })
          );
        }
        state.selectedId = bodyId;
        callbacks.updatePanel(
          state.visitingBodyId === bodyId
            ? getBodyDetailInfo(bodyId)
            : getBodySummaryInfo(bodyId)
        );
        callbacks.showToast(`你发现了${getBodyName(bodyId)}`);
        document.dispatchEvent(
          new CustomEvent('solarkids:bodySelected', {
            detail: { bodyId, sceneId: scene.id },
          })
        );
        runtimeContext.invalidate();
      };

      runtimeContext.canvas.addEventListener('pointermove', pointerMoveHandler);
      runtimeContext.canvas.addEventListener('pointerleave', pointerLeaveHandler);
      runtimeContext.canvas.addEventListener('click', clickHandler);
    },

    update(frame, runtimeContext) {
      if (state.visitingBodyId) {
        state.visitTransitionProgress = clamp(
          state.visitTransitionProgress +
            frame.unscaledDeltaMs / 900,
          0,
          1
        );
      } else {
        state.elapsedMs += frame.deltaMs;
        for (const renderer of getAllTextureRenderers(state)) {
          renderer.update(frame.deltaMs);
        }
      }
      publishBodies(runtimeContext, state, state.elapsedMs);
    },

    render(_frame, runtimeContext) {
      renderScene(runtimeContext, state);
    },

    resize(viewport, runtimeContext) {
      state.viewport = { ...viewport };
      publishBodies(runtimeContext, state, state.elapsedMs);
    },

    reset(runtimeContext) {
      state.angles = new Map(PLANETS.map(planet => [planet.id, planet.angle]));
      state.elapsedMs = 0;
      state.selectedId = 'earth';
      state.hoveredId = null;
      state.hoveredOrbit = null;
      state.hoverScreenPoint = null;
      state.visitingBodyId = null;
      state.visitTransitionProgress = 0;
      state.visitStartScreenRadius = 0;
      state.visitReferenceZoom = VISIT_REFERENCE_ZOOM;
      state.viewOrientation = identityQuaternion();
      setSphereRotationTarget(runtimeContext.canvas, null);
      setSolarSystemArcball(runtimeContext.canvas, true);
      for (const renderer of getAllTextureRenderers(state)) {
        renderer.reset();
      }
      publishBodies(runtimeContext, state, 0);
      callbacks.updatePanel(getBodySummaryInfo('earth'));
    },

    exit(runtimeContext) {
      if (skinChangeHandler) document.removeEventListener('solarkids:skinChange', skinChangeHandler);
      if (toggleOrbitsHandler) {
        document.removeEventListener(
          'solarkids:toggleOrbits',
          toggleOrbitsHandler
        );
      }
      if (pointerMoveHandler) runtimeContext.canvas.removeEventListener('pointermove', pointerMoveHandler);
      if (pointerLeaveHandler) runtimeContext.canvas.removeEventListener('pointerleave', pointerLeaveHandler);
      if (clickHandler) runtimeContext.canvas.removeEventListener('click', clickHandler);
      runtimeContext.canvas.style.cursor = '';
      setSphereRotationTarget(runtimeContext.canvas, null);
      delete runtimeContext.canvas.dataset.solarSystemArcball;
      if (panelActionHandler) {
        document.removeEventListener(
          'solarkids:panelAction',
          panelActionHandler
        );
      }
      if (rotateVisitedBodyHandler) {
        document.removeEventListener(
          'solarkids:rotateVisitedBody',
          rotateVisitedBodyHandler
        );
      }
      if (rotateSolarSystemHandler) {
        document.removeEventListener(
          'solarkids:rotateSolarSystem',
          rotateSolarSystemHandler
        );
      }
      for (const renderer of getAllTextureRenderers(state)) {
        renderer.setTextureReadyCallback(null);
      }
      for (const ringRenderer of Object.values(
        state.saturnRingRenderers
      )) {
        ringRenderer.setTextureReadyCallback(null);
      }
      skinChangeHandler = null;
      toggleOrbitsHandler = null;
      pointerMoveHandler = null;
      pointerLeaveHandler = null;
      clickHandler = null;
      panelActionHandler = null;
      rotateVisitedBodyHandler = null;
      rotateSolarSystemHandler = null;
    },
  };

  return scene;
}

const MOON: PlanetPreview = {
  id: 'moon',
  name: 'Moon',
  nameCN: '月球',
  emoji: '🌙',
  desc: '月球是地球的天然卫星，围绕地球运行。',
  radiusEarths: 0.273,
  radius: 3.5,
  distanceAU: 0,
  angle: 0,
  color: '#c8ccd6',
  stats: [
    { label: '身份', value: '地球的卫星' },
    { label: '特点', value: '表面有陨石坑' },
  ],
};

const SUN: PlanetPreview = {
  id: 'sun',
  name: 'Sun',
  nameCN: '太阳',
  emoji: '☀️',
  desc: '太阳是太阳系的中心恒星。从地球表面观察，它每天从东方升起、从西方落下。',
  radiusEarths: 109.2,
  radius: 42,
  distanceAU: 0,
  angle: 0,
  color: '#f7c948',
  stats: [
    { label: '身份', value: '恒星' },
    { label: '地球距离', value: '约 1 AU' },
  ],
};

type BodyVisitContent = {
  summary: string;
  summaryStats: PlanetInfo['stats'];
  detailStats: PlanetInfo['stats'];
  sections: NonNullable<PlanetInfo['sections']>;
};

const BODY_VISIT_CONTENT: Readonly<Record<string, BodyVisitContent>> = {
  sun: {
    summary: '太阳是太阳系中心的恒星，提供了地球生命所需的大部分光和热。',
    summaryStats: [
      { label: '类型', value: '黄矮星' },
      { label: '直径', value: '约 139 万 km' },
      { label: '表面温度', value: '约 5,500°C' },
      { label: '年龄', value: '约 46 亿年' },
    ],
    detailStats: [
      { label: '自转周期', value: '约 25–35 天' },
      { label: '核心温度', value: '约 1,500 万°C' },
      { label: '主要成分', value: '氢、氦' },
      { label: '能量来源', value: '核聚变' },
    ],
    sections: [
      { title: '恒星核心', content: '核心中的氢不断聚变为氦，并以光和热的形式释放巨大能量。' },
      { title: '分层结构', content: '太阳由核心、辐射区、对流区、光球、色球和日冕等区域组成。' },
      { title: '空间天气', content: '太阳黑子、耀斑和日冕物质抛射会影响行星际空间及地球磁场。' },
    ],
  },
  mercury: {
    summary: '水星是距离太阳最近、也是八大行星中最小的一颗。',
    summaryStats: [
      { label: '类型', value: '岩石行星' },
      { label: '直径', value: '4,879 km' },
      { label: '距太阳', value: '0.39 AU' },
      { label: '天然卫星', value: '无' },
    ],
    detailStats: [
      { label: '公转周期', value: '约 88 天' },
      { label: '自转周期', value: '约 58.6 天' },
      { label: '表面重力', value: '3.70 m/s²' },
      { label: '温度范围', value: '约 -180～430°C' },
    ],
    sections: [
      { title: '陨石坑世界', content: '水星表面布满古老撞击坑，外观与月球相似。' },
      { title: '巨大温差', content: '稀薄外逸层几乎不能储存热量，因此昼夜温差非常大。' },
      { title: '特殊运动', content: '水星每自转三周大约完成两次公转，形成 3:2 自旋轨道共振。' },
    ],
  },
  venus: {
    summary: '金星大小接近地球，却被厚密云层和强烈温室效应包围。',
    summaryStats: [
      { label: '类型', value: '岩石行星' },
      { label: '直径', value: '12,104 km' },
      { label: '距太阳', value: '0.72 AU' },
      { label: '天然卫星', value: '无' },
    ],
    detailStats: [
      { label: '公转周期', value: '约 224.7 天' },
      { label: '自转周期', value: '约 243 天（逆向）' },
      { label: '表面重力', value: '8.87 m/s²' },
      { label: '平均温度', value: '约 465°C' },
    ],
    sections: [
      { title: '浓厚大气', content: '大气主要由二氧化碳构成，云层中含有硫酸液滴。' },
      { title: '失控温室效应', content: '厚重大气困住热量，使金星成为太阳系表面最热的行星。' },
      { title: '逆向自转', content: '金星自转方向与多数行星相反，而且一昼夜比一年还长。' },
    ],
  },
  earth: {
    summary: '太阳系第三颗行星，也是目前已知唯一拥有生命的世界。',
    summaryStats: [
      { label: '类型', value: '岩石行星' },
      { label: '直径', value: '12,742 km' },
      { label: '距太阳', value: '1 AU' },
      { label: '天然卫星', value: '月球' },
    ],
    detailStats: [
      { label: '公转周期', value: '365.256 天' },
      { label: '自转周期', value: '23时56分' },
      { label: '表面重力', value: '9.81 m/s²' },
      { label: '平均温度', value: '约 15°C' },
      { label: '海洋覆盖', value: '约 71%' },
      { label: '大气主成分', value: '氮、氧' },
    ],
    sections: [
      { title: '蓝色星球', content: '液态水、适宜温度和大气层共同塑造了地球的宜居环境。' },
      { title: '内部结构', content: '液态外核的运动产生全球磁场，帮助阻挡部分太阳风。' },
      { title: '运动与季节', content: '地球自转形成昼夜，轴倾角与绕太阳公转共同造成四季变化。' },
    ],
  },
  moon: {
    summary: '月球是地球唯一的天然卫星，也是人类亲自登陆过的地外天体。',
    summaryStats: [
      { label: '类型', value: '岩石卫星' },
      { label: '直径', value: '3,475 km' },
      { label: '距地球', value: '约 38.4 万 km' },
      { label: '母行星', value: '地球' },
    ],
    detailStats: [
      { label: '绕地周期', value: '约 27.3 天' },
      { label: '自转周期', value: '约 27.3 天' },
      { label: '表面重力', value: '1.62 m/s²' },
      { label: '温度范围', value: '约 -173～127°C' },
    ],
    sections: [
      { title: '潮汐锁定', content: '月球自转与绕地周期接近，因此总以大致同一面朝向地球。' },
      { title: '月海与高地', content: '暗色月海是古老熔岩平原，亮色高地保存着更多撞击坑。' },
      { title: '影响地球', content: '月球引力是地球海洋潮汐的主要驱动力之一。' },
    ],
  },
  mars: {
    summary: '火星是一颗寒冷的红色岩石行星，保存着远古流水活动的痕迹。',
    summaryStats: [
      { label: '类型', value: '岩石行星' },
      { label: '直径', value: '6,779 km' },
      { label: '距太阳', value: '1.52 AU' },
      { label: '天然卫星', value: '2 颗' },
    ],
    detailStats: [
      { label: '公转周期', value: '约 687 天' },
      { label: '自转周期', value: '24时37分' },
      { label: '表面重力', value: '3.71 m/s²' },
      { label: '平均温度', value: '约 -63°C' },
    ],
    sections: [
      { title: '红色表面', content: '土壤中的氧化铁让火星呈现醒目的红褐色。' },
      { title: '巨大地貌', content: '奥林帕斯山和水手峡谷分别是太阳系著名的巨型火山与峡谷。' },
      { title: '水的线索', content: '河谷、矿物和极冠表明火星过去可能拥有更温暖湿润的环境。' },
    ],
  },
  jupiter: {
    summary: '木星是太阳系最大的行星，强大引力影响着大量卫星和小天体。',
    summaryStats: [
      { label: '类型', value: '气态巨行星' },
      { label: '直径', value: '约 139,820 km' },
      { label: '距太阳', value: '5.20 AU' },
      { label: '天然卫星', value: '90 余颗' },
    ],
    detailStats: [
      { label: '公转周期', value: '约 11.86 年' },
      { label: '自转周期', value: '约 9时56分' },
      { label: '云顶重力', value: '24.79 m/s²' },
      { label: '主要成分', value: '氢、氦' },
    ],
    sections: [
      { title: '条纹云带', content: '高速自转把不同纬度的大气拉成明暗相间的云带。' },
      { title: '大红斑', content: '大红斑是一场持续已久、尺度大于地球的巨大风暴。' },
      { title: '微型系统', content: '木星拥有众多卫星，其中四颗伽利略卫星尤其引人注目。' },
    ],
  },
  saturn: {
    summary: '土星以宽阔明亮的行星环闻名，是太阳系第二大的行星。',
    summaryStats: [
      { label: '类型', value: '气态巨行星' },
      { label: '直径', value: '约 116,460 km' },
      { label: '距太阳', value: '9.58 AU' },
      { label: '天然卫星', value: '众多' },
    ],
    detailStats: [
      { label: '公转周期', value: '约 29.46 年' },
      { label: '自转周期', value: '约 10时42分' },
      { label: '云顶重力', value: '10.44 m/s²' },
      { label: '主要成分', value: '氢、氦' },
    ],
    sections: [
      { title: '壮丽光环', content: '土星环主要由冰粒、岩屑和尘埃组成，内部有许多细环和缝隙。' },
      { title: '低密度巨星', content: '土星平均密度低于水，但它并没有可以承载它的巨大海洋。' },
      { title: '卫星家族', content: '土卫六拥有浓厚大气，土卫二的冰下海洋会向太空喷射物质。' },
    ],
  },
  uranus: {
    summary: '天王星是一颗青蓝色冰巨行星，几乎侧躺着绕太阳运行。',
    summaryStats: [
      { label: '类型', value: '冰巨行星' },
      { label: '直径', value: '约 50,724 km' },
      { label: '距太阳', value: '19.2 AU' },
      { label: '显著特点', value: '约 98° 轴倾角' },
    ],
    detailStats: [
      { label: '公转周期', value: '约 84 年' },
      { label: '自转周期', value: '约 17时14分（逆向）' },
      { label: '云顶重力', value: '8.69 m/s²' },
      { label: '大气成分', value: '氢、氦、甲烷' },
    ],
    sections: [
      { title: '侧躺自转', content: '极大的轴倾角让天王星的季节持续数十年，并呈现极端光照变化。' },
      { title: '青蓝色外观', content: '高层大气中的甲烷吸收红光，使行星看起来呈青蓝色。' },
      { title: '暗淡环系', content: '天王星也拥有多道较暗、较窄的行星环。' },
    ],
  },
  neptune: {
    summary: '海王星是距离太阳最远的八大行星，拥有太阳系中极强的风。',
    summaryStats: [
      { label: '类型', value: '冰巨行星' },
      { label: '直径', value: '约 49,244 km' },
      { label: '距太阳', value: '30.05 AU' },
      { label: '天然卫星', value: '多颗' },
    ],
    detailStats: [
      { label: '公转周期', value: '约 164.8 年' },
      { label: '自转周期', value: '约 16时6分' },
      { label: '云顶重力', value: '11.15 m/s²' },
      { label: '大气成分', value: '氢、氦、甲烷' },
    ],
    sections: [
      { title: '遥远冰巨星', content: '海王星接收到的太阳光很弱，外层大气寒冷而活跃。' },
      { title: '猛烈风暴', content: '海王星云层中的风速可超过每小时两千公里。' },
      { title: '海卫一', content: '最大的卫星海卫一逆向绕行，可能是被海王星捕获的天体。' },
    ],
  },
};

function getBodySummaryInfo(bodyId: string): PlanetInfo | null {
  const preview = getBodyPreview(bodyId);
  const content = BODY_VISIT_CONTENT[bodyId];
  if (!preview || !content) return toPlanetInfo(preview);
  return {
    id: bodyId,
    name: preview.name,
    nameCN: `正在探访${preview.nameCN}`,
    emoji: preview.emoji,
    desc: content.summary,
    stats: content.summaryStats,
    actions: [
      {
        id: 'visit-body',
        label: `🚀 探访${preview.nameCN}`,
        variant: 'primary',
      },
    ],
  };
}

function getBodyDetailInfo(bodyId: string): PlanetInfo | null {
  const preview = getBodyPreview(bodyId);
  const content = BODY_VISIT_CONTENT[bodyId];
  if (!preview || !content) return getBodySummaryInfo(bodyId);
  const dragHint =
    bodyId === 'saturn'
      ? '可按住球体或光环进行全方位观察'
      : '可拖动球体全方位观察';
  return {
    id: bodyId,
    name: preview.name,
    nameCN: preview.nameCN,
    emoji: preview.emoji,
    desc: `探访期间只显示${preview.nameCN}并冻结全部自动运动。${dragHint}，滚轮或双指缩放可以调整距离。`,
    stats: content.detailStats,
    sections: content.sections,
    actions: [
      {
        id: 'leave-visit',
        label: '← 返回太阳系总览',
        variant: 'secondary',
      },
    ],
  };
}

function publishBodies(
  runtimeContext: CanvasRuntimeContext,
  state: SolarSystemSceneState,
  elapsedMs: number
): void {
  const seconds = elapsedMs / 1000;
  const { width, height } = state.viewport;
  const tilt = width < 768 ? 0.58 : 0.46;
  const viewScale = getResponsiveOrbitScale(width, height, tilt);
  for (const planet of PLANETS) {
    const orbitAngle = planet.angle + getOrbitSpeed(planet) * seconds;
    state.angles.set(planet.id, orbitAngle);
    const orbit = getCompressedOrbit(planet.distanceAU);
    const angularSpeed = getOrbitSpeed(planet);
    const position = {
      x: Math.cos(orbitAngle) * orbit,
      y: Math.sin(orbitAngle) * orbit,
    };
    const position3D = getOrbitalPosition3D(
      Math.max(planet.distanceAU, 1e-6),
      orbitAngle,
      degreesToRadians(ORBIT_INCLINATION_DEGREES[planet.id] ?? 0),
      degreesToRadians(ASCENDING_NODE_DEGREES[planet.id] ?? 0)
    );
    const scenePosition3D = getOrbitalPosition3D(
      orbit,
      orbitAngle,
      degreesToRadians(ORBIT_INCLINATION_DEGREES[planet.id] ?? 0),
      degreesToRadians(ASCENDING_NODE_DEGREES[planet.id] ?? 0)
    );
    const projection = projectScenePoint(
      scenePosition3D,
      viewScale,
      tilt,
      state.viewOrientation
    );
    const velocity = {
      x: -Math.sin(orbitAngle) * orbit * angularSpeed,
      y: Math.cos(orbitAngle) * orbit * angularSpeed,
    };
    setBody(runtimeContext, {
      id: planet.id,
      position,
      position3D,
      velocity,
      displayPosition: projection.point,
      displayVelocity: projectVelocity(velocity, viewScale, tilt),
      rotation:
        getActiveTextureRenderer(state, planet.id)?.rotationAngle ??
        normalizeAngle(getSpinSpeed(planet.id) * seconds),
      orbitAngle,
      radius: planet.radius,
      visible: true,
      metadata: {
        nameCN: planet.nameCN,
        radiusEarths: planet.radiusEarths,
        distanceAU: planet.distanceAU,
        orbitPeriodYears: ORBIT_PERIOD_YEARS[planet.id],
        orbitModel: 'real-period-ratio',
        rotationPeriodDays: ROTATION_PERIOD_DAYS[planet.id],
        rotationModel: 'real-period-ratio',
        axialTiltDegrees: AXIAL_TILT_DEGREES[planet.id],
        orbitInclinationDegrees:
          ORBIT_INCLINATION_DEGREES[planet.id] ?? 0,
        ascendingNodeDegrees: ASCENDING_NODE_DEGREES[planet.id] ?? 0,
        displayDepth: projection.depth,
        ...(planet.id === 'earth'
          ? {
              observerSiderealAngle: normalizeAngle(
                (Math.PI * 2 * seconds) / EARTH_OBSERVER_DAY_SECONDS
              ),
              observerDaySeconds: EARTH_OBSERVER_DAY_SECONDS,
              observerLatitudeDegrees:
                DEFAULT_OBSERVER_LATITUDE_DEGREES,
              textureOffset:
                getActiveTextureRenderer(state, 'earth')?.textureOffset ??
                0,
              rotationSpeed:
                getActiveTextureRenderer(state, 'earth')?.rotationSpeed ??
                getSpinSpeed('earth'),
              rotationTexture:
                getSkinType() === 'cartoon'
                  ? CARTOON_TEXTURES.earth
                  : REALISTIC_TEXTURES.earth,
            }
          : {}),
      },
    });
  }

  setBody(runtimeContext, {
    id: 'sun',
    position: { x: 0, y: 0 },
    position3D: { x: 0, y: 0, z: 0 },
    velocity: { x: 0, y: 0 },
    displayPosition: { x: 0, y: 0 },
    displayVelocity: { x: 0, y: 0 },
    rotation:
      getActiveTextureRenderer(state, 'sun')?.rotationAngle ??
      normalizeAngle(getSpinSpeed('sun') * seconds),
    radius: SUN.radius,
    visible: true,
    metadata: {
      nameCN: '太阳',
      radiusEarths: SUN.radiusEarths,
      rotationPeriodDays: ROTATION_PERIOD_DAYS.sun,
      rotationModel: 'real-period-ratio',
      axialTiltDegrees: AXIAL_TILT_DEGREES.sun,
    },
  });

  const earth = runtimeContext.world.getBody('earth');
  if (earth?.position3D) {
    const moonAngle = MOON.angle + MOON_ORBIT_SPEED * seconds;
    const moonDistance = 30;
    const position = {
      x: earth.position.x + Math.cos(moonAngle) * moonDistance,
      y: earth.position.y + Math.sin(moonAngle) * moonDistance,
    };
    const moonRelativePosition3D = getOrbitalPosition3D(
      MOON_DISTANCE_AU,
      moonAngle,
      degreesToRadians(MOON_ORBIT_INCLINATION_DEGREES),
      degreesToRadians(MOON_ASCENDING_NODE_DEGREES)
    );
    const position3D = {
      x: earth.position3D.x + moonRelativePosition3D.x,
      y: earth.position3D.y + moonRelativePosition3D.y,
      z: earth.position3D.z + moonRelativePosition3D.z,
    };
    const earthScenePosition3D = getOrbitalPosition3D(
      getCompressedOrbit(PLANET_BY_ID.get('earth')?.distanceAU ?? 1),
      earth.orbitAngle ?? 0,
      degreesToRadians(ORBIT_INCLINATION_DEGREES.earth),
      degreesToRadians(ASCENDING_NODE_DEGREES.earth)
    );
    const moonRelativeScenePosition3D = getOrbitalPosition3D(
      moonDistance,
      moonAngle,
      degreesToRadians(MOON_ORBIT_INCLINATION_DEGREES),
      degreesToRadians(MOON_ASCENDING_NODE_DEGREES)
    );
    const moonScenePosition3D = {
      x: earthScenePosition3D.x + moonRelativeScenePosition3D.x,
      y: earthScenePosition3D.y + moonRelativeScenePosition3D.y,
      z: earthScenePosition3D.z + moonRelativeScenePosition3D.z,
    };
    const moonProjection = projectScenePoint(
      moonScenePosition3D,
      viewScale,
      tilt,
      state.viewOrientation
    );
    setBody(runtimeContext, {
      id: 'moon',
      position,
      position3D,
      velocity: {
        x: earth.velocity!.x - Math.sin(moonAngle) * moonDistance * MOON_ORBIT_SPEED,
        y: earth.velocity!.y + Math.cos(moonAngle) * moonDistance * MOON_ORBIT_SPEED,
      },
      displayPosition: moonProjection.point,
      displayVelocity: projectVelocity(
        {
          x: earth.velocity!.x -
            Math.sin(moonAngle) * moonDistance * MOON_ORBIT_SPEED,
          y: earth.velocity!.y +
            Math.cos(moonAngle) * moonDistance * MOON_ORBIT_SPEED,
        },
        viewScale,
        tilt
      ),
      rotation:
        getActiveTextureRenderer(state, 'moon')?.rotationAngle ??
        normalizeAngle(MOON_ORBIT_SPEED * seconds),
      orbitAngle: moonAngle,
      radius: MOON.radius,
      visible: true,
      metadata: {
        nameCN: '月球',
        radiusEarths: MOON.radiusEarths,
        parentId: 'earth',
        orbitRadius: moonDistance,
        orbitPeriodDays: MOON_ORBIT_PERIOD_DAYS,
        orbitInclinationDegrees: MOON_ORBIT_INCLINATION_DEGREES,
        ascendingNodeDegrees: MOON_ASCENDING_NODE_DEGREES,
        distanceAU: MOON_DISTANCE_AU,
        axialTiltDegrees: AXIAL_TILT_DEGREES.moon,
        displayDepth: moonProjection.depth,
      },
    });
  }
}

function setBody(runtimeContext: CanvasRuntimeContext, body: SolarSystemBody): void {
  runtimeContext.world.setBody(body);
}

function renderScene(
  runtimeContext: CanvasRuntimeContext,
  state: SolarSystemSceneState
): void {
  const { context2D, camera } = runtimeContext;
  const { width, height } = state.viewport;
  if (camera.state.mode === 'earth-first-person') {
    renderEarthObserverScene(runtimeContext, state);
    return;
  }
  const tilt = width < 768 ? 0.58 : 0.46;
  const viewScale = getResponsiveOrbitScale(width, height, tilt);
  drawSpace(context2D, width, height, state.stars, {
    zoom: camera.state.zoom,
    rotation: camera.state.rotation,
    position: camera.state.position,
  });
  context2D.save();
  camera.applyTransform(context2D);
  if (state.visitingBodyId) {
    renderVisitedBody(
      runtimeContext,
      state,
      state.visitingBodyId,
      viewScale,
      tilt
    );
    context2D.restore();
    return;
  }
  if (state.showOrbits) {
    drawProjectedOrbits(context2D, runtimeContext, state, viewScale, tilt);
  }
  const bodies = runtimeContext.world
    .getBodies()
    .filter(body => getBodyPreview(body.id) !== null && body.visible !== false)
    .sort((left, right) => getDisplayDepth(left) - getDisplayDepth(right));
  for (const body of bodies) {
    drawOverviewBody(
      context2D,
      body,
      state,
      viewScale
    );
  }

  context2D.restore();

  // 图例和悬停提示使用屏幕坐标，不受相机缩放影响。
  if (state.showOrbits) {
    drawOrbitLegend(context2D, width, height, state.hoveredOrbit);
    if (state.hoveredOrbit && state.hoverScreenPoint) {
      drawOrbitTooltip(
        context2D,
        state.hoveredOrbit,
        state.hoverScreenPoint,
        width,
        height
      );
    }
  }
  drawHint(context2D, width, height);
}

function drawOverviewBody(
  context2D: CanvasRenderingContext2D,
  body: Readonly<CelestialBodyState>,
  state: SolarSystemSceneState,
  viewScale: number
): void {
  const preview = getBodyPreview(body.id);
  if (!preview) return;
  const position = body.displayPosition ?? { x: 0, y: 0 };
  const radius = preview.radius * viewScale;
  const axialTilt = degreesToRadians(
    AXIAL_TILT_DEGREES[body.id] ?? 0
  );
  const renderer = getActiveTextureRenderer(state, body.id);
  const saturnRingRenderer = getActiveSaturnRingRenderer(state);

  if (body.id === 'sun') {
    if (renderer) {
      drawSunGlow(context2D, position, radius);
      renderer.draw(context2D, position, radius, {
        hovered: state.hoveredId === body.id,
        selected: state.selectedId === body.id,
        axialTilt,
      });
    } else {
      drawSun(
        context2D,
        position,
        radius / 34,
        body.rotation,
        axialTilt,
        getRotationDirection('sun')
      );
    }
    return;
  }

  if (renderer) {
    let texturedSaturnRing = false;
    if (body.id === 'saturn') {
      texturedSaturnRing = saturnRingRenderer.drawBack(
        context2D,
        position,
        radius,
        renderer.viewQuaternion,
        axialTilt
      );
      if (!texturedSaturnRing) {
        drawSaturnRingBack(
          context2D,
          position.x,
          position.y,
          radius,
          -axialTilt
        );
      }
    }
    renderer.draw(context2D, position, radius, {
      hovered: state.hoveredId === body.id,
      selected: state.selectedId === body.id,
      lightAngle: angleTowardSun(position),
      axialTilt,
    });
    if (body.id === 'saturn') {
      if (texturedSaturnRing) {
        saturnRingRenderer.drawFront(
          context2D,
          position,
          radius,
          renderer.viewQuaternion,
          axialTilt
        );
      } else {
        drawSaturnRingFront(
          context2D,
          position.x,
          position.y,
          radius,
          -axialTilt
        );
      }
    }
    return;
  }

  drawPlanet(
    context2D,
    preview,
    position.x,
    position.y,
    radius,
    {
      hovered: state.hoveredId === body.id,
      selected: state.selectedId === body.id,
    },
    {
      rotation: body.rotation,
      axialTilt,
      rotationDirection: getRotationDirection(body.id),
    }
  );
}

function drawProjectedOrbits(
  context2D: CanvasRenderingContext2D,
  runtimeContext: CanvasRuntimeContext,
  state: SolarSystemSceneState,
  viewScale: number,
  tilt: number
): void {
  for (const planet of PLANETS) {
    const points = getProjectedPlanetOrbit(
      planet,
      state,
      viewScale,
      tilt
    );
    const highlighted =
      planet.id === 'earth' && state.hoveredOrbit === 'earth';
    drawProjectedOrbitPath(
      context2D,
      points,
      planet.id === 'earth'
        ? EARTH_ORBIT_COLOR
        : 'rgba(255, 255, 255, 0.24)',
      highlighted ? 1.8 : planet.id === 'earth' ? 1.1 : 0.65,
      planet.id === 'earth' ? [5, 6] : [3, 6],
      highlighted ? 6 : planet.id === 'earth' ? 2 : 0
    );
  }

  const earth = runtimeContext.world.getBody('earth');
  if (!earth) return;
  const moonPoints = getProjectedMoonOrbit(
    earth,
    state,
    viewScale,
    tilt
  );
  const highlighted = state.hoveredOrbit === 'moon';
  drawProjectedOrbitPath(
    context2D,
    moonPoints,
    MOON_ORBIT_COLOR,
    highlighted ? 1.8 : 1.1,
    [2, 5],
    highlighted ? 6 : 2
  );
}

function drawProjectedOrbitPath(
  context2D: CanvasRenderingContext2D,
  points: ReadonlyArray<Readonly<Point2D>>,
  color: string,
  lineWidth: number,
  dash: number[],
  shadowBlur: number
): void {
  if (points.length < 2) return;
  context2D.save();
  context2D.strokeStyle = color;
  context2D.lineWidth = lineWidth;
  context2D.setLineDash(dash);
  context2D.shadowColor = color;
  context2D.shadowBlur = shadowBlur;
  context2D.beginPath();
  context2D.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) {
    context2D.lineTo(points[index].x, points[index].y);
  }
  context2D.closePath();
  context2D.stroke();
  context2D.restore();
}

function renderVisitedBody(
  runtimeContext: CanvasRuntimeContext,
  state: SolarSystemSceneState,
  bodyId: string,
  viewScale: number,
  tilt: number
): void {
  const body = runtimeContext.world.getBody(bodyId);
  const preview = getBodyPreview(bodyId);
  if (!body || !preview) return;
  const position =
    body.displayPosition ?? projectPoint(body.position, viewScale, tilt);
  const cameraZoom = Math.max(
    0.01,
    runtimeContext.camera.state.zoom
  );
  const targetScreenRadius = Math.max(
    state.visitStartScreenRadius,
    Math.min(state.viewport.width, state.viewport.height) * 0.275
  );
  const screenRadius = lerp(
    state.visitStartScreenRadius || preview.radius * viewScale,
    targetScreenRadius,
    smoothStep(state.visitTransitionProgress)
  );
  const stableVisitZoomScale =
    runtimeContext.camera.state.mode === 'focus'
      ? cameraZoom / Math.max(0.01, state.visitReferenceZoom)
      : 1;
  const radius =
    (screenRadius * stableVisitZoomScale) / cameraZoom;
  const renderer = getActiveTextureRenderer(state, bodyId);
  const saturnRingRenderer = getActiveSaturnRingRenderer(state);
  if (renderer) {
    const axialTilt = degreesToRadians(
      AXIAL_TILT_DEGREES[bodyId] ?? 0
    );
    let texturedSaturnRing = false;
    if (bodyId === 'sun') {
      drawSunGlow(runtimeContext.context2D, position, radius);
    }
    if (bodyId === 'saturn') {
      texturedSaturnRing = saturnRingRenderer.drawBack(
        runtimeContext.context2D,
        position,
        radius,
        renderer.viewQuaternion,
        axialTilt
      );
      if (!texturedSaturnRing) {
        drawSaturnRingBack(
          runtimeContext.context2D,
          position.x,
          position.y,
          radius,
          -axialTilt
        );
      }
    }
    renderer.draw(runtimeContext.context2D, position, radius, {
      lightAngle: angleTowardSun(position),
      axialTilt,
    });
    if (bodyId === 'saturn') {
      if (texturedSaturnRing) {
        saturnRingRenderer.drawFront(
          runtimeContext.context2D,
          position,
          radius,
          renderer.viewQuaternion,
          axialTilt
        );
      } else {
        drawSaturnRingFront(
          runtimeContext.context2D,
          position.x,
          position.y,
          radius,
          -axialTilt
        );
      }
    }
    return;
  }
  if (bodyId === 'sun') {
    drawSun(
      runtimeContext.context2D,
      position,
      radius / 34,
      body.rotation,
      degreesToRadians(AXIAL_TILT_DEGREES.sun),
      getRotationDirection('sun')
    );
    return;
  }
  drawPlanet(
    runtimeContext.context2D,
    preview,
    position.x,
    position.y,
    radius,
    { hovered: false, selected: false },
    {
      rotation: body.rotation,
      axialTilt: degreesToRadians(
        AXIAL_TILT_DEGREES[bodyId] ?? 0
      ),
      rotationDirection: getRotationDirection(bodyId),
    }
  );
}

function renderEarthObserverScene(
  runtimeContext: CanvasRuntimeContext,
  state: SolarSystemSceneState
): void {
  const { context2D, camera, world } = runtimeContext;
  const { width, height } = state.viewport;
  const earth = world.getBody('earth');
  if (!earth) return;

  drawSpace(context2D, width, height, state.stars, {
    zoom: camera.state.zoom,
    rotation: camera.state.rotation,
    position: camera.state.position,
  });
  const horizonY = getEarthObserverHorizonY(
    height,
    camera.state.observerPitch
  );
  drawObserverAtmosphere(context2D, width, horizonY);

  const localSiderealAngle = getObserverSiderealAngle(earth);
  const observerLatitude = getObserverLatitude(earth);
  const candidates = getEarthObserverBodies(runtimeContext);
  const projectedBodies = candidates.map(body => ({
    body,
    projection: projectBodyToEarthSky(
      earth,
      body,
      state.viewport,
      {
        localSiderealAngle,
        observerLatitude,
        lookYaw: camera.state.observerYaw,
        lookPitch: camera.state.observerPitch,
        zoom: camera.state.zoom,
      }
    ),
  }));
  const sunProjection = projectedBodies.find(
    ({ body }) => body.id === 'sun'
  )?.projection;

  for (const { body, projection } of projectedBodies) {
    if (!projection.visible) continue;
    const lightAngle = sunProjection
      ? Math.atan2(
          sunProjection.point.y - projection.point.y,
          sunProjection.point.x - projection.point.x
        )
      : -2.35;
    drawObserverBody(
      context2D,
      body,
      projection.point,
      state,
      width,
      lightAngle
    );
  }

  drawEarthHorizon(context2D, width, height, horizonY);
  drawObserverHud(
    context2D,
    width,
    height,
    horizonY,
    localSiderealAngle,
    observerLatitude,
    camera.state.observerYaw
  );
}

function drawObserverAtmosphere(
  context2D: CanvasRenderingContext2D,
  width: number,
  horizonY: number
): void {
  const atmosphere = context2D.createLinearGradient(
    0,
    Math.max(0, horizonY - 220),
    0,
    horizonY + 8
  );
  atmosphere.addColorStop(0, 'rgba(22, 61, 125, 0)');
  atmosphere.addColorStop(0.62, 'rgba(48, 123, 205, 0.2)');
  atmosphere.addColorStop(1, 'rgba(116, 201, 255, 0.62)');
  context2D.fillStyle = atmosphere;
  context2D.fillRect(0, Math.max(0, horizonY - 240), width, 248);
}

function drawEarthHorizon(
  context2D: CanvasRenderingContext2D,
  width: number,
  height: number,
  horizonY: number
): void {
  context2D.save();
  const ground = context2D.createLinearGradient(0, horizonY, 0, height);
  ground.addColorStop(0, '#245d74');
  ground.addColorStop(0.16, '#174a57');
  ground.addColorStop(1, '#071c29');
  context2D.fillStyle = ground;
  context2D.beginPath();
  context2D.moveTo(0, horizonY + 9);
  context2D.quadraticCurveTo(
    width / 2,
    horizonY - Math.min(20, width * 0.025),
    width,
    horizonY + 9
  );
  context2D.lineTo(width, height);
  context2D.lineTo(0, height);
  context2D.closePath();
  context2D.fill();

  context2D.strokeStyle = 'rgba(159, 225, 255, 0.85)';
  context2D.lineWidth = 2;
  context2D.shadowColor = 'rgba(91, 192, 235, 0.8)';
  context2D.shadowBlur = 12;
  context2D.beginPath();
  context2D.moveTo(0, horizonY + 9);
  context2D.quadraticCurveTo(
    width / 2,
    horizonY - Math.min(20, width * 0.025),
    width,
    horizonY + 9
  );
  context2D.stroke();
  context2D.restore();
}

function drawObserverBody(
  context2D: CanvasRenderingContext2D,
  body: Readonly<CelestialBodyState>,
  point: Readonly<Point2D>,
  state: SolarSystemSceneState,
  viewportWidth: number,
  lightAngle: number
): void {
  const preview = getBodyPreview(body.id);
  if (!preview) return;
  const radius = getObserverBodyRadius(body.id, preview, viewportWidth);
  const renderer = getActiveTextureRenderer(state, body.id);
  const axialTilt = degreesToRadians(
    AXIAL_TILT_DEGREES[body.id] ?? 0
  );

  if (body.id === 'sun') {
    if (renderer) {
      drawSunGlow(context2D, point, radius);
      renderer.draw(context2D, point, radius, {
        hovered: state.hoveredId === body.id,
        selected: state.selectedId === body.id,
        axialTilt,
      });
    } else {
      drawSun(context2D, point, radius / 34);
    }
  } else if (renderer) {
    const saturnRingRenderer = getActiveSaturnRingRenderer(state);
    let texturedSaturnRing = false;
    if (body.id === 'saturn') {
      texturedSaturnRing = saturnRingRenderer.drawBack(
        context2D,
        point,
        radius,
        renderer.viewQuaternion,
        axialTilt
      );
      if (!texturedSaturnRing) {
        drawSaturnRingBack(
          context2D,
          point.x,
          point.y,
          radius,
          -axialTilt
        );
      }
    }
    renderer.draw(context2D, point, radius, {
      hovered: state.hoveredId === body.id,
      selected: state.selectedId === body.id,
      lightAngle,
      axialTilt,
    });
    if (body.id === 'saturn') {
      if (texturedSaturnRing) {
        saturnRingRenderer.drawFront(
          context2D,
          point,
          radius,
          renderer.viewQuaternion,
          axialTilt
        );
      } else {
        drawSaturnRingFront(
          context2D,
          point.x,
          point.y,
          radius,
          -axialTilt
        );
      }
    }
  } else {
    drawPlanet(
      context2D,
      preview,
      point.x,
      point.y,
      radius,
      {
        hovered: state.hoveredId === body.id,
        selected: state.selectedId === body.id,
      },
      {
        rotation: body.rotation,
        axialTilt,
        rotationDirection: getRotationDirection(body.id),
      }
    );
  }

  if (
    viewportWidth >= 520 ||
    body.id === 'sun' ||
    body.id === 'moon' ||
    state.hoveredId === body.id ||
    state.selectedId === body.id
  ) {
    context2D.save();
    context2D.font =
      '600 12px "PingFang SC", "Microsoft YaHei", sans-serif';
    context2D.textAlign = 'center';
    context2D.textBaseline = 'top';
    context2D.fillStyle = '#ffffff';
    context2D.shadowColor = 'rgba(0, 0, 0, 0.9)';
    context2D.shadowBlur = 5;
    context2D.fillText(preview.nameCN, point.x, point.y + radius + 7);
    context2D.restore();
  }
}

function drawObserverHud(
  context2D: CanvasRenderingContext2D,
  width: number,
  height: number,
  horizonY: number,
  localSiderealAngle: number,
  observerLatitude: number,
  lookYaw: number
): void {
  context2D.save();
  const siderealProgress =
    ((localSiderealAngle / (Math.PI * 2)) % 1 + 1) % 1;
  const hour = Math.floor(siderealProgress * 24);
  const minute = Math.floor((siderealProgress * 24 - hour) * 60);
  const latitudeDegrees = Math.round(
    Math.abs((observerLatitude * 180) / Math.PI)
  );
  const latitudeLabel =
    observerLatitude >= 0
      ? `${latitudeDegrees}°N`
      : `${latitudeDegrees}°S`;
  const status = `地表观测 ${latitudeLabel} · 恒星时 ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} · 拖动环顾`;
  context2D.font =
    '500 12px "PingFang SC", "Microsoft YaHei", sans-serif';
  context2D.textAlign = 'center';
  context2D.textBaseline = 'top';
  context2D.fillStyle = 'rgba(224, 242, 255, 0.9)';
  context2D.fillText(
    status,
    width / 2,
    Math.max(12, Math.min(height - 28, horizonY + 20))
  );

  const heading = normalizeAngle(Math.PI + lookYaw);
  context2D.fillStyle = 'rgba(159, 225, 255, 0.75)';
  context2D.fillText(
    `观察方向：${formatCompassDirection(heading)}`,
    width / 2,
    Math.max(30, Math.min(height - 10, horizonY + 40))
  );
  context2D.restore();
}

function getEarthObserverBodies(
  runtimeContext: CanvasRuntimeContext
): ReadonlyArray<Readonly<CelestialBodyState>> {
  const ids = [
    'sun',
    'moon',
    'mercury',
    'venus',
    'mars',
    'jupiter',
    'saturn',
    'uranus',
    'neptune',
  ];
  return ids
    .map(bodyId => runtimeContext.world.getBody(bodyId))
    .filter(
      (body): body is Readonly<CelestialBodyState> =>
        body !== null && body.visible !== false
    );
}

function getObserverBodyRadius(
  bodyId: string,
  preview: Readonly<PlanetPreview>,
  viewportWidth: number
): number {
  const baseScale = clamp(viewportWidth / 960, 0.72, 1.2);
  if (bodyId === 'sun') return 19 * baseScale;
  if (bodyId === 'moon') return 12 * baseScale;
  return clamp(preview.radius * 0.72 * baseScale, 5, 14);
}

function pickBody(
  clientX: number,
  clientY: number,
  runtimeContext: CanvasRuntimeContext,
  onlyBodyId: string | null = null
): string | null {
  const rect = runtimeContext.canvas.getBoundingClientRect();
  const screenPoint = { x: clientX - rect.left, y: clientY - rect.top };
  if (runtimeContext.camera.state.mode === 'earth-first-person') {
    return pickEarthObserverBody(screenPoint, runtimeContext);
  }
  const worldPoint = runtimeContext.camera.screenToWorld(screenPoint);
  const { width, height } = runtimeContext.getViewport();
  const tilt = width < 768 ? 0.58 : 0.46;
  const viewScale = getResponsiveOrbitScale(width, height, tilt);
  const bodies = [...runtimeContext.world.getBodies()].sort(
    (left, right) => getDisplayDepth(right) - getDisplayDepth(left)
  );
  for (const body of bodies) {
    if (body.visible === false || body.radius === undefined) continue;
    if (onlyBodyId && body.id !== onlyBodyId) continue;
    const position =
      body.displayPosition ?? projectPoint(body.position, viewScale, tilt);
    const hitRadius = Math.max(14 * viewScale, body.radius * viewScale + 8);
    if (Math.hypot(worldPoint.x - position.x, worldPoint.y - position.y) <= hitRadius) {
      return body.id;
    }
  }

  return null;
}

function pickOrbit(
  clientX: number,
  clientY: number,
  runtimeContext: CanvasRuntimeContext,
  state: SolarSystemSceneState
): OrbitKind | null {
  if (runtimeContext.camera.state.mode === 'earth-first-person') {
    return null;
  }
  const rect = runtimeContext.canvas.getBoundingClientRect();
  const screenPoint = { x: clientX - rect.left, y: clientY - rect.top };
  const worldPoint = runtimeContext.camera.screenToWorld(screenPoint);
  const { width, height } = runtimeContext.getViewport();
  const tilt = width < 768 ? 0.58 : 0.46;
  const viewScale = getResponsiveOrbitScale(width, height, tilt);
  const inverseZoom = 1 / runtimeContext.camera.state.zoom;

  const earth = runtimeContext.world.getBody('earth');
  if (earth) {
    if (
      distanceToPolyline(
        worldPoint,
        getProjectedMoonOrbit(earth, state, viewScale, tilt)
      ) <= 4 * inverseZoom
    ) {
      return 'moon';
    }
  }

  const earthPreview = PLANET_BY_ID.get('earth');
  if (earthPreview) {
    const orbitRadius = getCompressedOrbit(earthPreview.distanceAU);
    if (
      distanceToPolyline(
        worldPoint,
        getProjectedOrbitFromParameters(
          orbitRadius,
          degreesToRadians(ORBIT_INCLINATION_DEGREES.earth),
          degreesToRadians(ASCENDING_NODE_DEGREES.earth),
          state.viewOrientation,
          viewScale,
          tilt
        )
      ) <= 7 * inverseZoom
    ) {
      return 'earth';
    }
  }

  return null;
}

function pickEarthObserverBody(
  screenPoint: Readonly<Point2D>,
  runtimeContext: CanvasRuntimeContext
): string | null {
  const earth = runtimeContext.world.getBody('earth');
  if (!earth) return null;
  const viewport = runtimeContext.getViewport();
  const camera = runtimeContext.camera.state;
  const localSiderealAngle = getObserverSiderealAngle(earth);
  const observerLatitude = getObserverLatitude(earth);
  const candidates = getEarthObserverBodies(runtimeContext);

  for (const body of [...candidates].reverse()) {
    const projection = projectBodyToEarthSky(
      earth,
      body,
      viewport,
      {
        localSiderealAngle,
        observerLatitude,
        lookYaw: camera.observerYaw,
        lookPitch: camera.observerPitch,
        zoom: camera.zoom,
      }
    );
    if (!projection.visible) continue;
    const preview = getBodyPreview(body.id);
    if (!preview) continue;
    const visualRadius = getObserverBodyRadius(
      body.id,
      preview,
      viewport.width
    );
    const hitRadius = Math.max(
      14,
      visualRadius * (body.id === 'saturn' ? 2.3 : 1) + 8
    );
    if (
      Math.hypot(
        screenPoint.x - projection.point.x,
        screenPoint.y - projection.point.y
      ) <= hitRadius
    ) {
      return body.id;
    }
  }
  return null;
}

function createStars(count: number): { x: number; y: number; r: number; alpha: number }[] {
  return Array.from({ length: count }, (_, index) => ({
    x: (Math.sin(index * 43.17) * 0.5 + 0.5) % 1,
    y: (Math.cos(index * 31.91) * 0.5 + 0.5) % 1,
    r: 0.6 + ((index * 17) % 9) / 10,
    alpha: 0.22 + ((index * 29) % 55) / 100,
  }));
}

function projectPoint(point: Point2D, scale: number, tilt: number): Point2D {
  return {
    x: point.x * scale,
    y: point.y * tilt * scale,
  };
}

function projectScenePoint(
  point: Readonly<Point3D>,
  scale: number,
  tilt: number,
  orientation: Readonly<Quaternion>
): { point: Point2D; depth: number } {
  const depthFactor = Math.sqrt(Math.max(0, 1 - tilt * tilt));
  const tilted = {
    x: point.x,
    y: point.y * tilt - point.z * depthFactor,
    z: point.y * depthFactor + point.z * tilt,
  };
  const rotated = rotatePointByQuaternion(tilted, orientation);
  return {
    point: {
      x: rotated.x * scale,
      y: rotated.y * scale,
    },
    depth: rotated.z * scale,
  };
}

function getProjectedPlanetOrbit(
  planet: Readonly<PlanetPreview>,
  state: SolarSystemSceneState,
  viewScale: number,
  tilt: number
): Point2D[] {
  return getProjectedOrbitFromParameters(
    getCompressedOrbit(planet.distanceAU),
    degreesToRadians(ORBIT_INCLINATION_DEGREES[planet.id] ?? 0),
    degreesToRadians(ASCENDING_NODE_DEGREES[planet.id] ?? 0),
    state.viewOrientation,
    viewScale,
    tilt
  );
}

function getProjectedMoonOrbit(
  earth: Readonly<CelestialBodyState>,
  state: SolarSystemSceneState,
  viewScale: number,
  tilt: number
): Point2D[] {
  const earthScenePosition = getOrbitalPosition3D(
    getCompressedOrbit(PLANET_BY_ID.get('earth')?.distanceAU ?? 1),
    earth.orbitAngle ?? 0,
    degreesToRadians(ORBIT_INCLINATION_DEGREES.earth),
    degreesToRadians(ASCENDING_NODE_DEGREES.earth)
  );
  return getProjectedOrbitFromParameters(
    30,
    degreesToRadians(MOON_ORBIT_INCLINATION_DEGREES),
    degreesToRadians(MOON_ASCENDING_NODE_DEGREES),
    state.viewOrientation,
    viewScale,
    tilt,
    earthScenePosition
  );
}

function getProjectedOrbitFromParameters(
  radius: number,
  inclination: number,
  ascendingNode: number,
  orientation: Readonly<Quaternion>,
  viewScale: number,
  tilt: number,
  center: Readonly<Point3D> = { x: 0, y: 0, z: 0 }
): Point2D[] {
  const sampleCount = 96;
  return Array.from({ length: sampleCount }, (_, index) => {
    const orbitPoint = getOrbitalPosition3D(
      radius,
      (index / sampleCount) * Math.PI * 2,
      inclination,
      ascendingNode
    );
    return projectScenePoint(
      {
        x: center.x + orbitPoint.x,
        y: center.y + orbitPoint.y,
        z: center.z + orbitPoint.z,
      },
      viewScale,
      tilt,
      orientation
    ).point;
  });
}

function distanceToPolyline(
  point: Readonly<Point2D>,
  points: ReadonlyArray<Readonly<Point2D>>
): number {
  if (points.length < 2) return Number.POSITIVE_INFINITY;
  let closest = Number.POSITIVE_INFINITY;
  for (let index = 0; index < points.length; index += 1) {
    const start = points[index];
    const end = points[(index + 1) % points.length];
    const deltaX = end.x - start.x;
    const deltaY = end.y - start.y;
    const lengthSquared = deltaX * deltaX + deltaY * deltaY;
    const amount =
      lengthSquared === 0
        ? 0
        : clamp(
            ((point.x - start.x) * deltaX +
              (point.y - start.y) * deltaY) /
              lengthSquared,
            0,
            1
          );
    closest = Math.min(
      closest,
      Math.hypot(
        point.x - (start.x + deltaX * amount),
        point.y - (start.y + deltaY * amount)
      )
    );
  }
  return closest;
}

function getDisplayDepth(body: Readonly<CelestialBodyState>): number {
  const depth = body.metadata?.displayDepth;
  return typeof depth === 'number' && Number.isFinite(depth) ? depth : 0;
}

function identityQuaternion(): Quaternion {
  return { x: 0, y: 0, z: 0, w: 1 };
}

function quaternionFromTrackball(
  from: Readonly<Point2D>,
  to: Readonly<Point2D>
): Quaternion {
  return quaternionFromUnitVectors(
    projectToTrackball(from),
    projectToTrackball(to)
  );
}

function projectToTrackball(point: Readonly<Point2D>): Point3D {
  const lengthSquared = point.x * point.x + point.y * point.y;
  if (lengthSquared <= 1) {
    return {
      x: point.x,
      y: point.y,
      z: Math.sqrt(1 - lengthSquared),
    };
  }
  const inverseLength = 1 / Math.sqrt(lengthSquared);
  return {
    x: point.x * inverseLength,
    y: point.y * inverseLength,
    z: 0,
  };
}

function quaternionFromUnitVectors(
  from: Readonly<Point3D>,
  to: Readonly<Point3D>
): Quaternion {
  const dot = clamp(
    from.x * to.x + from.y * to.y + from.z * to.z,
    -1,
    1
  );
  if (dot < -0.999999) {
    const axis =
      Math.abs(from.x) < Math.abs(from.z)
        ? { x: 0, y: -from.z, z: from.y }
        : { x: -from.y, y: from.x, z: 0 };
    return normalizeQuaternion({ ...axis, w: 0 });
  }
  return normalizeQuaternion({
    x: from.y * to.z - from.z * to.y,
    y: from.z * to.x - from.x * to.z,
    z: from.x * to.y - from.y * to.x,
    w: 1 + dot,
  });
}

function multiplyQuaternions(
  left: Readonly<Quaternion>,
  right: Readonly<Quaternion>
): Quaternion {
  return {
    x:
      left.w * right.x +
      left.x * right.w +
      left.y * right.z -
      left.z * right.y,
    y:
      left.w * right.y -
      left.x * right.z +
      left.y * right.w +
      left.z * right.x,
    z:
      left.w * right.z +
      left.x * right.y -
      left.y * right.x +
      left.z * right.w,
    w:
      left.w * right.w -
      left.x * right.x -
      left.y * right.y -
      left.z * right.z,
  };
}

function normalizeQuaternion(
  quaternion: Readonly<Quaternion>
): Quaternion {
  const length = Math.hypot(
    quaternion.x,
    quaternion.y,
    quaternion.z,
    quaternion.w
  );
  if (length < 1e-8) return identityQuaternion();
  return {
    x: quaternion.x / length,
    y: quaternion.y / length,
    z: quaternion.z / length,
    w: quaternion.w / length,
  };
}

function rotatePointByQuaternion(
  point: Readonly<Point3D>,
  quaternion: Readonly<Quaternion>
): Point3D {
  const { x, y, z, w } = quaternion;
  return {
    x:
      (1 - 2 * (y * y + z * z)) * point.x +
      2 * (x * y - z * w) * point.y +
      2 * (x * z + y * w) * point.z,
    y:
      2 * (x * y + z * w) * point.x +
      (1 - 2 * (x * x + z * z)) * point.y +
      2 * (y * z - x * w) * point.z,
    z:
      2 * (x * z - y * w) * point.x +
      2 * (y * z + x * w) * point.y +
      (1 - 2 * (x * x + y * y)) * point.z,
  };
}

export function getOrbitalPosition3D(
  radius: number,
  orbitalAngle: number,
  inclination: number,
  ascendingNode: number
): Point3D {
  const cosNode = Math.cos(ascendingNode);
  const sinNode = Math.sin(ascendingNode);
  const cosAngle = Math.cos(orbitalAngle);
  const sinAngle = Math.sin(orbitalAngle);
  const cosInclination = Math.cos(inclination);
  const sinInclination = Math.sin(inclination);
  return {
    x:
      radius *
      (cosNode * cosAngle - sinNode * sinAngle * cosInclination),
    y:
      radius *
      (sinNode * cosAngle + cosNode * sinAngle * cosInclination),
    z: radius * sinAngle * sinInclination,
  };
}

function projectVelocity(
  velocity: Point2D,
  scale: number,
  tilt: number
): Point2D {
  return {
    x: velocity.x * scale,
    y: velocity.y * tilt * scale,
  };
}

function getOrbitSpeed(planet: PlanetPreview): number {
  const periodYears =
    ORBIT_PERIOD_YEARS[planet.id] ??
    Math.pow(Math.max(planet.distanceAU, 0.12), 1.5);
  return (Math.PI * 2) / (EARTH_YEAR_SECONDS * periodYears);
}

function getSpinSpeed(bodyId: string): number {
  const periodDays = ROTATION_PERIOD_DAYS[bodyId] ?? 1;
  const earthPeriodDays = ROTATION_PERIOD_DAYS.earth;
  const direction = Math.sign(periodDays) || 1;
  const relativePeriod = Math.abs(periodDays / earthPeriodDays);
  return direction * (Math.PI * 2) / (EARTH_ROTATION_SECONDS * relativePeriod);
}

function getRotationDirection(bodyId: string): 1 | -1 {
  return (ROTATION_PERIOD_DAYS[bodyId] ?? 1) < 0 ? -1 : 1;
}

function drawSunGlow(
  context2D: CanvasRenderingContext2D,
  center: Readonly<Point2D>,
  radius: number
): void {
  const glow = context2D.createRadialGradient(
    center.x,
    center.y,
    radius * 0.2,
    center.x,
    center.y,
    radius * 2.3
  );
  glow.addColorStop(0, 'rgba(255, 209, 92, 0.92)');
  glow.addColorStop(0.35, 'rgba(244, 128, 38, 0.48)');
  glow.addColorStop(1, 'rgba(244, 102, 30, 0)');
  context2D.save();
  context2D.fillStyle = glow;
  context2D.beginPath();
  context2D.arc(
    center.x,
    center.y,
    radius * 2.3,
    0,
    Math.PI * 2
  );
  context2D.fill();
  context2D.restore();
}

function drawOrbitLegend(
  context2D: CanvasRenderingContext2D,
  viewportWidth: number,
  viewportHeight: number,
  hoveredOrbit: OrbitKind | null
): void {
  const width = 124;
  const height = 58;
  const x = Math.max(8, viewportWidth - width - 14);
  const y = Math.max(8, viewportHeight - height - 14);
  context2D.save();
  context2D.fillStyle = 'rgba(5, 8, 21, 0.82)';
  context2D.strokeStyle = 'rgba(255, 255, 255, 0.16)';
  context2D.lineWidth = 1;
  context2D.beginPath();
  addRoundedRectanglePath(context2D, x, y, width, height, 10);
  context2D.fill();
  context2D.stroke();

  drawLegendRow(
    context2D,
    x + 12,
    y + 20,
    EARTH_ORBIT_COLOR,
    '地球轨道',
    hoveredOrbit === 'earth'
  );
  drawLegendRow(
    context2D,
    x + 12,
    y + 40,
    MOON_ORBIT_COLOR,
    '月球轨道',
    hoveredOrbit === 'moon'
  );
  context2D.restore();
}

function drawLegendRow(
  context2D: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  label: string,
  highlighted: boolean
): void {
  context2D.save();
  context2D.strokeStyle = color;
  context2D.lineWidth = highlighted ? 4 : 2.5;
  context2D.shadowColor = color;
  context2D.shadowBlur = highlighted ? 8 : 2;
  context2D.beginPath();
  context2D.moveTo(x, y);
  context2D.lineTo(x + 28, y);
  context2D.stroke();
  context2D.shadowBlur = 0;
  context2D.fillStyle = highlighted ? '#ffffff' : '#dce8ff';
  context2D.font = `${highlighted ? 700 : 500} 12px "PingFang SC", "Microsoft YaHei", sans-serif`;
  context2D.textAlign = 'left';
  context2D.textBaseline = 'middle';
  context2D.fillText(label, x + 38, y);
  context2D.restore();
}

function drawOrbitTooltip(
  context2D: CanvasRenderingContext2D,
  orbit: OrbitKind,
  point: Point2D,
  viewportWidth: number,
  viewportHeight: number
): void {
  const text = orbit === 'earth' ? '地球轨道' : '月球轨道';
  const color =
    orbit === 'earth' ? EARTH_ORBIT_COLOR : MOON_ORBIT_COLOR;
  context2D.save();
  context2D.font = '600 12px "PingFang SC", "Microsoft YaHei", sans-serif';
  context2D.textAlign = 'left';
  context2D.textBaseline = 'middle';
  const width = context2D.measureText(text).width + 22;
  const x = Math.max(
    8,
    Math.min(viewportWidth - width - 8, point.x + 14)
  );
  const y = Math.max(12, Math.min(viewportHeight - 12, point.y - 16));
  context2D.fillStyle = 'rgba(5, 8, 21, 0.78)';
  context2D.beginPath();
  addRoundedRectanglePath(
    context2D,
    x,
    y - 10,
    width,
    20,
    8
  );
  context2D.fill();
  context2D.fillStyle = color;
  context2D.beginPath();
  context2D.arc(x + 8, y, 3, 0, Math.PI * 2);
  context2D.fill();
  context2D.fillStyle = '#ffffff';
  context2D.fillText(text, x + 15, y);
  context2D.restore();
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
  context2D.quadraticCurveTo(x + width, y, x + width, y + cornerRadius);
  context2D.lineTo(x + width, y + height - cornerRadius);
  context2D.quadraticCurveTo(
    x + width,
    y + height,
    x + width - cornerRadius,
    y + height
  );
  context2D.lineTo(x + cornerRadius, y + height);
  context2D.quadraticCurveTo(x, y + height, x, y + height - cornerRadius);
  context2D.lineTo(x, y + cornerRadius);
  context2D.quadraticCurveTo(x, y, x + cornerRadius, y);
  context2D.closePath();
}

function normalizeAngle(angle: number): number {
  const fullTurn = Math.PI * 2;
  return ((angle % fullTurn) + fullTurn) % fullTurn;
}

function formatCompassDirection(azimuth: number): string {
  const labels = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
  const index =
    Math.round(normalizeAngle(azimuth) / (Math.PI / 4)) % labels.length;
  return labels[index];
}

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function angleTowardSun(position: Point2D): number {
  return Math.atan2(-position.y, -position.x);
}

function getBodyBaseRadius(
  state: SolarSystemSceneState,
  bodyId: string
): number {
  const body = getBodyPreview(bodyId);
  if (!body) return 13;
  const { width, height } = state.viewport;
  const tilt = width < 768 ? 0.58 : 0.46;
  return (
    body.radius *
    getResponsiveOrbitScale(width, height, tilt)
  );
}

function setSphereRotationTarget(
  canvas: HTMLCanvasElement,
  bodyId: string | null,
  referenceZoom = VISIT_REFERENCE_ZOOM
): void {
  if (bodyId) {
    canvas.dataset.sphereRotationTarget = bodyId;
    canvas.dataset.sphereRotationHitScale =
      bodyId === 'saturn' ? '2.3' : '1';
    canvas.dataset.sphereRotationReferenceZoom =
      String(referenceZoom);
  } else {
    delete canvas.dataset.sphereRotationTarget;
    delete canvas.dataset.sphereRotationHitScale;
    delete canvas.dataset.sphereRotationReferenceZoom;
  }
}

function setSolarSystemArcball(
  canvas: HTMLCanvasElement,
  enabled: boolean
): void {
  if (enabled) {
    canvas.dataset.solarSystemArcball = 'true';
  } else {
    delete canvas.dataset.solarSystemArcball;
  }
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

function getBodyPreview(bodyId: string): PlanetPreview | null {
  if (bodyId === 'sun') return SUN;
  if (bodyId === 'moon') return MOON;
  return PLANET_BY_ID.get(bodyId) ?? null;
}

function getBodyName(bodyId: string): string {
  return getBodyPreview(bodyId)?.nameCN ?? '彗星';
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}

function smoothStep(value: number): number {
  const clamped = clamp(value, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
}
