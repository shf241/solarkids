import type {
  CameraMode,
  CameraState,
  CanvasViewport,
  Point2D,
} from './types.js';

export interface Camera2DOptions {
  initialState?: Partial<CameraState>;
  minZoom?: number;
  maxZoom?: number;
}

export type CameraChangeListener = (state: Readonly<CameraState>) => void;

const DEFAULT_STATE: CameraState = {
  position: { x: 0, y: 0 },
  zoom: 1,
  rotation: 0,
  observerYaw: 0,
  observerPitch: 0,
  mode: 'overview',
  focusTargetId: null,
};

/** 公共二维相机，负责世界坐标与屏幕坐标转换。 */
export class Camera2D {
  private readonly initialState: CameraState;
  private readonly minZoom: number;
  private readonly maxZoom: number;
  private readonly listeners = new Set<CameraChangeListener>();
  private stateValue: CameraState;
  private viewport: CanvasViewport = { width: 1, height: 1, dpr: 1 };

  constructor(options: Camera2DOptions = {}) {
    this.minZoom = Math.max(0.01, options.minZoom ?? 0.25);
    this.maxZoom = Math.max(this.minZoom, options.maxZoom ?? 8);
    this.initialState = mergeCameraState(DEFAULT_STATE, options.initialState);
    this.initialState.zoom = clamp(this.initialState.zoom, this.minZoom, this.maxZoom);
    this.stateValue = cloneCameraState(this.initialState);
  }

  get state(): Readonly<CameraState> {
    return cloneCameraState(this.stateValue);
  }

  setViewport(viewport: Readonly<CanvasViewport>): void {
    this.viewport = {
      width: Math.max(1, viewport.width),
      height: Math.max(1, viewport.height),
      dpr: Math.max(1, viewport.dpr),
    };
  }

  setState(next: Partial<CameraState>): void {
    const merged = mergeCameraState(this.stateValue, next);
    merged.zoom = clamp(merged.zoom, this.minZoom, this.maxZoom);
    merged.observerYaw = normalizeAngle(merged.observerYaw);
    merged.observerPitch = clamp(
      merged.observerPitch,
      -Math.PI / 3,
      Math.PI / 3
    );
    this.stateValue = merged;
    this.emitChange();
  }

  setMode(mode: CameraMode, focusTargetId: string | null = null): void {
    this.setState({ mode, focusTargetId });
  }

  panByScreen(deltaX: number, deltaY: number): void {
    const cos = Math.cos(this.stateValue.rotation);
    const sin = Math.sin(this.stateValue.rotation);
    const worldX = (cos * deltaX + sin * deltaY) / this.stateValue.zoom;
    const worldY = (-sin * deltaX + cos * deltaY) / this.stateValue.zoom;

    this.setState({
      position: {
        x: this.stateValue.position.x - worldX,
        y: this.stateValue.position.y - worldY,
      },
    });
  }

  zoomBy(factor: number, anchor?: Point2D): void {
    if (!Number.isFinite(factor) || factor <= 0) return;
    const screenAnchor = anchor ?? {
      x: this.viewport.width / 2,
      y: this.viewport.height / 2,
    };
    const worldBefore = this.screenToWorld(screenAnchor);
    const nextZoom = clamp(
      this.stateValue.zoom * factor,
      this.minZoom,
      this.maxZoom
    );

    if (nextZoom === this.stateValue.zoom) return;
    this.stateValue.zoom = nextZoom;
    const worldAfter = this.screenToWorld(screenAnchor);
    this.stateValue.position = {
      x: this.stateValue.position.x + worldBefore.x - worldAfter.x,
      y: this.stateValue.position.y + worldBefore.y - worldAfter.y,
    };
    this.emitChange();
  }

  rotateBy(radians: number): void {
    if (!Number.isFinite(radians)) return;
    this.setState({ rotation: this.stateValue.rotation + radians });
  }

  lookBy(yawRadians: number, pitchRadians: number): void {
    if (!Number.isFinite(yawRadians) || !Number.isFinite(pitchRadians)) return;
    this.setState({
      observerYaw: normalizeAngle(
        this.stateValue.observerYaw + yawRadians
      ),
      observerPitch: clamp(
        this.stateValue.observerPitch + pitchRadians,
        -Math.PI / 3,
        Math.PI / 3
      ),
    });
  }

  reset(): void {
    this.stateValue = cloneCameraState(this.initialState);
    this.emitChange();
  }

  worldToScreen(point: Point2D): Point2D {
    const deltaX = point.x - this.stateValue.position.x;
    const deltaY = point.y - this.stateValue.position.y;
    const cos = Math.cos(this.stateValue.rotation);
    const sin = Math.sin(this.stateValue.rotation);

    return {
      x:
        this.viewport.width / 2 +
        (deltaX * cos - deltaY * sin) * this.stateValue.zoom,
      y:
        this.viewport.height / 2 +
        (deltaX * sin + deltaY * cos) * this.stateValue.zoom,
    };
  }

  screenToWorld(point: Point2D): Point2D {
    const scaledX =
      (point.x - this.viewport.width / 2) / this.stateValue.zoom;
    const scaledY =
      (point.y - this.viewport.height / 2) / this.stateValue.zoom;
    const cos = Math.cos(this.stateValue.rotation);
    const sin = Math.sin(this.stateValue.rotation);

    return {
      x: this.stateValue.position.x + scaledX * cos + scaledY * sin,
      y: this.stateValue.position.y - scaledX * sin + scaledY * cos,
    };
  }

  applyTransform(context: CanvasRenderingContext2D): void {
    context.translate(this.viewport.width / 2, this.viewport.height / 2);
    context.scale(this.stateValue.zoom, this.stateValue.zoom);
    context.rotate(this.stateValue.rotation);
    context.translate(
      -this.stateValue.position.x,
      -this.stateValue.position.y
    );
  }

  onChange(listener: CameraChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    this.listeners.clear();
  }

  private emitChange(): void {
    const state = this.state;
    for (const listener of [...this.listeners]) {
      listener(state);
    }
  }
}

function mergeCameraState(
  base: CameraState,
  next: Partial<CameraState> | undefined
): CameraState {
  return {
    position: {
      x: next?.position?.x ?? base.position.x,
      y: next?.position?.y ?? base.position.y,
    },
    zoom: next?.zoom ?? base.zoom,
    rotation: next?.rotation ?? base.rotation,
    observerYaw: next?.observerYaw ?? base.observerYaw,
    observerPitch: next?.observerPitch ?? base.observerPitch,
    mode: next?.mode ?? base.mode,
    focusTargetId:
      next?.focusTargetId === undefined
        ? base.focusTargetId
        : next.focusTargetId,
  };
}

function cloneCameraState(state: CameraState): CameraState {
  return {
    ...state,
    position: { ...state.position },
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeAngle(radians: number): number {
  const fullTurn = Math.PI * 2;
  return ((radians + Math.PI) % fullTurn + fullTurn) % fullTurn - Math.PI;
}
