import type { Camera2D } from './Camera2D.js';
import type { WorldStateStore } from './WorldState.js';

export type AnimationStatus = 'idle' | 'running' | 'paused' | 'stopped' | 'disposed';

export interface FrameSnapshot {
  /** requestAnimationFrame 提供的时间戳，单位毫秒。 */
  timestampMs: number;
  /** 应用时间倍率后的帧间隔，单位毫秒。 */
  deltaMs: number;
  /** 未应用时间倍率的帧间隔，单位毫秒。 */
  unscaledDeltaMs: number;
  /** 应用时间倍率后的累计运行时间，单位毫秒。 */
  elapsedMs: number;
  /** 当前时间倍率。 */
  timeScale: number;
  /** 从最近一次 reset 开始的帧序号。 */
  frameNumber: number;
}

export interface FrameScheduler {
  request(callback: FrameRequestCallback): number;
  cancel(requestId: number): void;
  now(): number;
}

export interface Point2D {
  x: number;
  y: number;
}

export interface CanvasViewport {
  /** CSS 像素宽度。 */
  width: number;
  /** CSS 像素高度。 */
  height: number;
  /** 画布使用的设备像素比。 */
  dpr: number;
}

export type CameraMode = 'overview' | 'focus' | 'earth-first-person';

export interface CameraState {
  position: Point2D;
  zoom: number;
  rotation: number;
  mode: CameraMode;
  focusTargetId: string | null;
}

export interface CelestialBodyState {
  id: string;
  position: Point2D;
  velocity?: Point2D;
  rotation: number;
  orbitAngle?: number;
  radius?: number;
  visible?: boolean;
  metadata?: Readonly<Record<string, unknown>>;
}

export interface CanvasRuntimeContext {
  readonly canvas: HTMLCanvasElement;
  readonly context2D: CanvasRenderingContext2D;
  readonly camera: Camera2D;
  readonly world: WorldStateStore;
  getViewport(): Readonly<CanvasViewport>;
  invalidate(): void;
  switchScene(sceneId: string | null): void;
}

export interface CanvasScene {
  readonly id: string;
  enter?(context: CanvasRuntimeContext): void;
  update?(frame: Readonly<FrameSnapshot>, context: CanvasRuntimeContext): void;
  render(frame: Readonly<FrameSnapshot>, context: CanvasRuntimeContext): void;
  resize?(viewport: Readonly<CanvasViewport>, context: CanvasRuntimeContext): void;
  reset?(context: CanvasRuntimeContext): void;
  exit?(context: CanvasRuntimeContext): void;
  dispose?(): void;
}

export interface CanvasLayer {
  readonly id: string;
  readonly order?: number;
  mount?(context: CanvasRuntimeContext): void;
  update?(frame: Readonly<FrameSnapshot>, context: CanvasRuntimeContext): void;
  render(frame: Readonly<FrameSnapshot>, context: CanvasRuntimeContext): void;
  resize?(viewport: Readonly<CanvasViewport>, context: CanvasRuntimeContext): void;
  reset?(context: CanvasRuntimeContext): void;
  unmount?(context: CanvasRuntimeContext): void;
}

export interface SceneChange {
  previousSceneId: string | null;
  sceneId: string | null;
}

export interface WorldStateChange {
  bodyId: string;
  state: Readonly<CelestialBodyState> | null;
}

export interface RuntimeEventMap {
  animationStateChange: AnimationStatus;
  cameraChange: Readonly<CameraState>;
  sceneChange: Readonly<SceneChange>;
  worldStateChange: Readonly<WorldStateChange>;
  skinChange: unknown;
}
