import type {
  CanvasRuntimeContext,
  CanvasScene,
  CanvasViewport,
  FrameSnapshot,
  SceneChange,
} from './types.js';

export type SceneChangeListener = (change: Readonly<SceneChange>) => void;

/** 管理互斥的主场景，例如太阳系、日月食或彗星专题。 */
export class SceneManager {
  private readonly scenes = new Map<string, CanvasScene>();
  private readonly listeners = new Set<SceneChangeListener>();
  private activeSceneIdValue: string | null = null;
  private viewport: CanvasViewport = { width: 1, height: 1, dpr: 1 };

  constructor(private readonly runtimeContext: CanvasRuntimeContext) {}

  get activeSceneId(): string | null {
    return this.activeSceneIdValue;
  }

  get hasActiveScene(): boolean {
    return this.activeSceneIdValue !== null;
  }

  register(scene: CanvasScene): () => void {
    if (this.scenes.has(scene.id)) {
      throw new Error(`Canvas scene "${scene.id}" is already registered`);
    }
    this.scenes.set(scene.id, scene);
    return () => this.unregister(scene.id);
  }

  unregister(sceneId: string): void {
    const scene = this.scenes.get(sceneId);
    if (!scene) return;

    if (this.activeSceneIdValue === sceneId) {
      scene.exit?.(this.runtimeContext);
      this.activeSceneIdValue = null;
      this.emitChange(sceneId, null);
    }
    scene.dispose?.();
    this.scenes.delete(sceneId);
  }

  has(sceneId: string): boolean {
    return this.scenes.has(sceneId);
  }

  list(): readonly string[] {
    return [...this.scenes.keys()];
  }

  switchTo(sceneId: string | null): void {
    if (sceneId === this.activeSceneIdValue) return;
    if (sceneId !== null && !this.scenes.has(sceneId)) {
      throw new Error(`Canvas scene "${sceneId}" is not registered`);
    }

    const previousSceneId = this.activeSceneIdValue;
    const previousScene =
      previousSceneId === null ? null : this.scenes.get(previousSceneId) ?? null;
    previousScene?.exit?.(this.runtimeContext);

    this.activeSceneIdValue = sceneId;
    const nextScene = sceneId === null ? null : this.scenes.get(sceneId) ?? null;
    nextScene?.enter?.(this.runtimeContext);
    nextScene?.resize?.(this.viewport, this.runtimeContext);
    this.emitChange(previousSceneId, sceneId);
    this.runtimeContext.invalidate();
  }

  update(frame: Readonly<FrameSnapshot>): void {
    this.getActiveScene()?.update?.(frame, this.runtimeContext);
  }

  render(frame: Readonly<FrameSnapshot>): void {
    const scene = this.getActiveScene();
    if (!scene) return;

    const context2D = this.runtimeContext.context2D;
    context2D.save();
    try {
      scene.render(frame, this.runtimeContext);
    } finally {
      context2D.restore();
    }
  }

  resize(viewport: Readonly<CanvasViewport>): void {
    this.viewport = { ...viewport };
    this.getActiveScene()?.resize?.(this.viewport, this.runtimeContext);
  }

  reset(): void {
    this.getActiveScene()?.reset?.(this.runtimeContext);
    this.runtimeContext.invalidate();
  }

  onChange(listener: SceneChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    const activeScene = this.getActiveScene();
    activeScene?.exit?.(this.runtimeContext);
    for (const scene of this.scenes.values()) {
      scene.dispose?.();
    }
    this.scenes.clear();
    this.listeners.clear();
    this.activeSceneIdValue = null;
  }

  private getActiveScene(): CanvasScene | null {
    if (this.activeSceneIdValue === null) return null;
    return this.scenes.get(this.activeSceneIdValue) ?? null;
  }

  private emitChange(
    previousSceneId: string | null,
    sceneId: string | null
  ): void {
    const change = { previousSceneId, sceneId };
    for (const listener of [...this.listeners]) {
      listener(change);
    }
  }
}
