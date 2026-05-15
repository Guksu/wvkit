import { describe, expect, it } from 'vitest';
import {
  applyResistance,
  cameraPosForAnchor,
  clamp,
  decideSnapTarget,
  easeOutCubic,
  nearestPanelIndex,
  screenPointToWorld,
} from '../matrix-utils';

describe('easeOutCubic', () => {
  it('t=0 returns 0', () => {
    expect(easeOutCubic(0)).toBe(0);
  });
  it('t=1 returns 1', () => {
    expect(easeOutCubic(1)).toBe(1);
  });
  it('t=0.5 returns 1 - 0.5^3 = 0.875', () => {
    expect(easeOutCubic(0.5)).toBeCloseTo(0.875, 5);
  });
  it('is monotonically increasing over [0,1]', () => {
    let prev = easeOutCubic(0);
    for (let i = 1; i <= 10; i++) {
      const v = easeOutCubic(i / 10);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
  it('decelerates (derivative decreases) — value at 0.1 > 0.1, at 0.9 < 0.9 difference', () => {
    expect(easeOutCubic(0.1)).toBeGreaterThan(0.1);
    expect(easeOutCubic(0.9)).toBeLessThan(1);
  });
});

describe('clamp', () => {
  it('within range returns value', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });
  it('below min returns min', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });
  it('above max returns max', () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });
  it('value=min returns min', () => {
    expect(clamp(0, 0, 10)).toBe(0);
  });
  it('value=max returns max', () => {
    expect(clamp(10, 0, 10)).toBe(10);
  });
});

describe('applyResistance', () => {
  it('within range returns unchanged', () => {
    expect(applyResistance(5, 0, 10, 0.2)).toBe(5);
  });
  it('overshoot above max: max + overshoot * resistance', () => {
    // value=110, max=100, resistance=0.2 → 100 + 10*0.2 = 102
    expect(applyResistance(110, 0, 100, 0.2)).toBeCloseTo(102, 6);
  });
  it('overshoot below min: min - overshoot * resistance', () => {
    // value=-10, min=0, resistance=0.2 → 0 - 10*0.2 = -2
    expect(applyResistance(-10, 0, 100, 0.2)).toBeCloseTo(-2, 6);
  });
  it('resistance=0 hard clamps to bounds', () => {
    expect(applyResistance(150, 0, 100, 0)).toBe(100);
    expect(applyResistance(-50, 0, 100, 0)).toBe(0);
  });
  it('resistance=1 returns value unchanged in overshoot', () => {
    expect(applyResistance(150, 0, 100, 1)).toBe(150);
    expect(applyResistance(-50, 0, 100, 1)).toBe(-50);
  });
  it('max < min falls back to plain clamp without throwing', () => {
    expect(() => applyResistance(5, 10, 0, 0.2)).not.toThrow();
  });
});

describe('screenPointToWorld', () => {
  it('screen center maps to camera position at zoom=1', () => {
    // (200, 300) center, root 400x600, camera at (50, -100), zoom=1
    const w = screenPointToWorld(200, 300, 50, -100, 1, 400, 600);
    expect(w.x).toBe(50);
    expect(w.y).toBe(-100);
  });
  it('Y flip: screen Y descending → world Y ascending', () => {
    // Move from screen center down by 100 → world Y goes down by 100 (negative direction)
    const center = screenPointToWorld(200, 300, 0, 0, 1, 400, 600);
    const below = screenPointToWorld(200, 400, 0, 0, 1, 400, 600);
    expect(below.y).toBeLessThan(center.y);
    expect(below.y).toBeCloseTo(-100, 5);
  });
  it('zoom scales mapping: 1px screen = 1/zoom world unit', () => {
    // screen (200+50, 300) = screen offset 50px right at center, zoom=2 → 25 world units right
    const w = screenPointToWorld(250, 300, 0, 0, 2, 400, 600);
    expect(w.x).toBeCloseTo(25, 5);
  });
  it('translated camera offsets world point', () => {
    const w = screenPointToWorld(200, 300, 100, 0, 1, 400, 600);
    expect(w.x).toBe(100); // center maps to cameraX
  });
});

describe('cameraPosForAnchor', () => {
  it('round-trip: anchor stays under screen point after zoom change', () => {
    // Setup: camera at (cx, cy)=(50, -30), zoom=1, rootSize=400x600.
    // Compute world point under screen (250, 400).
    const screen = { x: 250, y: 400 };
    const rootW = 400;
    const rootH = 600;
    const oldZoom = 1;
    const newZoom = 2.5;
    const cam0 = { x: 50, y: -30 };
    const world = screenPointToWorld(
      screen.x, screen.y,
      cam0.x, cam0.y,
      oldZoom, rootW, rootH,
    );
    // Find new camera position that keeps `world` under `screen` at newZoom
    const cam1 = cameraPosForAnchor(
      world.x, world.y, screen.x, screen.y, newZoom, rootW, rootH,
    );
    // Round-trip: at newZoom + cam1, screen `screen` should map back to `world`
    const worldCheck = screenPointToWorld(
      screen.x, screen.y, cam1.x, cam1.y, newZoom, rootW, rootH,
    );
    expect(worldCheck.x).toBeCloseTo(world.x, 5);
    expect(worldCheck.y).toBeCloseTo(world.y, 5);
  });
  it('zoom unchanged: returns world point shifted by screen-to-center vector', () => {
    // At zoom=1, anchor world=(10,20) at screen=(centerX, centerY) means cam should be at (10,20).
    const cam = cameraPosForAnchor(10, 20, 200, 300, 1, 400, 600);
    expect(cam.x).toBe(10);
    expect(cam.y).toBe(20);
  });
});

describe('nearestPanelIndex', () => {
  const positions = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 200, y: 0 },
    { x: 300, y: 0 },
  ];
  it('empty positions returns 0', () => {
    expect(nearestPanelIndex(50, [], 'x')).toBe(0);
  });
  it('exact match returns that index', () => {
    expect(nearestPanelIndex(200, positions, 'x')).toBe(2);
  });
  it('between two: closer one wins', () => {
    expect(nearestPanelIndex(120, positions, 'x')).toBe(1); // 120 closer to 100 than 200
    expect(nearestPanelIndex(180, positions, 'x')).toBe(2); // 180 closer to 200 than 100
  });
  it('tie prefers smaller index', () => {
    // 50 is equidistant from 0 and 100; bestDist starts at idx0 (50), idx1 also 50, but the
    // condition is strict `<` so smaller index wins.
    expect(nearestPanelIndex(50, positions, 'x')).toBe(0);
  });
  it('outside range clamps to nearest end', () => {
    expect(nearestPanelIndex(-100, positions, 'x')).toBe(0);
    expect(nearestPanelIndex(1000, positions, 'x')).toBe(3);
  });
  it('uses Y axis when requested', () => {
    const yPositions = [
      { x: 0, y: 0 },
      { x: 0, y: -100 },
      { x: 0, y: -200 },
    ];
    expect(nearestPanelIndex(-120, yPositions, 'y')).toBe(1);
    expect(nearestPanelIndex(-180, yPositions, 'y')).toBe(2);
  });
});

describe('decideSnapTarget', () => {
  it('drag below threshold returns startIndex (no snap)', () => {
    expect(decideSnapTarget(2, 0.2, 0, 0.3, 5)).toBe(2);
  });
  it('drag above +threshold returns startIndex+1', () => {
    expect(decideSnapTarget(2, 0.4, 0, 0.3, 5)).toBe(3);
  });
  it('drag below -threshold returns startIndex-1', () => {
    expect(decideSnapTarget(2, -0.4, 0, 0.3, 5)).toBe(1);
  });
  it('velocity boosts marginal drag past threshold (weighted at 0.3 by default)', () => {
    // dragRatio=0.2 (below 0.3), velocityRatio=1.0 → effective=0.2 + 1.0*0.3 = 0.5 → forward
    expect(decideSnapTarget(2, 0.2, 1.0, 0.3, 5)).toBe(3);
  });
  it('velocity opposing drag can pull back', () => {
    // dragRatio=0.35 (above 0.3), velocityRatio=-0.3 → effective=0.35-0.09 = 0.26 → no snap
    expect(decideSnapTarget(2, 0.35, -0.3, 0.3, 5)).toBe(2);
  });
  it('clamps target to [0, panelCount-1]', () => {
    expect(decideSnapTarget(0, -0.5, 0, 0.3, 5)).toBe(0); // would be -1
    expect(decideSnapTarget(4, 0.5, 0, 0.3, 5)).toBe(4); // would be 5
  });
  it('panelCount=0 returns 0', () => {
    expect(decideSnapTarget(0, 1, 1, 0.3, 0)).toBe(0);
  });
  it('custom velocityWeight applied', () => {
    // dragRatio=0.1, velocityRatio=1, weight=0.5 → 0.1 + 0.5 = 0.6 → forward
    expect(decideSnapTarget(2, 0.1, 1, 0.3, 5, 0.5)).toBe(3);
  });
});
