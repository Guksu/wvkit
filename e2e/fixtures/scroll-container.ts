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

/** 캔버스(root) client width — 줌 상태 pan 기대값이 폭에 비례하므로 스펙에서 직접 계산에 쓴다. */
export async function getCanvasWidth(page: Page): Promise<number> {
  return await page.evaluate(() => {
    const canvas = document.querySelector('[data-testid="sc-canvas"]') as HTMLElement | null;
    return canvas?.clientWidth ?? 0;
  });
}

/**
 * 렌더러 scene 노드(root > domElement > scene)의 transform — 카메라 위치·zoom이
 * `translate(Xpx, Ypx) scale(z)` 한 줄로 기록된다 (X = width/2 − cameraX·zoom).
 *
 * NOTE: `:scope > div > div` 는 렌더러(`panel-renderer.ts`)의 DOM 구조에 대한 의존 —
 * 렌더러 내부 DOM이라 testid 부여 불가 (구조가 바뀌면 여기와 `getVisiblePanelIndices`를 함께 갱신).
 */
export async function getSceneTransform(page: Page): Promise<string | null> {
  return await page.evaluate(() => {
    const canvas = document.querySelector('[data-testid="sc-canvas"]');
    if (!canvas) return null;
    const scene = canvas.querySelector(':scope > div > div') as HTMLElement | null;
    return scene?.style.transform ?? null;
  });
}

/**
 * `translate(Xpx, Ypx) scale(z)` 파싱.
 */
export function parseSceneTransform(
  transform: string | null,
): { x: number; y: number; scale: number } | null {
  if (!transform) return null;
  const t = transform.match(/translate\(([-\d.e]+)px,\s*([-\d.e]+)px\)/);
  if (!t) return null;
  const s = transform.match(/scale\(([-\d.e]+)\)/);
  return {
    x: Number.parseFloat(t[1]),
    y: Number.parseFloat(t[2]),
    scale: s ? Number.parseFloat(s[1]) : 1,
  };
}

/**
 * scene X 시프트를 월드 단위(zoom으로 나눈 값)로 반환 — 카메라가 패널 N을 본다는 것은
 * scene이 −N·width 만큼 시프트된다는 뜻. 부호와 변동량만 비교에 사용 (Δshift = −ΔcameraX).
 */
export async function getSceneXShift(page: Page): Promise<number | null> {
  const m = parseSceneTransform(await getSceneTransform(page));
  if (!m) return null;
  return m.x / (m.scale || 1);
}

/**
 * `getSceneXShift`의 Y 대칭 — 대각 입력의 Y 성분이 카메라 transform에 누출되는지 검출용.
 */
export async function getSceneYShift(page: Page): Promise<number | null> {
  const m = parseSceneTransform(await getSceneTransform(page));
  if (!m) return null;
  return m.y / (m.scale || 1);
}

/**
 * scene transform 을 카메라 값으로 되돌린다 — X = w/2 − camX·z, Y = h/2 + camY·z 이므로
 *   camX = (w/2 − X)/z, camY = (Y − h/2)/z.
 * 줌이 바뀌는 시나리오(더블탭·고무줄)에서는 shift 차분 대신 카메라 값 자체를 비교한다.
 */
export async function getCameraPosition(
  page: Page,
): Promise<{ x: number; y: number; zoom: number } | null> {
  const m = parseSceneTransform(await getSceneTransform(page));
  if (!m) return null;
  const { width, height } = await page.evaluate(() => {
    const canvas = document.querySelector('[data-testid="sc-canvas"]') as HTMLElement | null;
    return { width: canvas?.clientWidth ?? 0, height: canvas?.clientHeight ?? 0 };
  });
  const z = m.scale || 1;
  return { x: (width / 2 - m.x) / z, y: (m.y - height / 2) / z, zoom: z };
}

/**
 * 현재 캔버스 DOM에 살아 있는 패널 인덱스 목록 (렌더러는 한 번도 보이지 않은 패널을 DOM에 붙이지 않고,
 * 창 밖으로 나간 패널은 display:none 으로 숨긴다).
 * 데모의 buildPanels가 패널 루트에 `data-panel-index`를 부여하므로 그것으로 식별한다 (콘텐츠 구조 무관).
 */
export async function getVisiblePanelIndices(page: Page): Promise<number[]> {
  return await page.evaluate(() => {
    const canvas = document.querySelector('[data-testid="sc-canvas"]');
    if (!canvas) return [];
    const panels = canvas.querySelectorAll<HTMLElement>('[data-panel-index]');
    const out: number[] = [];
    for (const panelEl of Array.from(panels)) {
      // display:none 패널은 가상화에서 제외된 것으로 간주
      if (panelEl.style.display === 'none' || getComputedStyle(panelEl).display === 'none')
        continue;
      const n = Number.parseInt(panelEl.dataset.panelIndex ?? '', 10);
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
  /** 마지막 move 뒤 이 시간(ms)만큼 멈춘 채 같은 좌표로 move 를 한 번 더 보내고 up — 속도 0 릴리스 재현 */
  holdMs?: number;
  /** PointerEvent.pointerType (기본 'touch') */
  pointerType?: 'touch' | 'mouse' | 'pen';
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
  const {
    steps = 14,
    duration = 280,
    startRatioX = 0.5,
    startRatioY = 0.5,
    holdMs = 0,
    pointerType = 'touch',
  } = opts;
  await page.evaluate(
    async ({ dx, dy, steps, duration, startRatioX, startRatioY, holdMs, pointerType }) => {
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
            pointerType,
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
      if (holdMs > 0) {
        // 멈춤: 같은 좌표 move → lastDelta 0 → 릴리스 속도 0 (관성 없음)
        await new Promise((r) => setTimeout(r, holdMs));
        dispatch('pointermove', startX + dx, startY + dy, 1, -1);
        await new Promise((r) => setTimeout(r, 16));
      }
      dispatch('pointerup', startX + dx, startY + dy, 0, 0);
    },
    { dx, dy, steps, duration, startRatioX, startRatioY, holdMs, pointerType },
  );
}

/**
 * 한 손가락 드래그를 move 단위로 보내고, move 마다 카메라 위치(월드, 시작 대비 변화)를 기록한다.
 * 렌더는 pointermove 안에서 동기로 일어나므로 dispatch 직후 scene transform 이 그 move 의 결과다.
 * "제스처 도중 한 번도 움직이지 않았다"를 단언할 때 쓴다 (정착 후 값만 보면 흔들렸다 돌아온 것을 놓친다).
 *
 * - `moves`: 시작점(캔버스 정중앙) 기준 누적 [dx, dy] 목록
 * - `targetSelector`: 이벤트를 보낼 요소 (기본 캔버스). 브라우저가 touch-action 을 누른 요소 기준으로 정하므로
 *   특정 패널 콘텐츠 위의 터치를 흉내 낼 때 쓴다. 좌표는 여전히 캔버스 정중앙 기준.
 */
export async function dragSampleCamera(
  page: Page,
  moves: Array<[number, number]>,
  opts: { pointerType?: 'touch' | 'mouse' | 'pen'; targetSelector?: string } = {},
): Promise<Array<{ x: number; y: number }>> {
  const { pointerType = 'touch', targetSelector } = opts;
  return await page.evaluate(
    ({ moves, pointerType, targetSelector }) => {
      const canvas = document.querySelector('[data-testid="sc-canvas"]') as HTMLElement | null;
      if (!canvas) throw new Error('sc-canvas not found');
      const target = (targetSelector && document.querySelector(targetSelector)) || canvas;
      const scene = canvas.querySelector(':scope > div > div') as HTMLElement | null;
      const camera = () => {
        const tf = scene?.style.transform ?? '';
        const t = tf.match(/translate\(([-\d.e]+)px,\s*([-\d.e]+)px\)/);
        const m = tf.match(/scale\(([-\d.e]+)\)/);
        const z = m ? Number.parseFloat(m[1] ?? '1') : 1;
        const tx = t ? Number.parseFloat(t[1] ?? '0') : 0;
        const ty = t ? Number.parseFloat(t[2] ?? '0') : 0;
        return { x: (canvas.clientWidth / 2 - tx) / z, y: (ty - canvas.clientHeight / 2) / z };
      };
      const r = canvas.getBoundingClientRect();
      const x0 = r.left + r.width / 2;
      const y0 = r.top + r.height / 2;
      const fire = (type: string, x: number, y: number, buttons: number) =>
        target.dispatchEvent(
          new PointerEvent(type, {
            pointerId: 7,
            pointerType,
            isPrimary: true,
            clientX: x,
            clientY: y,
            bubbles: true,
            cancelable: true,
            buttons,
            button: type === 'pointermove' ? -1 : 0,
          }),
        );
      const start = camera();
      fire('pointerdown', x0, y0, 1);
      const out: Array<{ x: number; y: number }> = [];
      for (const [dx, dy] of moves) {
        fire('pointermove', x0 + dx, y0 + dy, 1);
        const c = camera();
        out.push({ x: +(c.x - start.x).toFixed(3), y: +(c.y - start.y).toFixed(3) });
      }
      const last = moves[moves.length - 1] ?? [0, 0];
      fire('pointerup', x0 + last[0], y0 + last[1], 0);
      return out;
    },
    { moves, pointerType, targetSelector },
  );
}

/**
 * 캔버스 안에서 가로로 스크롤되는 요소(칩 줄 등)가 없는 지점을 찾아 마우스를 올린다 (페이지 좌표 반환).
 * 휠은 설계상 그 방향으로 더 스크롤할 수 있는 중첩 스크롤러에 먼저 가므로, 페이저 휠 테스트는 그런 요소를 피해야
 * 레이아웃과 무관하게 결정적이다. 캔버스 가운데 세로선을 위(20%)에서 아래(90%)로 훑는다.
 */
export async function hoverCanvasAwayFromHorizontalScrollers(
  page: Page,
): Promise<{ x: number; y: number }> {
  await page.getByTestId(CANVAS).scrollIntoViewIfNeeded();
  const point = await page.evaluate(() => {
    const canvas = document.querySelector('[data-testid="sc-canvas"]') as HTMLElement | null;
    if (!canvas) throw new Error('sc-canvas not found');
    const r = canvas.getBoundingClientRect();
    const x = r.left + r.width / 2;
    for (let t = 0.2; t <= 0.9; t += 0.05) {
      const y = r.top + r.height * t;
      let el = document.elementFromPoint(x, y);
      if (!el || !canvas.contains(el)) continue;
      let horizontal = false;
      while (el && el !== canvas) {
        const ox = getComputedStyle(el).overflowX;
        if ((ox === 'auto' || ox === 'scroll') && el.scrollWidth > el.clientWidth + 1) {
          horizontal = true;
          break;
        }
        el = el.parentElement;
      }
      if (!horizontal) return { x, y };
    }
    throw new Error('no point without a horizontal scroller inside sc-canvas');
  });
  await page.mouse.move(point.x, point.y);
  return point;
}

/**
 * 두 손가락 핀치 — 캔버스 중앙을 기준으로 두 포인터를 startGap → endGap 으로 벌리거나 좁힌다.
 * endGap > startGap = 줌인.
 */
export async function pinchOnCanvas(
  page: Page,
  startGap: number,
  endGap: number,
  opts: { steps?: number; duration?: number; release?: boolean } = {},
): Promise<void> {
  const { steps = 14, duration = 280, release = true } = opts;
  await page.evaluate(
    async ({ startGap, endGap, steps, duration, release }) => {
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

      // release=false: 손가락을 뗀 뒤의 복귀(고무줄)를 보기 전에 제스처 중 상태를 읽을 수 있게 둔다 → liftPinch
      if (!release) return;
      make(1, 'pointerup', cx - half(endGap), cy, 0, 0, true);
      make(2, 'pointerup', cx + half(endGap), cy, 0, 0, false);
    },
    { startGap, endGap, steps, duration, release },
  );
}

/** `pinchOnCanvas(..., { release: false })` 뒤 두 손가락을 뗀다 (같은 gap 위치). */
export async function liftPinch(page: Page, gap: number): Promise<void> {
  await page.evaluate((gap) => {
    const el = document.querySelector('[data-testid="sc-canvas"]') as HTMLElement | null;
    if (!el) throw new Error('sc-canvas not found');
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    for (const [pid, x, primary] of [
      [1, cx - gap / 2, true],
      [2, cx + gap / 2, false],
    ] as const) {
      el.dispatchEvent(
        new PointerEvent('pointerup', {
          pointerId: pid,
          pointerType: 'touch',
          isPrimary: primary,
          clientX: x,
          clientY: cy,
          screenX: x,
          screenY: cy,
          bubbles: true,
          cancelable: true,
          buttons: 0,
          button: 0,
        }),
      );
    }
  }, gap);
}

/**
 * 캔버스 위 더블탭 — 같은 지점에 down/up 두 번 (탭 사이 gapMs, 기본 120ms).
 * 좌표는 캔버스 비율 (기본 정중앙).
 */
export async function doubleTapOnCanvas(
  page: Page,
  opts: { ratioX?: number; ratioY?: number; gapMs?: number } = {},
): Promise<void> {
  const { ratioX = 0.5, ratioY = 0.5, gapMs = 120 } = opts;
  await page.evaluate(
    async ({ ratioX, ratioY, gapMs }) => {
      const el = document.querySelector('[data-testid="sc-canvas"]') as HTMLElement | null;
      if (!el) throw new Error('sc-canvas not found');
      const rect = el.getBoundingClientRect();
      const x = rect.left + rect.width * ratioX;
      const y = rect.top + rect.height * ratioY;
      const dispatch = (type: string, buttons: number) => {
        el.dispatchEvent(
          new PointerEvent(type, {
            pointerId: 1,
            pointerType: 'touch',
            isPrimary: true,
            clientX: x,
            clientY: y,
            screenX: x,
            screenY: y,
            bubbles: true,
            cancelable: true,
            buttons,
            button: 0,
          }),
        );
      };
      for (let i = 0; i < 2; i++) {
        dispatch('pointerdown', 1);
        await new Promise((r) => setTimeout(r, 40));
        dispatch('pointerup', 0);
        if (i === 0) await new Promise((r) => setTimeout(r, gapMs));
      }
    },
    { ratioX, ratioY, gapMs },
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
 * scene 안정화 대기 — scene transform이 3 프레임(폴링 틱) 연속 동일해질 때까지.
 * RAF 트윈/제스처 릴리스 애니메이션 종료 신호로 사용한다 (고정 대기 대체 — B-23).
 * `window.__lastTf/__sameCount` 폴링 상태는 호출 후 반드시 리셋한다.
 *
 * NOTE: `:scope > div > div` 는 렌더러(domElement → scene) DOM 구조 의존이다.
 * 렌더러 내부 DOM이라 testid를 부여할 수 없어 유지한다.
 */
export async function waitForSceneStable(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const canvas = document.querySelector('[data-testid="sc-canvas"]');
      if (!canvas) return false;
      const scene = canvas.querySelector(':scope > div > div') as HTMLElement | null;
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

/**
 * scrollTo 애니메이션 종료 대기 — DataRow의 activeIndex가 expected에 도달한 뒤
 * 트윈 RAF가 더 이상 카메라를 움직이지 않을 때까지 scene transform이 안정될 때까지 기다린다.
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
  // RAF 트윈 종료 — scene wrapper transform 안정화까지 (B-23: waitForSceneStable 재사용)
  await waitForSceneStable(page);
}
