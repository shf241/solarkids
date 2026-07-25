import type { FrameSnapshot } from './types.js';

export interface AnimationClockOptions {
  timeScale?: number;
  /** 防止切回后台后出现超大步长。 */
  maxDeltaMs?: number;
}

/** 统一管理真实时间、模拟时间和时间倍率。 */
export class AnimationClock {
  private timeScaleValue: number;
  private readonly maxDeltaMs: number;
  private lastTimestampMs: number | null = null;
  private elapsedMsValue = 0;
  private frameNumberValue = 0;

  constructor(options: AnimationClockOptions = {}) {
    this.timeScaleValue = validateTimeScale(options.timeScale ?? 1);
    this.maxDeltaMs = Math.max(1, options.maxDeltaMs ?? 100);
  }

  get timeScale(): number {
    return this.timeScaleValue;
  }

  get elapsedMs(): number {
    return this.elapsedMsValue;
  }

  get frameNumber(): number {
    return this.frameNumberValue;
  }

  setTimeScale(timeScale: number): void {
    this.timeScaleValue = validateTimeScale(timeScale);
  }

  tick(timestampMs: number): Readonly<FrameSnapshot> {
    const safeTimestamp = Number.isFinite(timestampMs) ? timestampMs : 0;
    const rawDelta =
      this.lastTimestampMs === null
        ? 0
        : Math.max(0, safeTimestamp - this.lastTimestampMs);
    const unscaledDeltaMs = Math.min(rawDelta, this.maxDeltaMs);
    const deltaMs = unscaledDeltaMs * this.timeScaleValue;

    this.lastTimestampMs = safeTimestamp;
    this.elapsedMsValue += deltaMs;
    this.frameNumberValue += 1;

    return {
      timestampMs: safeTimestamp,
      deltaMs,
      unscaledDeltaMs,
      elapsedMs: this.elapsedMsValue,
      timeScale: this.timeScaleValue,
      frameNumber: this.frameNumberValue,
    };
  }

  snapshot(timestampMs: number): Readonly<FrameSnapshot> {
    return {
      timestampMs,
      deltaMs: 0,
      unscaledDeltaMs: 0,
      elapsedMs: this.elapsedMsValue,
      timeScale: this.timeScaleValue,
      frameNumber: this.frameNumberValue,
    };
  }

  /** 暂停或恢复时丢弃旧时间戳，避免恢复后第一帧跳跃。 */
  synchronize(): void {
    this.lastTimestampMs = null;
  }

  reset(): void {
    this.lastTimestampMs = null;
    this.elapsedMsValue = 0;
    this.frameNumberValue = 0;
  }
}

function validateTimeScale(timeScale: number): number {
  if (!Number.isFinite(timeScale) || timeScale <= 0) {
    throw new RangeError('timeScale must be a finite number greater than 0');
  }
  return timeScale;
}
