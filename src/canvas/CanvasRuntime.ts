import {
  AnimationController,
  type AnimationControllerOptions,
} from './AnimationController.js';
import { Camera2D, type Camera2DOptions } from './Camera2D.js';
import { EventBus } from './EventBus.js';
import { LayerManager } from './LayerManager.js';
import { SceneManager } from './SceneManager.js';
import { WorldStateStore } from './WorldState.js';
import type {
  CanvasRuntimeContext,
  CanvasViewport,
  FrameSnapshot,
  RuntimeEventMap,
} from './types.js';

export interface CanvasRuntimeOptions {
  canvas: HTMLCanvasElement;
  container: HTMLElement;
  animation?: AnimationControllerOptions;
  camera?: Camera2DOptions;
  autoClear?: boolean;
  maxDevicePixelRatio?: number;
}

/**
 * Canvas 公共运行时。
 *
 * 一个页面只应创建一个实例，由它统一驱动主场景和专题动画层。
 */
export class CanvasRuntime {
  readonly animation: AnimationController;
  readonly camera: Camera2D;
  readonly world: WorldStateStore;
  readonly scenes: SceneManager;
  readonly layers: LayerManager;
  readonly events = new EventBus<RuntimeEventMap>();

  private readonly canvas: HTMLCanvasElement;
  private readonly container: HTMLElement;
  private readonly context2D: CanvasRenderingContext2D;
  private readonly autoClear: boolean;
  private readonly maxDevicePixelRatio: number;
  private readonly disposers: Array<() => void> = [];
  private viewport: CanvasViewport = { width: 1, height: 1, dpr: 1 };
  private resizeObserver: ResizeObserver | null = null;
  private disposed = false;

  get canvasElement(): HTMLCanvasElement {
    return this.canvas;
  }

  get containerElement(): HTMLElement {
    return this.container;
  }

  constructor(options: CanvasRuntimeOptions) {
    this.canvas = options.canvas;
    this.container = options.container;
    this.autoClear = options.autoClear ?? true;
    this.maxDevicePixelRatio = Math.max(1, options.maxDevicePixelRatio ?? 2);

    const context2D = this.canvas.getContext('2d');
    if (!context2D) {
      throw new Error('Canvas 2D context is not available');
    }
    this.context2D = context2D;

    this.animation = new AnimationController(options.animation);
    this.camera = new Camera2D(options.camera);
    this.world = new WorldStateStore();

    const runtimeContext: CanvasRuntimeContext = {
      canvas: this.canvas,
      context2D: this.context2D,
      camera: this.camera,
      world: this.world,
      getViewport: () => ({ ...this.viewport }),
      invalidate: () => this.renderOnce(),
      switchScene: sceneId => this.scenes.switchTo(sceneId),
    };

    this.scenes = new SceneManager(runtimeContext);
    this.layers = new LayerManager(runtimeContext);

    this.disposers.push(
      this.animation.onFrame(frame => this.handleFrame(frame)),
      this.animation.onReset(() => this.handleReset()),
      this.animation.onStateChange(status =>
        this.events.emit('animationStateChange', status)
      ),
      this.camera.onChange(state => {
        this.events.emit('cameraChange', state);
        if (!this.animation.isRunning) {
          this.renderOnce();
        }
      }),
      this.scenes.onChange(change => this.events.emit('sceneChange', change)),
      this.world.onChange(change =>
        this.events.emit('worldStateChange', change)
      )
    );

    this.bindResizeHandling();
    this.resize();
  }

  getViewport(): Readonly<CanvasViewport> {
    return { ...this.viewport };
  }

  resize(): void {
    this.assertUsable();
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    const dpr = Math.min(
      this.maxDevicePixelRatio,
      Math.max(1, window.devicePixelRatio || 1)
    );

    const pixelWidth = Math.max(1, Math.round(width * dpr));
    const pixelHeight = Math.max(1, Math.round(height * dpr));
    if (this.canvas.width !== pixelWidth) this.canvas.width = pixelWidth;
    if (this.canvas.height !== pixelHeight) this.canvas.height = pixelHeight;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    this.viewport = { width, height, dpr };
    this.camera.setViewport(this.viewport);
    this.scenes.resize(this.viewport);
    this.layers.resize(this.viewport);
    this.renderOnce();
  }

  renderOnce(): void {
    if (this.disposed || !this.hasRenderableContent()) return;
    this.render(this.animation.getSnapshot());
  }

  reset(): void {
    this.assertUsable();
    this.animation.reset();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    window.removeEventListener('resize', this.handleWindowResize);

    for (const dispose of this.disposers.splice(0)) {
      dispose();
    }
    this.layers.dispose();
    this.scenes.dispose();
    this.world.dispose();
    this.camera.dispose();
    this.animation.dispose();
    this.events.clear();
  }

  private handleFrame(frame: Readonly<FrameSnapshot>): void {
    if (!this.hasRenderableContent()) return;
    this.scenes.update(frame);
    this.layers.update(frame);
    this.render(frame);
  }

  private render(frame: Readonly<FrameSnapshot>): void {
    const { width, height, dpr } = this.viewport;
    this.context2D.save();
    try {
      this.context2D.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (this.autoClear) {
        this.context2D.clearRect(0, 0, width, height);
      }
      this.scenes.render(frame);
      this.layers.render(frame);
    } finally {
      this.context2D.restore();
    }
  }

  private handleReset(): void {
    this.camera.reset();
    this.scenes.reset();
    this.layers.reset();
    this.renderOnce();
  }

  private hasRenderableContent(): boolean {
    return this.scenes.hasActiveScene || this.layers.hasEnabledLayers;
  }

  private bindResizeHandling(): void {
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.container);
      return;
    }
    window.addEventListener('resize', this.handleWindowResize);
  }

  private readonly handleWindowResize = (): void => {
    this.resize();
  };

  private assertUsable(): void {
    if (this.disposed) {
      throw new Error('CanvasRuntime has been disposed');
    }
  }
}
