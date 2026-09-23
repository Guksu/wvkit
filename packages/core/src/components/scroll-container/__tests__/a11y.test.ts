import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createA11y } from '../a11y';

/**
 * ARIA 단위 테스트 — APG 캐러셀 패턴 속성 부여·활성 전환·복원.
 */

describe('createA11y', () => {
  let root: HTMLElement;
  let panels: HTMLElement[];

  beforeEach(() => {
    root = document.createElement('div');
    panels = [0, 1, 2].map(() => document.createElement('section'));
    document.body.appendChild(root);
  });

  afterEach(() => {
    root.remove();
  });

  it('A1: host 에 role=group + aria-roledescription=carousel, 패널에 role/slide/aria-label "n / N"', () => {
    const a = createA11y(root, panels);
    expect(root.getAttribute('role')).toBe('group');
    expect(root.getAttribute('aria-roledescription')).toBe('carousel');
    expect(root.hasAttribute('aria-label')).toBe(false); // 이름은 만들어 내지 않는다
    panels.forEach((p, i) => {
      expect(p.getAttribute('role')).toBe('group');
      expect(p.getAttribute('aria-roledescription')).toBe('slide');
      expect(p.getAttribute('aria-label')).toBe(`${i + 1} / 3`);
    });
    a.destroy();
  });

  it('A2: setActive — 활성만 노출, 나머지는 aria-hidden=true + inert', () => {
    const a = createA11y(root, panels);
    a.setActive(1);
    expect(panels[0]?.getAttribute('aria-hidden')).toBe('true');
    expect(panels[0]?.hasAttribute('inert')).toBe(true);
    expect(panels[1]?.hasAttribute('aria-hidden')).toBe(false);
    expect(panels[1]?.hasAttribute('inert')).toBe(false);
    expect(panels[2]?.getAttribute('aria-hidden')).toBe('true');
    a.setActive(2);
    expect(panels[1]?.getAttribute('aria-hidden')).toBe('true');
    expect(panels[2]?.hasAttribute('aria-hidden')).toBe(false);
    a.destroy();
  });

  it('A3: 이미 있는 속성은 건드리지 않는다 (role · aria-label · aria-labelledby)', () => {
    root.setAttribute('role', 'region');
    root.setAttribute('aria-label', '상품 사진');
    panels[0]?.setAttribute('aria-label', '첫 번째 사진');
    panels[1]?.setAttribute('aria-labelledby', 'title-1');
    panels[2]?.setAttribute('role', 'tabpanel');
    const a = createA11y(root, panels);
    expect(root.getAttribute('role')).toBe('region');
    expect(root.getAttribute('aria-label')).toBe('상품 사진');
    expect(root.getAttribute('aria-roledescription')).toBe('carousel');
    expect(panels[0]?.getAttribute('aria-label')).toBe('첫 번째 사진');
    expect(panels[1]?.hasAttribute('aria-label')).toBe(false);
    expect(panels[2]?.getAttribute('role')).toBe('tabpanel');
    expect(panels[2]?.getAttribute('aria-roledescription')).toBe('slide');
    a.destroy();
    expect(root.getAttribute('role')).toBe('region');
    expect(panels[2]?.getAttribute('role')).toBe('tabpanel');
  });

  it('A4: destroy — 우리가 준 속성은 제거, 원래 있던 aria-hidden/inert 값은 복원', () => {
    panels[2]?.setAttribute('aria-hidden', 'false');
    const a = createA11y(root, panels);
    a.setActive(0);
    expect(panels[2]?.getAttribute('aria-hidden')).toBe('true');
    a.destroy();
    expect(root.hasAttribute('role')).toBe(false);
    expect(root.hasAttribute('aria-roledescription')).toBe(false);
    expect(panels[0]?.hasAttribute('role')).toBe(false);
    expect(panels[0]?.hasAttribute('aria-roledescription')).toBe(false);
    expect(panels[0]?.hasAttribute('aria-label')).toBe(false);
    expect(panels[1]?.hasAttribute('aria-hidden')).toBe(false);
    expect(panels[1]?.hasAttribute('inert')).toBe(false);
    expect(panels[2]?.getAttribute('aria-hidden')).toBe('false');
  });
});
