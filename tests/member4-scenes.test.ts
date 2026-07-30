import { describe, expect, it } from 'vitest';
import {
  SOLAR_RAIN_SCENE_ID,
  advanceSolarWindParticle,
  calculateOrbitRadiusRatio,
  createProjectedOrbitGeometry,
  createSolarWindParticles,
  shouldSaveOrbitAttempt,
} from '../src/canvas/scenes/member4SceneLogic.ts';

describe('member 4 Canvas scene logic', () => {
  it('M4-C-00 follows the shared solar-rain entry protocol', () => {
    expect(SOLAR_RAIN_SCENE_ID).toBe('solar-rain');
  });

  it('M4-C-01 creates deterministic solar-wind particles', () => {
    const first = createSolarWindParticles(12);
    const second = createSolarWindParticles(12);

    expect(first).toEqual(second);
    expect(first).toHaveLength(12);
    expect(first.every(particle => particle.progress >= 0 && particle.progress < 1))
      .toBe(true);
  });

  it('M4-C-02 advances a particle without mutating the source', () => {
    const particle = createSolarWindParticles(1)[0];
    const advanced = advanceSolarWindParticle(particle, 2);

    expect(advanced).not.toBe(particle);
    expect(advanced.progress).toBeCloseTo(
      (particle.progress + particle.speed * 2) % 1,
    );
    expect(particle.progress).toBe(0);
  });

  it('M4-C-03 wraps solar-wind progress after one cycle', () => {
    const particle = {
      angle: 0,
      progress: 0.95,
      speed: 0.1,
      lane: 0,
      phase: 0,
    };

    expect(advanceSolarWindParticle(particle, 1).progress).toBeCloseTo(0.05);
  });

  it('M4-C-04 rejects invalid animation deltas', () => {
    const particle = createSolarWindParticles(1)[0];

    expect(() => advanceSolarWindParticle(particle, -1)).toThrow(TypeError);
    expect(() => advanceSolarWindParticle(particle, Number.NaN)).toThrow(
      TypeError,
    );
  });

  it('M4-C-05 keeps equal proportional radius drags device independent', () => {
    const desktop = calculateOrbitRadiusRatio(760, 400, 300);
    const mobile = calculateOrbitRadiusRatio(304, 160, 120);

    expect(desktop).toBe(1.2);
    expect(mobile).toBe(1.2);
  });

  it('M4-C-06 places Earth exactly on the projected orbit', () => {
    const orbit = createProjectedOrbitGeometry({ x: 300, y: 240 }, 180);
    const ellipseEquation =
      ((orbit.body.x - orbit.center.x) / orbit.radiusX) ** 2 +
      ((orbit.body.y - orbit.center.y) / orbit.radiusY) ** 2;

    expect(orbit.body).toEqual({ x: 480, y: 240 });
    expect(ellipseEquation).toBeCloseTo(1);
  });

  it('M4-C-07 saves only the first completed orbit attempt', () => {
    expect(shouldSaveOrbitAttempt(false, false)).toBe(false);
    expect(shouldSaveOrbitAttempt(true, false)).toBe(true);
    expect(shouldSaveOrbitAttempt(true, true)).toBe(false);
  });
});
