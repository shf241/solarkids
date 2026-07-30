import type { CelestialBodyState, WorldStateChange } from './types.js';

export type WorldStateListener = (change: Readonly<WorldStateChange>) => void;

/** 模块间共享的只读天体状态来源，由模块1负责持续写入。 */
export class WorldStateStore {
  private readonly bodies = new Map<string, CelestialBodyState>();
  private readonly listeners = new Set<WorldStateListener>();

  setBody(state: CelestialBodyState): void {
    const stored = cloneBodyState(state);
    this.bodies.set(state.id, stored);
    this.emit({ bodyId: state.id, state: cloneBodyState(stored) });
  }

  getBody(bodyId: string): Readonly<CelestialBodyState> | null {
    const state = this.bodies.get(bodyId);
    return state ? cloneBodyState(state) : null;
  }

  getBodies(): ReadonlyArray<Readonly<CelestialBodyState>> {
    return [...this.bodies.values()].map(cloneBodyState);
  }

  hasBody(bodyId: string): boolean {
    return this.bodies.has(bodyId);
  }

  removeBody(bodyId: string): void {
    if (!this.bodies.delete(bodyId)) return;
    this.emit({ bodyId, state: null });
  }

  clear(): void {
    const bodyIds = [...this.bodies.keys()];
    this.bodies.clear();
    for (const bodyId of bodyIds) {
      this.emit({ bodyId, state: null });
    }
  }

  onChange(listener: WorldStateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    this.bodies.clear();
    this.listeners.clear();
  }

  private emit(change: WorldStateChange): void {
    for (const listener of [...this.listeners]) {
      listener(change);
    }
  }
}

function cloneBodyState(state: CelestialBodyState): CelestialBodyState {
  return {
    ...state,
    position: { ...state.position },
    position3D: state.position3D ? { ...state.position3D } : undefined,
    velocity: state.velocity ? { ...state.velocity } : undefined,
    displayPosition: state.displayPosition
      ? { ...state.displayPosition }
      : undefined,
    displayVelocity: state.displayVelocity
      ? { ...state.displayVelocity }
      : undefined,
    metadata: state.metadata ? { ...state.metadata } : undefined,
  };
}
