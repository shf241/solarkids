import { AnimationClock, type AnimationClockOptions } from './AnimationClock.js';
import type {
  AnimationStatus,
  FrameScheduler,
  FrameSnapshot,
} from './types.js';

export type FrameListener = (frame: Readonly<FrameSnapshot>) => void;
export type AnimationStateListener = (status: AnimationStatus) => void;
export type AnimationResetListener = () => void;

export interface AnimationControllerOptions extends AnimationClockOptions {
  scheduler?: FrameScheduler;
}

const browserFrameScheduler: FrameScheduler = {
  request: callback => window.requestAnimationFrame(callback),
  cancel: requestId => window.cancelAnimationFrame(requestId),
  now: () => performance.now(),
};

/** 项目内唯一的 requestAnimationFrame 控制器。 */
export class AnimationController {
  readonly clock: AnimationClock;

  private readonly scheduler: FrameScheduler;
  private readonly frameListeners = new Set<FrameListener>();
  private readonly stateListeners = new Set<AnimationStateListener>();
  private readonly resetListeners = new Set<AnimationResetListener>();
  private statusValue: AnimationStatus = 'idle';
  private requestId: number | null = null;

  constructor(options: AnimationControllerOptions = {}) {
    this.clock = new AnimationClock(options);
    this.scheduler = options.scheduler ?? browserFrameScheduler;
  }

  get status(): AnimationStatus {
    return this.statusValue;
  }

  get isRunning(): boolean {
    return this.statusValue === 'running';
  }

  start(): void {
    this.assertUsable();
    if (this.statusValue === 'running') return;

    this.clock.synchronize();
    this.setStatus('running');
    this.scheduleNextFrame();
  }

  pause(): void {
    this.assertUsable();
    if (this.statusValue !== 'running') return;

    this.cancelScheduledFrame();
    this.clock.synchronize();
    this.setStatus('paused');
  }

  resume(): void {
    this.start();
  }

  toggle(): void {
    if (this.statusValue === 'running') {
      this.pause();
    } else {
      this.start();
    }
  }

  stop(): void {
    this.assertUsable();
    this.cancelScheduledFrame();
    this.clock.reset();
    this.setStatus('stopped');
  }

  reset(): void {
    this.assertUsable();
    this.clock.reset();
    for (const listener of [...this.resetListeners]) {
      safelyInvoke(listener);
    }
  }

  setTimeScale(timeScale: number): void {
    this.assertUsable();
    this.clock.setTimeScale(timeScale);
  }

  onFrame(listener: FrameListener): () => void {
    this.frameListeners.add(listener);
    return () => this.frameListeners.delete(listener);
  }

  onStateChange(listener: AnimationStateListener): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  onReset(listener: AnimationResetListener): () => void {
    this.resetListeners.add(listener);
    return () => this.resetListeners.delete(listener);
  }

  getSnapshot(): Readonly<FrameSnapshot> {
    return this.clock.snapshot(this.scheduler.now());
  }

  dispose(): void {
    if (this.statusValue === 'disposed') return;
    this.cancelScheduledFrame();
    this.frameListeners.clear();
    this.resetListeners.clear();
    this.setStatus('disposed');
    this.stateListeners.clear();
  }

  private readonly handleFrame: FrameRequestCallback = timestampMs => {
    this.requestId = null;
    if (this.statusValue !== 'running') return;

    const frame = this.clock.tick(timestampMs);
    for (const listener of [...this.frameListeners]) {
      safelyInvoke(() => listener(frame));
    }

    if (this.statusValue === 'running') {
      this.scheduleNextFrame();
    }
  };

  private scheduleNextFrame(): void {
    if (this.requestId !== null || this.statusValue !== 'running') return;
    this.requestId = this.scheduler.request(this.handleFrame);
  }

  private cancelScheduledFrame(): void {
    if (this.requestId === null) return;
    this.scheduler.cancel(this.requestId);
    this.requestId = null;
  }

  private setStatus(status: AnimationStatus): void {
    if (status === this.statusValue) return;
    this.statusValue = status;
    for (const listener of [...this.stateListeners]) {
      safelyInvoke(() => listener(status));
    }
  }

  private assertUsable(): void {
    if (this.statusValue === 'disposed') {
      throw new Error('AnimationController has been disposed');
    }
  }
}

function safelyInvoke(listener: () => void): void {
  try {
    listener();
  } catch (error) {
    console.error('Canvas animation callback failed', error);
  }
}
