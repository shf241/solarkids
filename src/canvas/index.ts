import { CanvasRuntime, type CanvasRuntimeOptions } from './CanvasRuntime.js';

let activeRuntime: CanvasRuntime | null = null;

/** 创建并登记页面唯一的 Canvas 运行时。 */
export function createCanvasRuntime(
  options: CanvasRuntimeOptions
): CanvasRuntime {
  activeRuntime?.dispose();
  activeRuntime = new CanvasRuntime(options);
  return activeRuntime;
}

/** 供专题模块获取公共运行时；应用初始化前调用会返回 null。 */
export function getCanvasRuntime(): CanvasRuntime | null {
  return activeRuntime;
}

export function disposeCanvasRuntime(): void {
  activeRuntime?.dispose();
  activeRuntime = null;
}

export { AnimationClock } from './AnimationClock.js';
export { AnimationController } from './AnimationController.js';
export { Camera2D } from './Camera2D.js';
export {
  CanvasInteractionController,
  createGestureSnapshot,
  getBodyViewPosition,
  normalizeAngleDelta,
} from './CanvasInteractions.js';
export { CanvasRuntime } from './CanvasRuntime.js';
export { EventBus } from './EventBus.js';
export {
  EARTH_OBLIQUITY_RADIANS,
  equatorialToHorizontal,
  getBodyPosition3D,
  getEarthObserverHorizonY,
  getObserverLatitude,
  getObserverSiderealAngle,
  normalizeObserverAngle,
  projectBodyToEarthSky,
  rotateEclipticToEquatorial,
} from './EarthObserverView.js';
export { LayerManager } from './LayerManager.js';
export { SceneManager } from './SceneManager.js';
export { WorldStateStore } from './WorldState.js';
export {
  createCometScene,
  getCometTailAppearance,
  getHalleyOrbitState,
  solveKeplerEquation,
  HALLEY_ORBIT,
} from './cometScene.js';
export {
  createSolarSystemScene,
  getOrbitalPosition3D,
} from './solarSystemScene.js';
export {
  bindCanvasControlEvents,
  speedLevelToTimeScale,
} from './controlBridge.js';
export type {
  AnimationControllerOptions,
  AnimationResetListener,
  AnimationStateListener,
  FrameListener,
} from './AnimationController.js';
export type { AnimationClockOptions } from './AnimationClock.js';
export type { Camera2DOptions, CameraChangeListener } from './Camera2D.js';
export type {
  CanvasInteractionOptions,
  CanvasViewState,
  GestureSnapshot,
} from './CanvasInteractions.js';
export type { CanvasRuntimeOptions } from './CanvasRuntime.js';
export type { EventListener } from './EventBus.js';
export type {
  EarthObserverProjection,
  EarthObserverProjectionOptions,
} from './EarthObserverView.js';
export type { SceneChangeListener } from './SceneManager.js';
export type { WorldStateListener } from './WorldState.js';
export type {
  AnimationStatus,
  CameraMode,
  CameraState,
  CanvasLayer,
  CanvasRuntimeContext,
  CanvasScene,
  CanvasViewport,
  CelestialBodyState,
  FrameScheduler,
  FrameSnapshot,
  Point2D,
  Point3D,
  RuntimeEventMap,
  SceneChange,
  WorldStateChange,
} from './types.js';
