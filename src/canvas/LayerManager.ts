import type {
  CanvasLayer,
  CanvasRuntimeContext,
  CanvasViewport,
  FrameSnapshot,
} from './types.js';

interface LayerEntry {
  layer: CanvasLayer;
  enabled: boolean;
}

/** 管理可叠加的专题动画层，适合磁场、太阳风、标注等效果。 */
export class LayerManager {
  private readonly layers = new Map<string, LayerEntry>();
  private viewport: CanvasViewport = { width: 1, height: 1, dpr: 1 };

  constructor(private readonly runtimeContext: CanvasRuntimeContext) {}

  get hasEnabledLayers(): boolean {
    return this.getOrderedEntries().some(entry => entry.enabled);
  }

  register(layer: CanvasLayer, enabled = true): () => void {
    if (this.layers.has(layer.id)) {
      throw new Error(`Canvas layer "${layer.id}" is already registered`);
    }

    layer.mount?.(this.runtimeContext);
    layer.resize?.(this.viewport, this.runtimeContext);
    this.layers.set(layer.id, { layer, enabled });
    this.runtimeContext.invalidate();
    return () => this.unregister(layer.id);
  }

  unregister(layerId: string): void {
    const entry = this.layers.get(layerId);
    if (!entry) return;
    entry.layer.unmount?.(this.runtimeContext);
    this.layers.delete(layerId);
    this.runtimeContext.invalidate();
  }

  has(layerId: string): boolean {
    return this.layers.has(layerId);
  }

  setEnabled(layerId: string, enabled: boolean): void {
    const entry = this.layers.get(layerId);
    if (!entry) {
      throw new Error(`Canvas layer "${layerId}" is not registered`);
    }
    entry.enabled = enabled;
    this.runtimeContext.invalidate();
  }

  update(frame: Readonly<FrameSnapshot>): void {
    for (const { layer, enabled } of this.getOrderedEntries()) {
      if (enabled) {
        layer.update?.(frame, this.runtimeContext);
      }
    }
  }

  render(frame: Readonly<FrameSnapshot>): void {
    const context2D = this.runtimeContext.context2D;
    for (const { layer, enabled } of this.getOrderedEntries()) {
      if (!enabled) continue;
      context2D.save();
      try {
        layer.render(frame, this.runtimeContext);
      } finally {
        context2D.restore();
      }
    }
  }

  resize(viewport: Readonly<CanvasViewport>): void {
    this.viewport = { ...viewport };
    for (const { layer } of this.layers.values()) {
      layer.resize?.(this.viewport, this.runtimeContext);
    }
  }

  reset(): void {
    for (const { layer, enabled } of this.getOrderedEntries()) {
      if (enabled) {
        layer.reset?.(this.runtimeContext);
      }
    }
    this.runtimeContext.invalidate();
  }

  dispose(): void {
    for (const { layer } of this.layers.values()) {
      layer.unmount?.(this.runtimeContext);
    }
    this.layers.clear();
  }

  private getOrderedEntries(): LayerEntry[] {
    return [...this.layers.values()].sort(
      (left, right) => (left.layer.order ?? 0) - (right.layer.order ?? 0)
    );
  }
}
