import { describe, expect, it } from 'vitest';
import {
  GAME_COORDINATE_SPAN,
  normalizeOrbitDrag,
  advanceSolarWindParticle,
  createSolarWindParticles,
  shouldSaveOrbitAttempt,
} from '../src/canvas/scenes/member4SceneLogic.ts';
import { calculateChangeLevel } from '../src/game/index.ts';

describe('member 4 Canvas scene logic', () => {
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

  it('M4-C-05 normalizes equal proportional drags across devices', () => {
    const desktop = normalizeOrbitDrag(
      { x: 100, y: 100 },
      { x: 160, y: 100 },
      { width: 1200, height: 500 },
    );
    const mobile = normalizeOrbitDrag(
      { x: 50, y: 50 },
      { x: 93.2, y: 50 },
      { width: 360, height: 600 },
    );

    expect(desktop.x).toBe(60);
    expect(mobile.x).toBe(60);
    expect(GAME_COORDINATE_SPAN).toBe(500);
    expect(calculateChangeLevel(desktop.x)).toBe('large');
    expect(calculateChangeLevel(mobile.x)).toBe('large');
  });

  it('M4-C-06 keeps the same orbit result for the same viewport ratio', () => {
    const desktop = normalizeOrbitDrag(
      { x: 100, y: 100 },
      { x: 180, y: 140 },
      { width: 1000, height: 500 },
    );
    const mobile = normalizeOrbitDrag(
      { x: 40, y: 40 },
      { x: 88, y: 64 },
      { width: 300, height: 600 },
    );

    expect(mobile.x).toBeCloseTo(desktop.x);
    expect(mobile.y).toBeCloseTo(desktop.y);
    expect(calculateChangeLevel(Math.hypot(desktop.x, desktop.y))).toBe(
      calculateChangeLevel(Math.hypot(mobile.x, mobile.y)),
    );
  });

  it('M4-C-07 saves only the first completed orbit attempt', () => {
    expect(shouldSaveOrbitAttempt(false, false)).toBe(false);
    expect(shouldSaveOrbitAttempt(true, false)).toBe(true);
    expect(shouldSaveOrbitAttempt(true, true)).toBe(false);
  });
});
