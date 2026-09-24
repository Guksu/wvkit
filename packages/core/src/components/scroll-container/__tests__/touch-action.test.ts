import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { browserPansTouch } from '../touch-action';

/**
 * browserPansTouch — 브라우저가 이 터치를 스스로 pan 할지 (effective touch-action).
 * 누른 요소부터 가장 가까운 스크롤러(overflow auto/scroll)까지 touch-action 을 교집합하고, 스크롤러에서 멈춘다.
 */

describe('browserPansTouch', () => {
  let host: HTMLElement;

  beforeEach(() => {
    host = document.createElement('div');
    host.style.touchAction = 'none'; // ScrollContainer 호스트 규칙
    host.style.overflow = 'hidden';
    document.body.appendChild(host);
  });

  afterEach(() => {
    host.remove();
  });

  function el(parent: HTMLElement, style: Partial<CSSStyleDeclaration> = {}): HTMLElement {
    const e = document.createElement('div');
    Object.assign(e.style, style);
    parent.appendChild(e);
    return e;
  }

  it('T1: 스크롤러 없이 호스트(touch-action: none) 안 → 어느 방향도 브라우저 몫이 아니다', () => {
    const card = el(el(host));
    expect(browserPansTouch(card, 'x')).toBe(false);
    expect(browserPansTouch(card, 'y')).toBe(false);
  });

  it('T2: pan-y 스크롤 패널 안 → 세로만 브라우저 몫, 호스트의 none 은 스크롤러 위라 영향 없음', () => {
    const panel = el(host, { overflowY: 'auto', touchAction: 'pan-y' });
    const title = el(el(panel));
    expect(browserPansTouch(title, 'y')).toBe(true);
    expect(browserPansTouch(title, 'x')).toBe(false);
  });

  it('T3: pan-y 패널 안의 칩 줄(overflow-x auto, pan-x pan-y) → 가장 가까운 스크롤러에서 멈춰 양 축 허용', () => {
    const panel = el(host, { overflowY: 'auto', touchAction: 'pan-y' });
    const chips = el(panel, { overflowX: 'auto', touchAction: 'pan-x pan-y' });
    const chip = el(chips);
    expect(browserPansTouch(chip, 'x')).toBe(true);
    expect(browserPansTouch(chip, 'y')).toBe(true);
  });

  it('T4: 스크롤러까지 가는 길의 touch-action 은 교집합 — pan-x 요소가 pan-y 스크롤러 안에 있으면 둘 다 금지', () => {
    const panel = el(host, { overflowY: 'auto', touchAction: 'pan-y' });
    const slider = el(panel, { touchAction: 'pan-x' });
    expect(browserPansTouch(slider, 'x')).toBe(false);
    expect(browserPansTouch(slider, 'y')).toBe(false);
  });

  it('T5: manipulation·auto 는 제한 없음, pinch-zoom 만 있으면 pan 금지, pan-left 는 가로', () => {
    const scroller = el(document.body, { overflowY: 'scroll' });
    const m = el(scroller, { touchAction: 'manipulation' });
    expect(browserPansTouch(m, 'x')).toBe(true);
    expect(browserPansTouch(m, 'y')).toBe(true);
    const p = el(scroller, { touchAction: 'pinch-zoom' });
    expect(browserPansTouch(p, 'x')).toBe(false);
    expect(browserPansTouch(p, 'y')).toBe(false);
    const l = el(scroller, { touchAction: 'pan-left' });
    expect(browserPansTouch(l, 'x')).toBe(true);
    expect(browserPansTouch(l, 'y')).toBe(false);
    scroller.remove();
  });

  it('T6: Element 가 아닌 대상(null)은 제한 없음으로 본다', () => {
    expect(browserPansTouch(null, 'x')).toBe(true);
  });
});
