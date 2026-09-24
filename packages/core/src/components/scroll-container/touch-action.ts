/**
 * 이 터치를 브라우저가 스스로 pan 할지 — `touch-action` 을 브라우저처럼 계산한다.
 *
 * 브라우저는 누른 요소부터 가장 가까운 스크롤 컨테이너(overflow auto/scroll)까지의 `touch-action` 교집합으로
 * 허용 방향을 정한다. 스크롤러에서 pan 이 다시 허용되므로 그 위 조상(호스트의 `touch-action: none` 포함)은
 * 영향을 주지 않는다 (Blink StyleAdjuster 의 effective touch-action 규칙). 스크롤러가 없으면 문서 루트까지 간다.
 *
 * 허용된 방향으로 움직이면 브라우저가 제스처를 가져가고 `pointercancel` 을 보낸다. 페이저는 그 전에 움직이면
 * 몇 px 흔들렸다 되돌아가므로, 방향을 정할 때 이 값을 보고 브라우저 몫이면 움직이지 않는다.
 *
 *   auto · manipulation → 양 축 허용, none → 둘 다 금지,
 *   pan-x/pan-left/pan-right → 가로만, pan-y/pan-up/pan-down → 세로만 (나머지 축은 금지), pinch-zoom 만 → 둘 다 금지
 */
export function browserPansTouch(start: EventTarget | null, axis: 'x' | 'y'): boolean {
  let el: Element | null = start instanceof Element ? start : null;
  let allowX = true;
  let allowY = true;
  while (el) {
    const cs = getComputedStyle(el);
    const ta = cs.touchAction || 'auto';
    if (ta !== 'auto' && ta !== 'manipulation') {
      if (!/pan-(x|left|right)/.test(ta)) allowX = false;
      if (!/pan-(y|up|down)/.test(ta)) allowY = false;
    }
    const scroller = /auto|scroll|overlay/.test(`${cs.overflowX} ${cs.overflowY}`);
    if (scroller || el === el.ownerDocument.documentElement) break;
    el = el.parentElement;
  }
  return axis === 'x' ? allowX : allowY;
}
