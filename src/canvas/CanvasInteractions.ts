import type { CanvasRuntime } from './CanvasRuntime.js';
import type {
  CameraMode,
  CameraState,
  CelestialBodyState,
  FrameSnapshot,
  Point2D,
} from './types.js';

export interface CanvasInteractionOptions {
  dragThreshold?: number;
  wheelZoomIntensity?: number;
  mouseRotationSensitivity?: number;
  focusZoom?: number;
  visitZoom?: number;
  visitDurationMs?: number;
  firstPersonZoom?: number;
  onViewChange?: (view: Readonly<CanvasViewState>) => void;
}

export interface CanvasViewState {
  mode: CameraMode;
  focusTargetId: string | null;
  selectedBodyId: string;
}

export interface GestureSnapshot {
  centroid: Point2D;
  distance: number;
  angle: number;
}

type GestureMode =
  | 'pan'
  | 'mouse-rotate'
  | 'multitouch'
  | 'sphere-rotate'
  | 'scene-rotate'
  | 'first-person-look';

type FocusTransition = {
  bodyId: string;
  startPosition: Point2D;
  startZoom: number;
  targetZoom: number;
  elapsedMs: number;
  durationMs: number;
};

const DEFAULT_SELECTED_BODY = 'earth';

/**
 * 模块6：统一处理 Canvas 相机手势、键盘操作和视角跟随。
 *
 * 太阳系总览中，鼠标与单指拖动用于 Arcball 旋转；
 * Shift + 鼠标拖动用于平移，滚轮用于锚点缩放，双指用于平移和缩放。
 * 地表第一视角中，拖动用于环顾天空而不是平移世界相机。
 */
export class CanvasInteractionController {
  private readonly runtime: CanvasRuntime;
  private readonly canvas: HTMLCanvasElement;
  private readonly dragThreshold: number;
  private readonly wheelZoomIntensity: number;
  private readonly mouseRotationSensitivity: number;
  private readonly focusZoom: number;
  private readonly visitZoom: number;
  private readonly visitDurationMs: number;
  private readonly firstPersonZoom: number;
  private readonly onViewChange?: CanvasInteractionOptions['onViewChange'];
  private readonly pointers = new Map<number, Point2D>();
  private readonly overviewStates = new Map<string, CameraState>();
  private gesture: GestureSnapshot | null = null;
  private gestureTravel = 0;
  private gestureMoved = false;
  private gestureMode: GestureMode | null = null;
  private suppressClickUntil = 0;
  private selectedBodyId = DEFAULT_SELECTED_BODY;
  private lastViewKey = '';
  private focusTransition: FocusTransition | null = null;
  private disposed = false;
  private readonly disposers: Array<() => void> = [];

  constructor(
    runtime: CanvasRuntime,
    options: CanvasInteractionOptions = {}
  ) {
    this.runtime = runtime;
    this.canvas = runtime.canvasElement;
    this.dragThreshold = Math.max(0, options.dragThreshold ?? 4);
    this.wheelZoomIntensity = Math.max(
      0.0001,
      options.wheelZoomIntensity ?? 0.0015
    );
    this.mouseRotationSensitivity = Math.max(
      0.0001,
      options.mouseRotationSensitivity ?? 0.008
    );
    this.focusZoom = Math.max(1, options.focusZoom ?? 1.8);
    this.visitZoom = Math.max(
      this.focusZoom,
      options.visitZoom ?? 3.6
    );
    this.visitDurationMs = Math.max(
      120,
      options.visitDurationMs ?? 900
    );
    this.firstPersonZoom = Math.min(
      2,
      Math.max(0.5, options.firstPersonZoom ?? 1)
    );
    this.onViewChange = options.onViewChange;

    this.canvas.tabIndex = this.canvas.tabIndex >= 0 ? this.canvas.tabIndex : 0;
    this.canvas.setAttribute(
      'aria-label',
      '太阳系交互画布，总览中拖动旋转太阳系、Shift加鼠标拖动平移；地表视角中拖动可环顾天空'
    );
    this.canvas.style.touchAction = 'none';

    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
    this.canvas.addEventListener('pointermove', this.handlePointerMove);
    this.canvas.addEventListener('pointerup', this.handlePointerEnd);
    this.canvas.addEventListener('pointercancel', this.handlePointerEnd);
    this.canvas.addEventListener('wheel', this.handleWheel, {
      passive: false,
    });
    this.canvas.addEventListener('keydown', this.handleKeyDown);
    this.canvas.addEventListener('click', this.handleClickCapture, true);
    document.addEventListener(
      'solarkids:bodySelected',
      this.handleBodySelected
    );
    document.addEventListener(
      'solarkids:visitBody',
      this.handleVisitBody
    );
    document.addEventListener(
      'solarkids:leaveVisit',
      this.handleLeaveVisit
    );

    this.disposers.push(
      this.runtime.world.onChange(change => {
        if (change.bodyId === this.trackedBodyId) {
          this.applyTrackedView();
        }
      }),
      this.runtime.camera.onChange(() => this.emitViewChange()),
      this.runtime.animation.onFrame(this.updateFocusTransition),
      this.runtime.scenes.onChange(change => {
        this.captureOverviewState(change.sceneId);
        this.selectedBodyId =
          change.sceneId === 'comet' ? 'comet' : DEFAULT_SELECTED_BODY;
        this.emitViewChange();
      })
    );

    this.captureOverviewState(this.runtime.scenes.activeSceneId);
    this.emitViewChange();
  }

  get view(): Readonly<CanvasViewState> {
    const camera = this.runtime.camera.state;
    return {
      mode: camera.mode,
      focusTargetId: camera.focusTargetId,
      selectedBodyId: this.selectedBodyId,
    };
  }

  setSelectedBody(bodyId: string): void {
    if (!bodyId) return;
    this.selectedBodyId = bodyId;
    if (this.runtime.camera.state.mode === 'focus') {
      this.focusBody(bodyId);
    } else {
      this.emitViewChange();
    }
  }

  showOverview(): void {
    this.focusTransition = null;
    const sceneId = this.runtime.scenes.activeSceneId;
    const stored = sceneId ? this.overviewStates.get(sceneId) : undefined;
    if (stored) {
      this.runtime.camera.setState({
        ...stored,
        position: { ...stored.position },
        mode: 'overview',
        focusTargetId: null,
      });
      return;
    }
    this.runtime.camera.reset();
  }

  focusSelectedBody(): boolean {
    return this.focusBody(this.selectedBodyId);
  }

  focusBody(bodyId: string): boolean {
    const body = this.runtime.world.getBody(bodyId);
    if (!body) return false;
    this.focusTransition = null;
    this.selectedBodyId = bodyId;
    this.runtime.camera.setState({
      position: getBodyViewPosition(body),
      zoom: Math.max(this.runtime.camera.state.zoom, this.focusZoom),
      mode: 'focus',
      focusTargetId: bodyId,
    });
    return true;
  }

  showEarthFirstPerson(): boolean {
    if (this.runtime.scenes.activeSceneId !== 'solar-system') return false;
    const earth = this.runtime.world.getBody('earth');
    if (!earth) return false;
    this.selectedBodyId = 'earth';
    this.runtime.camera.setState({
      zoom: this.firstPersonZoom,
      rotation: 0,
      observerYaw: 0,
      observerPitch: 0,
      mode: 'earth-first-person',
      focusTargetId: 'earth',
    });
    return true;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    this.canvas.removeEventListener('pointermove', this.handlePointerMove);
    this.canvas.removeEventListener('pointerup', this.handlePointerEnd);
    this.canvas.removeEventListener('pointercancel', this.handlePointerEnd);
    this.canvas.removeEventListener('wheel', this.handleWheel);
    this.canvas.removeEventListener('keydown', this.handleKeyDown);
    this.canvas.removeEventListener('click', this.handleClickCapture, true);
    document.removeEventListener(
      'solarkids:bodySelected',
      this.handleBodySelected
    );
    document.removeEventListener(
      'solarkids:visitBody',
      this.handleVisitBody
    );
    document.removeEventListener(
      'solarkids:leaveVisit',
      this.handleLeaveVisit
    );
    for (const dispose of this.disposers.splice(0)) dispose();
    this.pointers.clear();
    this.gesture = null;
    this.canvas.classList.remove('is-dragging');
    this.canvas.classList.remove('is-rotating');
    this.canvas.classList.remove('is-looking');
    this.canvas.style.touchAction = '';
  }

  private get trackedBodyId(): string | null {
    const camera = this.runtime.camera.state;
    if (camera.mode === 'focus') return camera.focusTargetId;
    return null;
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    this.canvas.focus({ preventScroll: true });
    this.pointers.set(event.pointerId, toCanvasPoint(event, this.canvas));
    this.gesture = createGestureSnapshot([...this.pointers.values()]);
    this.gestureTravel = 0;
    this.gestureMoved = false;
    this.gestureMode = null;
    try {
      this.canvas.setPointerCapture(event.pointerId);
    } catch {
      // Safari 在指针已经结束时可能拒绝 capture；后续事件仍可正常处理。
    }
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (!this.pointers.has(event.pointerId)) return;
    event.preventDefault();
    const previous = this.gesture;
    this.pointers.set(event.pointerId, toCanvasPoint(event, this.canvas));
    const next = createGestureSnapshot([...this.pointers.values()]);
    if (!previous || !next) {
      this.gesture = next;
      return;
    }

    const centroidDelta = {
      x: next.centroid.x - previous.centroid.x,
      y: next.centroid.y - previous.centroid.y,
    };
    const distanceDelta =
      previous.distance > 0 ? next.distance / previous.distance : 1;
    const angleDelta = normalizeAngleDelta(next.angle - previous.angle);
    const movement =
      Math.hypot(centroidDelta.x, centroidDelta.y) +
      Math.abs(next.distance - previous.distance) +
      Math.abs(angleDelta) * 24;
    this.gestureTravel += movement;

    if (this.gestureTravel >= this.dragThreshold) {
      if (!this.gestureMoved) {
        const isFirstPerson =
          this.runtime.camera.state.mode === 'earth-first-person';
        const sphereRotationTarget =
          this.getSphereRotationTarget(previous.centroid);
        const visitedSphereTarget =
          this.getSphereRotationTarget();
        const sceneArcballEnabled =
          this.isSceneArcballEnabled();
        if (
          !isFirstPerson &&
          !sphereRotationTarget &&
          !visitedSphereTarget
        ) {
          if (!sceneArcballEnabled || event.shiftKey) {
            this.detachTrackedView();
          }
        }
        this.gestureMode = isFirstPerson
          ? 'first-person-look'
          : this.pointers.size >= 2
            ? 'multitouch'
          : sphereRotationTarget
            ? 'sphere-rotate'
            : sceneArcballEnabled && !event.shiftKey
              ? 'scene-rotate'
            : event.pointerType === 'mouse' && event.shiftKey
              ? sceneArcballEnabled
                ? 'pan'
                : 'mouse-rotate'
              : 'pan';
        this.canvas.classList.add(
          this.gestureMode === 'first-person-look'
            ? 'is-looking'
            : this.gestureMode === 'mouse-rotate' ||
                this.gestureMode === 'sphere-rotate' ||
                this.gestureMode === 'scene-rotate'
              ? 'is-rotating'
              : 'is-dragging'
        );
      }
      this.gestureMoved = true;
      if (this.gestureMode === 'scene-rotate') {
        const viewport = this.runtime.getViewport();
        const center = {
          x: viewport.width / 2,
          y: viewport.height / 2,
        };
        const radius =
          Math.min(viewport.width, viewport.height) * 0.48;
        document.dispatchEvent(
          new CustomEvent('solarkids:rotateSolarSystem', {
            detail: {
              from: {
                x: (previous.centroid.x - center.x) / radius,
                y: (previous.centroid.y - center.y) / radius,
              },
              to: {
                x: (next.centroid.x - center.x) / radius,
                y: (next.centroid.y - center.y) / radius,
              },
            },
          })
        );
      } else if (this.gestureMode === 'sphere-rotate') {
        const bodyId =
          this.canvas.dataset.sphereRotationTarget ?? null;
        if (bodyId) {
          const { center, radius } =
            this.getVisitedSphereScreenGeometry();
          document.dispatchEvent(
            new CustomEvent('solarkids:rotateVisitedBody', {
              detail: {
                bodyId,
                from: {
                  x: (previous.centroid.x - center.x) / radius,
                  y: (previous.centroid.y - center.y) / radius,
                },
                to: {
                  x: (next.centroid.x - center.x) / radius,
                  y: (next.centroid.y - center.y) / radius,
                },
              },
            })
          );
        }
      } else if (this.gestureMode === 'first-person-look') {
        this.runtime.camera.lookBy(
          -centroidDelta.x * this.mouseRotationSensitivity,
          centroidDelta.y * this.mouseRotationSensitivity * 0.7
        );
        if (this.pointers.size >= 2) {
          this.runtime.camera.zoomBy(distanceDelta, next.centroid);
          this.runtime.camera.lookBy(-angleDelta, 0);
        }
      } else if (this.gestureMode === 'mouse-rotate') {
        this.runtime.camera.rotateBy(
          centroidDelta.x * this.mouseRotationSensitivity
        );
      } else {
        this.runtime.camera.panByScreen(centroidDelta.x, centroidDelta.y);
        if (this.gestureMode === 'multitouch') {
          this.runtime.camera.zoomBy(distanceDelta, next.centroid);
          if (
            !this.isSceneArcballEnabled() &&
            !this.getSphereRotationTarget()
          ) {
            this.runtime.camera.rotateBy(angleDelta);
          }
        }
      }
    }
    this.gesture = next;
  };

  private readonly handlePointerEnd = (event: PointerEvent): void => {
    if (!this.pointers.has(event.pointerId)) return;
    this.pointers.delete(event.pointerId);
    try {
      this.canvas.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer capture 可能已由浏览器自动释放。
    }
    if (this.gestureMoved) {
      this.suppressClickUntil = performance.now() + 350;
    }
    this.gesture = createGestureSnapshot([...this.pointers.values()]);
    this.gestureTravel = 0;
    this.gestureMoved = false;
    this.gestureMode = null;
    this.canvas.classList.remove('is-dragging');
    this.canvas.classList.remove('is-rotating');
    this.canvas.classList.remove('is-looking');
  };

  private readonly handleWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const deltaPixels = normalizeWheelDelta(event, rect.height);
    const factor = clamp(
      Math.exp(-deltaPixels * this.wheelZoomIntensity),
      0.5,
      2
    );
    this.runtime.camera.zoomBy(factor, {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    const panStep = event.shiftKey ? 64 : 32;
    const isFirstPerson =
      this.runtime.camera.state.mode === 'earth-first-person';
    switch (event.key) {
      case 'ArrowLeft':
        if (isFirstPerson) {
          this.runtime.camera.lookBy(-0.12, 0);
        } else {
          this.detachTrackedView();
          this.runtime.camera.panByScreen(panStep, 0);
        }
        break;
      case 'ArrowRight':
        if (isFirstPerson) {
          this.runtime.camera.lookBy(0.12, 0);
        } else {
          this.detachTrackedView();
          this.runtime.camera.panByScreen(-panStep, 0);
        }
        break;
      case 'ArrowUp':
        if (isFirstPerson) {
          this.runtime.camera.lookBy(0, -0.08);
        } else {
          this.detachTrackedView();
          this.runtime.camera.panByScreen(0, panStep);
        }
        break;
      case 'ArrowDown':
        if (isFirstPerson) {
          this.runtime.camera.lookBy(0, 0.08);
        } else {
          this.detachTrackedView();
          this.runtime.camera.panByScreen(0, -panStep);
        }
        break;
      case '+':
      case '=':
        this.runtime.camera.zoomBy(1.2);
        break;
      case '-':
      case '_':
        this.runtime.camera.zoomBy(1 / 1.2);
        break;
      case '0':
        this.showOverview();
        break;
      case 'e':
      case 'E':
        this.showEarthFirstPerson();
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  private readonly handleClickCapture = (event: MouseEvent): void => {
    if (performance.now() >= this.suppressClickUntil) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  private readonly handleBodySelected: EventListener = event => {
    const bodyId = (
      event as CustomEvent<{ bodyId?: string }>
    ).detail?.bodyId;
    if (bodyId) this.setSelectedBody(bodyId);
  };

  private readonly handleVisitBody: EventListener = event => {
    const detail = (
      event as CustomEvent<{ bodyId?: string; zoom?: number }>
    ).detail;
    const bodyId = detail?.bodyId;
    if (!bodyId) return;
    const body = this.runtime.world.getBody(bodyId);
    if (!body) return;
    const camera = this.runtime.camera.state;
    this.selectedBodyId = bodyId;
    this.focusTransition = {
      bodyId,
      startPosition: { ...camera.position },
      startZoom: camera.zoom,
      targetZoom: clamp(
        detail.zoom ?? this.visitZoom,
        camera.zoom,
        4
      ),
      elapsedMs: 0,
      durationMs: this.visitDurationMs,
    };
    this.runtime.camera.setState({
      mode: 'overview',
      focusTargetId: null,
    });
    if (!this.runtime.animation.isRunning) {
      this.runtime.animation.start();
    }
    this.emitViewChange();
  };

  private readonly handleLeaveVisit: EventListener = () => {
    this.focusTransition = null;
    this.showOverview();
  };

  private readonly updateFocusTransition = (
    frame: Readonly<FrameSnapshot>
  ): void => {
    const transition = this.focusTransition;
    if (!transition) return;
    const body = this.runtime.world.getBody(transition.bodyId);
    if (!body) {
      this.focusTransition = null;
      return;
    }
    transition.elapsedMs += frame.unscaledDeltaMs;
    const progress = clamp(
      transition.elapsedMs / transition.durationMs,
      0,
      1
    );
    const eased = smoothStep(progress);
    const targetPosition = getBodyViewPosition(body);
    this.runtime.camera.setState({
      position: {
        x: lerp(
          transition.startPosition.x,
          targetPosition.x,
          eased
        ),
        y: lerp(
          transition.startPosition.y,
          targetPosition.y,
          eased
        ),
      },
      zoom: lerp(
        transition.startZoom,
        transition.targetZoom,
        eased
      ),
      mode: progress >= 1 ? 'focus' : 'overview',
      focusTargetId:
        progress >= 1 ? transition.bodyId : null,
    });
    if (progress >= 1) {
      this.focusTransition = null;
    }
  };

  private detachTrackedView(): void {
    this.focusTransition = null;
    const camera = this.runtime.camera.state;
    if (camera.mode === 'overview') return;
    this.runtime.camera.setState({
      mode: 'overview',
      focusTargetId: null,
    });
  }

  private applyTrackedView(): void {
    const bodyId = this.trackedBodyId;
    if (!bodyId) return;
    const body = this.runtime.world.getBody(bodyId);
    if (!body) return;
    this.runtime.camera.setState({
      position: getBodyViewPosition(body),
      rotation: this.runtime.camera.state.rotation,
    });
  }

  private getSphereRotationTarget(
    point?: Readonly<Point2D>
  ): string | null {
    const target = this.canvas.dataset.sphereRotationTarget;
    const camera = this.runtime.camera.state;
    if (
      !target ||
      camera.mode !== 'focus' ||
      camera.focusTargetId !== target
    ) {
      return null;
    }
    if (point) {
      const { center, radius } =
        this.getVisitedSphereScreenGeometry();
      const configuredHitScale = Number(
        this.canvas.dataset.sphereRotationHitScale ?? 1
      );
      const hitScale =
        Number.isFinite(configuredHitScale) && configuredHitScale > 0
          ? configuredHitScale
          : 1;
      if (
        Math.hypot(
          point.x - center.x,
          point.y - center.y
        ) >
        radius * hitScale * 1.04
      ) {
        return null;
      }
    }
    return target &&
      camera.mode === 'focus' &&
      camera.focusTargetId === target
      ? target
      : null;
  }

  private getVisitedSphereScreenGeometry(): {
    center: Point2D;
    radius: number;
  } {
    const viewport = this.runtime.getViewport();
    const camera = this.runtime.camera.state;
    const targetId =
      this.canvas.dataset.sphereRotationTarget ?? null;
    const targetBody = targetId
      ? this.runtime.world.getBody(targetId)
      : null;
    const center = targetBody
      ? this.runtime.camera.worldToScreen(
          getBodyViewPosition(targetBody)
        )
      : {
          x: viewport.width / 2,
          y: viewport.height / 2,
        };
    const referenceZoom = Number(
      this.canvas.dataset.sphereRotationReferenceZoom ??
        camera.zoom
    );
    const zoomScale =
      Number.isFinite(referenceZoom) && referenceZoom > 0
        ? camera.zoom / referenceZoom
        : 1;
    return {
      center,
      radius:
        Math.min(viewport.width, viewport.height) *
        0.275 *
        zoomScale,
    };
  }

  private isSceneArcballEnabled(): boolean {
    const camera = this.runtime.camera.state;
    return (
      this.canvas.dataset.solarSystemArcball === 'true' &&
      !this.canvas.dataset.sphereRotationTarget &&
      camera.mode === 'overview'
    );
  }

  private captureOverviewState(sceneId: string | null): void {
    if (!sceneId) return;
    const state = this.runtime.camera.state;
    this.overviewStates.set(sceneId, {
      ...state,
      position: { ...state.position },
      mode: 'overview',
      focusTargetId: null,
    });
  }

  private emitViewChange(): void {
    const view = this.view;
    const key = `${view.mode}:${view.focusTargetId ?? ''}:${view.selectedBodyId}`;
    if (key === this.lastViewKey) return;
    this.lastViewKey = key;
    this.onViewChange?.(view);
  }
}

export function getBodyViewPosition(
  body: Readonly<CelestialBodyState>
): Point2D {
  return body.displayPosition
    ? { ...body.displayPosition }
    : { ...body.position };
}

export function createGestureSnapshot(
  points: ReadonlyArray<Readonly<Point2D>>
): GestureSnapshot | null {
  if (points.length === 0) return null;
  if (points.length === 1) {
    return {
      centroid: { ...points[0] },
      distance: 0,
      angle: 0,
    };
  }
  const first = points[0];
  const second = points[1];
  return {
    centroid: {
      x: (first.x + second.x) / 2,
      y: (first.y + second.y) / 2,
    },
    distance: Math.hypot(second.x - first.x, second.y - first.y),
    angle: Math.atan2(second.y - first.y, second.x - first.x),
  };
}

export function normalizeAngleDelta(radians: number): number {
  const fullTurn = Math.PI * 2;
  return ((radians + Math.PI) % fullTurn + fullTurn) % fullTurn - Math.PI;
}

function toCanvasPoint(
  event: PointerEvent,
  canvas: HTMLCanvasElement
): Point2D {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function normalizeWheelDelta(event: WheelEvent, viewportHeight: number): number {
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) return event.deltaY * 16;
  if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    return event.deltaY * viewportHeight;
  }
  return event.deltaY;
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
