import type { Point2D } from '../types.js';

export const SOLAR_RAIN_SCENE_ID = 'solar-rain';

export interface SolarWindParticle {
  angle: number;
  progress: number;
  speed: number;
  lane: number;
  phase: number;
}

const DEFAULT_PARTICLE_COUNT = 72;
const TAU = Math.PI * 2;

export interface ProjectedOrbitGeometry {
  center: Point2D;
  radiusX: number;
  radiusY: number;
  body: Point2D;
}

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

export function calculateOrbitRadiusRatio(
  targetX: number,
  centerX: number,
  referenceRadius: number,
): number {
  if (
    !Number.isFinite(targetX) ||
    !Number.isFinite(centerX) ||
    !Number.isFinite(referenceRadius) ||
    referenceRadius <= 0
  ) {
    throw new TypeError('Orbit geometry must use finite positive dimensions.');
  }

  return (targetX - centerX) / referenceRadius;
}

export function createProjectedOrbitGeometry(
  center: Readonly<Point2D>,
  radiusX: number,
  verticalScale = 0.42,
): ProjectedOrbitGeometry {
  if (
    !Number.isFinite(center.x) ||
    !Number.isFinite(center.y) ||
    !Number.isFinite(radiusX) ||
    radiusX <= 0 ||
    !Number.isFinite(verticalScale) ||
    verticalScale <= 0
  ) {
    throw new TypeError('Projected orbit geometry must be finite and positive.');
  }

  const radiusY = radiusX * verticalScale;
  return {
    center: { ...center },
    radiusX,
    radiusY,
    body: {
      x: center.x + radiusX,
      y: center.y,
    },
  };
}

export function shouldSaveOrbitAttempt(
  completed: boolean,
  resultSaved: boolean,
): boolean {
  return completed && !resultSaved;
}
