/**
 * ARIA — WAI-ARIA APG 캐러셀 패턴을 따른다.
 *
 *  - host: `role="group"` + `aria-roledescription="carousel"` (이미 있는 속성은 건드리지 않는다).
 *    접근 가능한 이름은 만들어 내지 않는다 — 앱이 host 에 `aria-label` 을 주면 된다.
 *  - 패널: `role="group"` + `aria-roledescription="slide"` + `aria-label="n / N"` (aria-label·aria-labelledby 가 없을 때만).
 *  - 비활성 패널: `aria-hidden="true"` + `inert` — 화면 밖 패널이 스크린리더·Tab 순서에 잡히지 않게.
 *    `inert` 는 모르는 브라우저(Chrome 102 미만 WebView 등)에서는 무시되어 aria-hidden 만 남는다.
 *
 * destroy 시 우리가 바꾼 속성만 원래대로 돌린다.
 */

const ROOT_ATTRS: ReadonlyArray<[string, string]> = [
  ['role', 'group'],
  ['aria-roledescription', 'carousel'],
];

export interface A11y {
  /** 활성 패널이 바뀔 때 — 활성만 노출, 나머지는 aria-hidden + inert */
  setActive(index: number): void;
  destroy(): void;
}

type Saved = Map<string, string | null>;

function setIfAbsent(el: HTMLElement, saved: Saved, name: string, value: string): void {
  if (el.hasAttribute(name)) return;
  saved.set(name, null);
  el.setAttribute(name, value);
}

function restore(el: HTMLElement, saved: Saved): void {
  for (const [name, prev] of saved) {
    if (prev === null) el.removeAttribute(name);
    else el.setAttribute(name, prev);
  }
  saved.clear();
}

export function createA11y(root: HTMLElement, panels: ReadonlyArray<HTMLElement>): A11y {
  const rootSaved: Saved = new Map();
  for (const [name, value] of ROOT_ATTRS) setIfAbsent(root, rootSaved, name, value);

  const panelSaved: Saved[] = panels.map((panel, i) => {
    const saved: Saved = new Map();
    setIfAbsent(panel, saved, 'role', 'group');
    setIfAbsent(panel, saved, 'aria-roledescription', 'slide');
    if (!panel.hasAttribute('aria-label') && !panel.hasAttribute('aria-labelledby')) {
      setIfAbsent(panel, saved, 'aria-label', `${i + 1} / ${panels.length}`);
    }
    // aria-hidden / inert 는 setActive 가 관리 — 원래 값만 기억해 둔다
    saved.set('aria-hidden', panel.getAttribute('aria-hidden'));
    saved.set('inert', panel.getAttribute('inert'));
    return saved;
  });

  function setActive(index: number): void {
    panels.forEach((panel, i) => {
      if (i === index) {
        panel.removeAttribute('aria-hidden');
        panel.removeAttribute('inert');
      } else {
        panel.setAttribute('aria-hidden', 'true');
        panel.setAttribute('inert', '');
      }
    });
  }

  function destroy(): void {
    restore(root, rootSaved);
    panels.forEach((panel, i) => {
      const saved = panelSaved[i];
      if (saved) restore(panel, saved);
    });
  }

  return { setActive, destroy };
}
