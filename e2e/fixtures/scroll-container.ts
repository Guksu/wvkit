import type { Page } from '@playwright/test';

export const CANVAS = 'sc-canvas';

export async function gotoDemo(page: Page): Promise<void> {
  await page.goto('/');
  // 첫 번째 탭 기본값 = scroll-container. 데모 마운트(activeIndex row 등장) 대기.
  await page.getByTestId('row-activeIndex-value').waitFor();
}

export async function getActiveIndex(page: Page): Promise<number> {
  const text = (await page.getByTestId('row-activeIndex-value').textContent()) ?? '';
  return Number.parseInt(text, 10);
}

export async function getActiveZoom(page: Page): Promise<number> {
  const text = (await page.getByTestId('row-activeZoom-value').textContent()) ?? '';
  return Number.parseFloat(text);
}

export async function getDirection(page: Page): Promise<string> {
  return (await page.getByTestId('row-direction-value').textContent()) ?? '';
}

/**
 * CSS3DRenderer scene wrapper(depth 3)의 transform — camera.position이 인코딩되어 있다.
 * 카메라가 X로 이동하면 matrix3d의 12번째 슬롯(또는 그 부근)이 변한다.
 */
export async function getSceneTransform(page: Page): Promise<string | null> {
  return await page.evaluate(() => {
    const canvas = document.querySelector('[data-testid="sc-canvas"]');
    if (!canvas) return null;
    const scene = canvas.querySelector(':scope > div > div > div') as HTMLElement | null;
    return scene?.style.transform ?? null;
  });
}

/**
 * matrix3d의 13/14번째(0-based 12/13) 인자 = translation x/y.
 */
export function parseMatrix3dTranslation(
  transform: string | null,
): { x: number; y: number } | null {
  if (!transform) return null;
  const match = transform.match(/matrix3d\(([^)]+)\)/);
  if (!match) return null;
  const parts = match[1].split(',').map((s) => Number.parseFloat(s.trim()));
  return { x: parts[12] ?? 0, y: parts[13] ?? 0 };
}

/**
 * scene wrapper의 모든 transform 함수에서 X 좌표 부호 합산 — 카메라가 패널 N을 본다는 것은
 * scene이 -N*width 만큼 시프트된다는 뜻. 부호와 절대량의 변동량만 비교에 사용.
 */
export async function getSceneXShift(page: Page): Promise<number | null> {
  const t = await getSceneTransform(page);
  if (!t) return null;
  // matrix3d 부분
  const m = parseMatrix3dTranslation(t);
  if (!m) return null;
  // 그 외 translate(Xpx, Ypx) 들도 합산
  const translates = Array.from(t.matchAll(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/g));
  let extraX = 0;
  for (const tr of translates) extraX += Number.parseFloat(tr[1]);
  return m.x + extraX;
}

/**
 * 현재 캔버스 DOM에 살아 있는 패널 인덱스 목록 (CSS3DRenderer는 visible=false 객체를 DOM에서 떼어냄).
 * buildPanels가 만든 패널의 첫 자식 <div>는 인덱스 텍스트를 담고 있어 그것으로 식별.
 */
export async function getVisiblePanelIndices(page: Page): Promise<number[]> {
  return await page.evaluate(() => {
    const canvas = document.querySelector('[data-testid="sc-canvas"]');
    if (!canvas) return [];
    const panels = canvas.querySelectorAll(':scope > div > div > div > div');
    const out: number[] = [];
    for (const p of Array.from(panels)) {
      // display:none 패널은 가상화에서 제외된 것으로 간주
      const panelEl = p as HTMLElement;
      if (panelEl.style.display === 'none' || getComputedStyle(panelEl).display === 'none') continue;
      const inner = p.firstElementChild;
      const numEl = inner?.firstElementChild;
      const txt = numEl?.textContent?.trim() ?? '';
      const n = Number.parseInt(txt, 10);
      if (Number.isFinite(n)) out.push(n);
    }
    return out.sort((a, b) => a - b);
  });
}

interface SwipeOpts {
  /** pointermove 분할 수 (기본 14) */
  steps?: number;
  /** 전체 제스처 지속 시간 ms (기본 280) */
  duration?: number;
  /** 시작 비율 (0~1, 기본 0.5 = 캔버스 정중앙) */
  startRatioX?: number;
  startRatioY?: number;
}

/**
 * 캔버스 위 단일 포인터 드래그. PointerEvent를 직접 dispatch → desktop/mobile 양쪽에서 동일하게 동작.
 */
export async function swipeOnCanvas(
  page: Page,
  dx: number,
  dy: number,
  opts: SwipeOpts = {},
): Promise<void> {
  const { steps = 14, duration = 280, startRatioX = 0.5, startRatioY = 0.5 } = opts;
  await page.evaluate(
    async ({ dx, dy, steps, duration, startRatioX, startRatioY }) => {
      const el = document.querySelector('[data-testid="sc-canvas"]') as HTMLElement | null;
      if (!el) throw new Error('sc-canvas not found');
      const rect = el.getBoundingClientRect();
      const startX = rect.left + rect.width * startRatioX;
      const startY = rect.top + rect.height * startRatioY;
      const pid = 1;

      const dispatch = (type: string, x: number, y: number, buttons: number, button: number) => {
        el.dispatchEvent(
          new PointerEvent(type, {
            pointerId: pid,
            pointerType: 'touch',
            isPrimary: true,
            clientX: x,
            clientY: y,
            screenX: x,
            screenY: y,
            bubbles: true,
            cancelable: true,
            buttons,
            button,
          }),
        );
      };

      dispatch('pointerdown', startX, startY, 1, 0);
      const dt = duration / steps;
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        dispatch('pointermove', startX + dx * t, startY + dy * t, 1, -1);
        await new Promise((r) => setTimeout(r, dt));
      }
      dispatch('pointerup', startX + dx, startY + dy, 0, 0);
    },
    { dx, dy, steps, duration, startRatioX, startRatioY },
  );
}

/**
 * 두 손가락 핀치 — 캔버스 중앙을 기준으로 두 포인터를 startGap → endGap 으로 벌리거나 좁힌다.
 * endGap > startGap = 줌인.
 */
export async function pinchOnCanvas(
  page: Page,
  startGap: number,
  endGap: number,
  opts: { steps?: number; duration?: number } = {},
): Promise<void> {
  const { steps = 14, duration = 280 } = opts;
  await page.evaluate(
    async ({ startGap, endGap, steps, duration }) => {
      const el = document.querySelector('[data-testid="sc-canvas"]') as HTMLElement | null;
      if (!el) throw new Error('sc-canvas not found');
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      const make = (
        pid: number,
        type: string,
        x: number,
        y: number,
        buttons: number,
        button: number,
        isPrimary: boolean,
      ) => {
        el.dispatchEvent(
          new PointerEvent(type, {
            pointerId: pid,
            pointerType: 'touch',
            isPrimary,
            clientX: x,
            clientY: y,
            screenX: x,
            screenY: y,
            bubbles: true,
            cancelable: true,
            buttons,
            button,
          }),
        );
      };

      const half = (g: number) => g / 2;
      // 두 포인터 down (좌측, 우측) — 핀치는 x축으로 벌린다고 가정
      make(1, 'pointerdown', cx - half(startGap), cy, 1, 0, true);
      make(2, 'pointerdown', cx + half(startGap), cy, 1, 0, false);

      const dt = duration / steps;
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const g = startGap + (endGap - startGap) * t;
        make(1, 'pointermove', cx - half(g), cy, 1, -1, true);
        make(2, 'pointermove', cx + half(g), cy, 1, -1, false);
        await new Promise((r) => setTimeout(r, dt));
      }

      make(1, 'pointerup', cx - half(endGap), cy, 0, 0, true);
      make(2, 'pointerup', cx + half(endGap), cy, 0, 0, false);
    },
    { startGap, endGap, steps, duration },
  );
}

/**
 * scrollTo 버튼 클릭 (animated true: '✦' 접미사가 붙은 버튼, false: 일반 버튼).
 */
export async function clickScrollTo(page: Page, index: number, animated: boolean): Promise<void> {
  const label = animated ? `scrollTo(${index}) ✦` : `scrollTo(${index})`;
  await page.getByRole('button', { name: label, exact: true }).click();
}

export async function clickZoomTo(page: Page, level: number, animated: boolean): Promise<void> {
  const label = animated ? `zoomTo(${level}) ✦` : `zoomTo(${level})`;
  await page.getByRole('button', { name: label, exact: true }).click();
}

/**
 * scrollTo 애니메이션 종료 대기 — DataRow의 activeIndex가 expected에 도달한 뒤
 * 트윈 RAF가 더 이상 카메라를 움직이지 않을 때까지 panel transform이 안정될 때까지 기다린다.
 */
export async function waitForScrollSettle(page: Page, expectedIndex: number): Promise<void> {
  await page.waitForFunction(
    (idx) => {
      const value = document.querySelector('[data-testid="row-activeIndex-value"]')?.textContent;
      return value != null && Number.parseInt(value, 10) === idx;
    },
    expectedIndex,
    // 풀 스위트(4 프로젝트 병렬)에서 webkit RAF 지연으로 5s를 넘기는 flake 관측 — 부하 내성 상향
    { timeout: 15000 },
  );
  // RAF 트윈 종료 — scene wrapper transform이 3 프레임 연속 동일할 때까지
  await page.waitForFunction(
    () => {
      const canvas = document.querySelector('[data-testid="sc-canvas"]');
      if (!canvas) return false;
      const scene = canvas.querySelector(':scope > div > div > div') as HTMLElement | null;
      if (!scene) return false;
      const w = window as unknown as { __lastTf?: string; __sameCount?: number };
      const tf = scene.style.transform;
      if (w.__lastTf === tf) w.__sameCount = (w.__sameCount ?? 0) + 1;
      else {
        w.__lastTf = tf;
        w.__sameCount = 0;
      }
      return (w.__sameCount ?? 0) >= 3;
    },
    null,
    { timeout: 15000, polling: 50 },
  );
  await page.evaluate(() => {
    const w = window as unknown as { __lastTf?: string; __sameCount?: number };
    w.__lastTf = undefined;
    w.__sameCount = 0;
  });
}
