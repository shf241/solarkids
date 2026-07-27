import type { Point } from '../../game/index.js';
import type { CanvasViewport, Point2D } from '../types.js';

export const SOLAR_RAIN_SCENE_ID = 'solar-rain';

export interface SolarWindParticle {
  angle: number;
  progress: number;
  speed: number;
  lane: number;
  phase: number;
}

export const GAME_COORDINATE_SPAN = 500;
const DEFAULT_PARTICLE_COUNT = 72;
const TAU = Math.PI * 2;

export function createSolarWindParticles(
  count = DEFAULT_PARTICLE_COUNT,
): SolarWindParticle[] {
  return Array.from({ length: Math.max(0, Math.floor(count)) }, (_, index) => ({
    angle: (index / Math.max(1, count)) * TAU,
    progress: ((index * 17) % Math.max(1, count)) / Math.max(1, count),
    speed: 0.11 + ((index * 7) % 9) * 0.008,
    lane: ((index * 13) % 19) / 18 - 0.5,
    phase: ((index * 11) % 23) / 23,
  }));
}

export function advanceSolarWindParticle(
  particle: Readonly<SolarWindParticle>,
  deltaSeconds: number,
): SolarWindParticle {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
    throw new TypeError('deltaSeconds must be a non-negative finite number.');
  }

  return {
    ...particle,
    progress: (particle.progress + particle.speed * deltaSeconds) % 1,
  };
}

export function normalizeOrbitDrag(
  start: Readonly<Point2D>,
  target: Readonly<Point2D>,
  viewport: Pick<CanvasViewport, 'width' | 'height'>,
): Point {
  const scale = GAME_COORDINATE_SPAN / Math.max(
    1,
    Math.min(viewport.width, viewport.height),
  );
  return {
    x: (target.x - start.x) * scale,
    y: (target.y - start.y) * scale,
  };
}

export function shouldSaveOrbitAttempt(
  completed: boolean,
  resultSaved: boolean,
): boolean {
  return completed && !resultSaved;
}
