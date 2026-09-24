import { test, expect } from '@playwright/test';
import {
  gotoDemo,
  getActiveIndex,
  getActiveZoom,
  getCanvasWidth,
  getDirection,
  getSceneXShift,
  getSceneYShift,
  swipeOnCanvas,
  pinchOnCanvas,
  liftPinch,
  doubleTapOnCanvas,
  getCameraPosition,
  dragSampleCamera,
  clickZoomTo,
  clickScrollTo,
  hoverCanvasAwayFromHorizontalScrollers,
  waitForScrollSettle,
  waitForSceneStable,
  swipeOnElement,
} from '../fixtures/scroll-container';

/**
 * 데모의 dragThreshold 기본값 (px). 드래그는 이만큼 움직인 뒤 시작하고 기준점을 이만큼 당겨 잡으므로,
 * 카메라 이동량 = (손가락 이동 − DRAG_THRESHOLD) / zoom.
 */
const DRAG_THRESHOLD = 10;

test.describe('ScrollContainer · S4 horizontal gesture', () => {
  test('큰 좌측 드래그(>threshold) → 다음 패널로 스냅', async ({ page }) => {
    await gotoDemo(page);
    expect(await getActiveIndex(page)).toBe(0);

    // 좌측으로 60% width 드래그 — snapThreshold(0.3)를 충분히 초과
    await swipeOnCanvas(page, -260, 0);
    await waitForScrollSettle(page, 1);

    expect(await getActiveIndex(page)).toBe(1);
  });

  test('작은 좌측 드래그(<threshold) → 원래 패널로 스냅 백', async ({ page }) => {
    await gotoDemo(page);

    // snapThreshold = 0.3 → 캔버스 width의 ~10%만 (스냅 미트리거)
    await swipeOnCanvas(page, -40, 0);
    await waitForScrollSettle(page, 0);

    expect(await getActiveIndex(page)).toBe(0);
  });

  // G1 골든: horizontal 모드의 존재 이유 — 대각 입력의 Y 성분이 카메라에 누출되지 않는다.
  test('@golden diagonal 드래그 → X만 스냅, scene Y-shift 불변', async ({ page }) => {
    await gotoDemo(page);
    expect(await getActiveIndex(page)).toBe(0);

    const x0 = await getSceneXShift(page);
    const y0 = await getSceneYShift(page);
    expect(x0).not.toBeNull();
    expect(y0).not.toBeNull();

    // dy 동반 대각 드래그 — dx는 snapThreshold(0.3)를 확실히 초과
    await swipeOnCanvas(page, -220, -120);
    await waitForScrollSettle(page, 1);

    expect(await getActiveIndex(page)).toBe(1);
    const x1 = await getSceneXShift(page);
    const y1 = await getSceneYShift(page);
    // X는 패널 폭만큼 이동 (다음 패널) — 부호 무관하게 유의미한 이동량으로 단언
    expect(Math.abs((x1 ?? 0) - (x0 ?? 0))).toBeGreaterThan(100);
    // Y축 오염 없음
    expect(Math.abs((y1 ?? 0) - (y0 ?? 0))).toBeLessThanOrEqual(0.5);
  });

  test('우측 드래그는 첫 패널에서 엣지 저항 후 0 유지', async ({ page }) => {
    await gotoDemo(page);
    await swipeOnCanvas(page, 200, 0);
    await waitForScrollSettle(page, 0);
    expect(await getActiveIndex(page)).toBe(0);
  });
});

test.describe('ScrollContainer · S5 vertical gesture', () => {
  test('direction=vertical 토글 후 위로 드래그 → 다음 패널', async ({ page }) => {
    await gotoDemo(page);

    // direction select를 vertical로 변경 (해당 컴포넌트는 remountKey로 재마운트)
    await page.getByTestId('ctl-direction').selectOption('vertical');

    await expect(page.getByTestId('row-direction-value')).toHaveText('vertical');
    expect(await getActiveIndex(page)).toBe(0);

    // 위로 드래그 (dy < 0) → 다음 세로 패널
    await swipeOnCanvas(page, 0, -260);
    await waitForScrollSettle(page, 1);

    expect(await getActiveIndex(page)).toBe(1);
    expect(await getDirection(page)).toBe('vertical');
  });
});

test.describe('ScrollContainer · S6 pinch zoom', () => {
  test('두 손가락 벌림 → activeZoom 1.0 초과로 증가', async ({ page }) => {
    await gotoDemo(page);
    expect(await getActiveZoom(page)).toBe(1);

    // 100px → 240px 핀치아웃
    await pinchOnCanvas(page, 100, 240);
    // pinch release 후 zoom 콜백이 실행되며 DataRow 갱신
    await expect
      .poll(async () => await getActiveZoom(page), {
        message: 'pinch out should increase activeZoom above 1.0',
        timeout: 3000,
      })
      .toBeGreaterThan(1);
  });

  test('enablePinchZoom=false에서 핀치 시도해도 activeZoom 유지', async ({ page }) => {
    await gotoDemo(page);

    // 컨트롤에서 enablePinchZoom 끄기 (체크박스)
    await page.getByTestId('ctl-enable-pinch-zoom').uncheck();
    // 리마운트 후 초기 zoom 1.0
    await expect(page.getByTestId('row-activeZoom-value')).toHaveText('1.000');

    await pinchOnCanvas(page, 100, 240);
    // 핀치 무시 → 릴리스 애니메이션까지 안정화 후에도 1.0 유지 (B-23: 고정 대기 대체)
    await waitForSceneStable(page);
    expect(await getActiveZoom(page)).toBe(1);
  });
});

test.describe('ScrollContainer · S11 both 폴백 + 줌 상태 pan (B-24)', () => {
  test('TC-24-05: direction=both는 horizontal로 폴백 — 가로 스와이프만 스냅, 세로 입력은 무시', async ({
    page,
  }) => {
    await gotoDemo(page);

    // both 선택 → remountKey로 재마운트
    await page.getByTestId('ctl-direction').selectOption('both');
    await expect(page.getByTestId('row-direction-value')).toHaveText('both');
    expect(await getActiveIndex(page)).toBe(0);

    // 가로 스와이프 → horizontal 폴백이 다음 패널로 스냅 (CLAUDE §1 폴백 계약)
    await swipeOnCanvas(page, -260, 0);
    await waitForScrollSettle(page, 1);
    expect(await getActiveIndex(page)).toBe(1);

    // 세로 스와이프 → 인덱스 유지 + scene Y-shift 오염 없음
    const y0 = await getSceneYShift(page);
    expect(y0).not.toBeNull();
    await swipeOnCanvas(page, 0, -260);
    await waitForSceneStable(page);

    expect(await getActiveIndex(page)).toBe(1);
    const y1 = await getSceneYShift(page);
    expect(Math.abs((y1 ?? 0) - (y0 ?? 0))).toBeLessThanOrEqual(0.5);
  });

  test('TC-24-06: zoom=2 상태의 가로 pan — 콘텐츠가 실제 이동하고 zoom은 오염되지 않는다', async ({
    page,
  }) => {
    await gotoDemo(page);

    await clickZoomTo(page, 2, false);
    await expect(page.getByTestId('row-activeZoom-value')).toHaveText('2.000');

    const x0 = await getSceneXShift(page);
    expect(x0).not.toBeNull();

    // zoom=2에서는 화면 1px = 월드 0.5unit. 패널 가장자리(폭/4)를 지나 다음 패널 앞 gap(폭/2)의
    // 30%를 넘어야 스냅되므로 화면 기준 0.8×폭 이상 — 캔버스 폭에 비례해 스와이프
    const width = await getCanvasWidth(page);
    await swipeOnCanvas(page, -Math.round(width * 0.95), 0);
    await waitForScrollSettle(page, 1);

    // pan이 콘텐츠를 실제 이동시킨다 (다음 패널로 스냅 → scene X-shift 대폭 변화)
    const x1 = await getSceneXShift(page);
    expect(Math.abs((x1 ?? 0) - (x0 ?? 0))).toBeGreaterThan(50);
    // pan이 zoom을 오염시키지 않는다
    expect(await getActiveZoom(page)).toBe(2);
  });
});

// 줌 상태 pan 계약: 릴리스 후 패널 중심으로 되돌아가지 않고, 첫 패널 가장자리까지 도달할 수 있다.
// getSceneXShift는 카메라 X의 부호 반전(−cameraX + 상수)이므로 Δshift = −ΔcameraX.
test.describe('ScrollContainer · S12 줌 상태 pan — 위치 유지 + 가장자리 도달', () => {
  test('zoom=2에서 작은 pan 후 릴리스 → 카메라가 그 자리에 머문다 (중심 복귀 없음)', async ({
    page,
  }) => {
    await gotoDemo(page);
    await clickZoomTo(page, 2, false);
    await expect(page.getByTestId('row-activeZoom-value')).toHaveText('2.000');
    const x0 = await getSceneXShift(page);
    expect(x0).not.toBeNull();

    // 화면 −60px → 여유 10px 을 뺀 50px → 월드 +25 (패널 0 범위 [−폭/4, +폭/4] 안), 멈춘 뒤 놓기 — 그 자리 유지
    await swipeOnCanvas(page, -60, 0, { holdMs: 300 });
    await waitForSceneStable(page);

    expect(await getActiveIndex(page)).toBe(0);
    expect(await getActiveZoom(page)).toBe(2);
    const x1 = await getSceneXShift(page);
    expect((x1 ?? 0) - (x0 ?? 0)).toBeCloseTo(-(60 - DRAG_THRESHOLD) / 2, 0);
  });

  test('zoom=2에서 우측으로 크게 끌면 첫 패널 왼쪽 가장자리(cameraX = −폭/4)에서 멈춘다', async ({
    page,
  }) => {
    await gotoDemo(page);
    await clickZoomTo(page, 2, false);
    await expect(page.getByTestId('row-activeZoom-value')).toHaveText('2.000');
    const width = await getCanvasWidth(page);
    const x0 = await getSceneXShift(page);
    expect(x0).not.toBeNull();

    // 저항 구간까지 충분히 끌고 릴리스 → 가장자리로 복귀
    await swipeOnCanvas(page, Math.round(width * 0.9), 0);
    await waitForSceneStable(page);

    expect(await getActiveIndex(page)).toBe(0);
    const x1 = await getSceneXShift(page);
    expect((x1 ?? 0) - (x0 ?? 0)).toBeCloseTo(width / 4, 0);
  });

  test('zoom=2에서 가장자리를 지나 gap을 threshold 넘게 건너면 다음 패널 가까운 가장자리로 스냅', async ({
    page,
  }) => {
    await gotoDemo(page);
    await clickZoomTo(page, 2, false);
    await expect(page.getByTestId('row-activeZoom-value')).toHaveText('2.000');
    const width = await getCanvasWidth(page);
    const x0 = await getSceneXShift(page);

    await swipeOnCanvas(page, -Math.round(width * 0.95), 0);
    await waitForScrollSettle(page, 1);

    expect(await getActiveIndex(page)).toBe(1);
    expect(await getActiveZoom(page)).toBe(2);
    // 패널 1의 왼쪽 가장자리: cameraX = 폭 − 폭/4 = 0.75폭
    const x1 = await getSceneXShift(page);
    expect((x1 ?? 0) - (x0 ?? 0)).toBeCloseTo(-width * 0.75, 0);
  });
});

// 관성: 줌 상태 플릭은 손을 뗀 위치보다 더 흘러가서 멈춘다 (투영 = 속도 × 500).
test.describe('ScrollContainer · S13 관성 (릴리스 속도 반영)', () => {
  test('zoom=2에서 빠른 플릭 → 릴리스 지점보다 더 나아가 패널 범위 안 또는 가장자리에서 멈춘다', async ({
    page,
  }) => {
    await gotoDemo(page);
    await clickZoomTo(page, 2, false);
    await expect(page.getByTestId('row-activeZoom-value')).toHaveText('2.000');
    const width = await getCanvasWidth(page);
    const x0 = await getSceneXShift(page);
    expect(x0).not.toBeNull();

    // 화면 −40px 를 60ms 안에 (빠른 플릭) → 릴리스 시점 카메라 +20 월드, 관성으로 그보다 앞까지
    await swipeOnCanvas(page, -40, 0, { steps: 4, duration: 60 });
    await waitForSceneStable(page);

    // 관성만으로는 다음 패널로 넘어가지 않는다
    expect(await getActiveIndex(page)).toBe(0);
    const x1 = await getSceneXShift(page);
    const moved = (x0 ?? 0) - (x1 ?? 0); // Δshift = −ΔcameraX → 카메라 전진량
    // 손을 뗀 지점(20)보다 더 갔고, 패널 0 의 가장자리(폭/4)를 넘지 않는다
    expect(moved).toBeGreaterThan(20 + 5);
    expect(moved).toBeLessThanOrEqual(width / 4 + 1);
  });

  test('zoom=2에서 멈춘 뒤 놓으면 그 자리에 머문다 (관성 없음)', async ({ page }) => {
    await gotoDemo(page);
    await clickZoomTo(page, 2, false);
    await expect(page.getByTestId('row-activeZoom-value')).toHaveText('2.000');
    const x0 = await getSceneXShift(page);

    // 끌고 나서 멈춘 채(holdMs) 놓기 → 릴리스 속도 0 → 관성 투영 없음
    await swipeOnCanvas(page, -40, 0, { steps: 4, duration: 120, holdMs: 300 });
    await waitForSceneStable(page);

    const x1 = await getSceneXShift(page);
    const moved = (x0 ?? 0) - (x1 ?? 0);
    // 릴리스 지점 그대로 (화면 40px − 여유 10px → zoom 2 에서 월드 15)
    expect(moved).toBeCloseTo((40 - DRAG_THRESHOLD) / 2, 0);
  });
});

// 교차 축 pan: zoom > 1 이면 페이저 축의 반대 축도 패널의 교차 축 반폭 (h/2)(1 − 1/z) 안에서 움직인다.
// (합성 PointerEvent 라 패널의 touch-action: pan-y 는 개입하지 않는다 — 실기기에서는 브라우저가 세로 터치를 가져간다.)
test.describe('ScrollContainer · S14 줌 상태 교차 축 pan', () => {
  test('zoom=2에서 세로 드래그 → camera.y 가 dy/2 만큼 움직이고 정지 릴리스 후 유지', async ({
    page,
  }) => {
    await gotoDemo(page);
    await clickZoomTo(page, 2, false);
    await expect(page.getByTestId('row-activeZoom-value')).toHaveText('2.000');
    const c0 = await getCameraPosition(page);
    expect(c0?.y ?? 1).toBeCloseTo(0, 0);

    await swipeOnCanvas(page, 0, -60, { holdMs: 300 });
    await waitForSceneStable(page);

    const c1 = await getCameraPosition(page);
    // 화면 −60px − 여유 10px → 월드 −25 (부호: 스크린 Y↓, 월드 Y↑)
    expect(c1?.y ?? 0).toBeCloseTo(-(60 - DRAG_THRESHOLD) / 2, 0);
    expect(c1?.x ?? 1).toBeCloseTo(0, 0);
    expect(await getActiveZoom(page)).toBe(2);
  });

  test('zoom=2에서 세로로 크게 끌면 교차 축 반폭(h/4)에서 멈춘다', async ({ page }) => {
    await gotoDemo(page);
    await clickZoomTo(page, 2, false);
    await expect(page.getByTestId('row-activeZoom-value')).toHaveText('2.000');
    const height = await page.evaluate(
      () =>
        (document.querySelector('[data-testid="sc-canvas"]') as HTMLElement | null)?.clientHeight ??
        0,
    );

    await swipeOnCanvas(page, 0, Math.round(height * 0.9));
    await waitForSceneStable(page);

    const c1 = await getCameraPosition(page);
    expect(c1?.y ?? 0).toBeCloseTo(height / 4, 0);
  });

  test('zoom=1에서는 세로 드래그가 카메라를 움직이지 않는다 (교차 축 고정)', async ({ page }) => {
    await gotoDemo(page);
    await swipeOnCanvas(page, 0, -80, { holdMs: 200 });
    await waitForSceneStable(page);
    const c1 = await getCameraPosition(page);
    expect(c1?.y ?? 1).toBeCloseTo(0, 0);
    expect(c1?.x ?? 1).toBeCloseTo(0, 0);
  });
});

// 더블탭 줌 (데모 기본 doubleTapZoom=2): 탭한 지점을 고정한 채 확대, 다시 더블탭하면 1로 (패널 중심).
test.describe('ScrollContainer · S15 더블탭 줌', () => {
  test('더블탭 → activeZoom 2, 탭한 지점(오른쪽 1/4)이 화면에서 고정된다', async ({ page }) => {
    await gotoDemo(page);
    const width = await getCanvasWidth(page);

    await doubleTapOnCanvas(page, { ratioX: 0.75, ratioY: 0.5 });
    await expect(page.getByTestId('row-activeZoom-value')).toHaveText('2.000');
    await waitForSceneStable(page);

    const c = await getCameraPosition(page);
    expect(c?.zoom ?? 0).toBeCloseTo(2, 2);
    // 탭 지점 아래 월드 x = 0.25w. 줌 2 에서 같은 화면 위치에 두려면 cameraX = 0.25w − 0.25w/2 = 0.125w
    expect(c?.x ?? 0).toBeCloseTo(width * 0.125, 0);
    expect(await getActiveIndex(page)).toBe(0);
  });

  test('줌 상태에서 더블탭 → activeZoom 1, 카메라는 패널 중심', async ({ page }) => {
    await gotoDemo(page);
    await doubleTapOnCanvas(page, { ratioX: 0.75 });
    await expect(page.getByTestId('row-activeZoom-value')).toHaveText('2.000');
    await waitForSceneStable(page);

    await doubleTapOnCanvas(page, { ratioX: 0.3, ratioY: 0.4 });
    await expect(page.getByTestId('row-activeZoom-value')).toHaveText('1.000');
    await waitForSceneStable(page);

    const c = await getCameraPosition(page);
    expect(c?.zoom ?? 0).toBeCloseTo(1, 2);
    expect(c?.x ?? 1).toBeCloseTo(0, 0);
    expect(c?.y ?? 1).toBeCloseTo(0, 0);
  });

  test('doubleTapZoom=false 로 바꾸면 더블탭해도 zoom 1 유지', async ({ page }) => {
    await gotoDemo(page);
    await page.getByTestId('ctl-double-tap-zoom').selectOption('off');
    await expect(page.getByTestId('row-activeZoom-value')).toHaveText('1.000');

    await doubleTapOnCanvas(page);
    await waitForSceneStable(page);
    expect(await getActiveZoom(page)).toBe(1);
  });

  test('두 탭 사이가 길면(600ms) 더블탭이 아니다', async ({ page }) => {
    await gotoDemo(page);
    await doubleTapOnCanvas(page, { gapMs: 600 });
    await waitForSceneStable(page);
    expect(await getActiveZoom(page)).toBe(1);
  });
});

// 줌 고무줄: minZoom(1) 아래로 핀치하면 제스처 중에는 1 보다 작은 scale 을 보여주고, 놓으면 1 로 돌아온다.
test.describe('ScrollContainer · S16 줌 고무줄 (minZoom 아래 핀치)', () => {
  test('핀치인 중 scale < 1, 손을 떼면 scale 1·activeZoom 1.000 으로 복귀', async ({ page }) => {
    await gotoDemo(page);
    expect(await getActiveZoom(page)).toBe(1);

    await pinchOnCanvas(page, 240, 120, { release: false });
    const mid = await getCameraPosition(page);
    // raw 0.5 → 1 × 0.5^0.2 ≈ 0.87 (resistance 0.2)
    expect(mid?.zoom ?? 1).toBeLessThan(1);
    expect(mid?.zoom ?? 0).toBeGreaterThan(0.8);

    await liftPinch(page, 120);
    await waitForSceneStable(page);

    const c = await getCameraPosition(page);
    expect(c?.zoom ?? 0).toBeCloseTo(1, 2);
    expect(c?.x ?? 1).toBeCloseTo(0, 0);
    expect(await getActiveZoom(page)).toBe(1);
  });

  test('maxZoom(3) 위로 핀치하면 놓은 뒤 activeZoom 3.000 으로 정착', async ({ page }) => {
    await gotoDemo(page);
    await pinchOnCanvas(page, 60, 300, { release: false }); // factor 5 → raw 5 > 3
    const mid = await getCameraPosition(page);
    expect(mid?.zoom ?? 0).toBeGreaterThan(3);

    await liftPinch(page, 300);
    await waitForSceneStable(page);
    const c = await getCameraPosition(page);
    expect(c?.zoom ?? 0).toBeCloseTo(3, 2);
    expect(await getActiveZoom(page)).toBe(3);
  });
});

// 데스크톱 입력: 휠(트랙패드) 제스처당 한 패널, 키보드는 호스트 포커스일 때만, ARIA 는 활성 패널만 노출.
test.describe('ScrollContainer · S17 데스크톱 입력 (휠 · 키보드 · ARIA)', () => {
  // Playwright 는 mobile WebKit 에서 mouse.wheel 을 지원하지 않는다 ("Mouse wheel is not supported in mobile WebKit").
  // 실제 iOS 에도 휠이 없으므로 그 프로젝트만 건너뛴다 (mobile-chrome 은 지원).
  const NO_WHEEL = 'Playwright: mobile WebKit 은 mouse.wheel 을 지원하지 않는다';

  test('가로 휠 → 다음 패널로 한 칸', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile-safari', NO_WHEEL);
    await gotoDemo(page);
    // 칩 줄(가로 스크롤러) 위에서는 휠이 칩을 먼저 스크롤한다 (설계) — 그런 요소가 없는 지점에서 굴린다.
    await hoverCanvasAwayFromHorizontalScrollers(page);
    // 이벤트 한 번으로 임계값(40px)을 넘긴다. 모바일 에뮬레이션은 delta 를 기기 배율로 나눠 전달하므로
    // (Pixel 7 ×2.625: 200 → 76) 여유를 둔다. 여러 이벤트를 이어 보내는 "한 제스처 = 한 칸" 판정은 이벤트 간격(120ms)이
    // 기계 부하에 따라 흔들려 e2e 로는 결정적이지 않다 — 시계를 고정한 단위 테스트(desktop-input W1)가 검증한다.
    await page.mouse.wheel(200, 0);
    await waitForScrollSettle(page, 1);
    await waitForSceneStable(page);
    expect(await getActiveIndex(page)).toBe(1);
  });

  test('칩 줄 위 가로 휠은 칩을 스크롤하고 페이지를 넘기지 않는다 (중첩 스크롤러 우선)', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile-safari', NO_WHEEL);
    await gotoDemo(page);
    const chips = page.locator('[data-panel-index="0"] [data-chips]');
    await chips.scrollIntoViewIfNeeded();
    const box = await chips.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(
      (box?.x ?? 0) + (box?.width ?? 0) / 2,
      (box?.y ?? 0) + (box?.height ?? 0) / 2,
    );
    await page.mouse.wheel(200, 0);
    await expect
      .poll(async () => await chips.evaluate((el) => el.scrollLeft), { timeout: 3000 })
      .toBeGreaterThan(0);
    await page.waitForTimeout(300);
    expect(await getActiveIndex(page)).toBe(0);
  });

  test('세로 휠은 패널 자체 스크롤에 맡기고 페이지를 넘기지 않는다', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile-safari', NO_WHEEL);
    await gotoDemo(page);
    const canvas = page.getByTestId('sc-canvas');
    await canvas.hover();
    const before = await page.evaluate(
      () =>
        (document.querySelector('[data-panel-index="0"]') as HTMLElement | null)?.scrollTop ?? -1,
    );
    await page.mouse.wheel(0, 200);
    await page.waitForTimeout(300);
    const after = await page.evaluate(
      () =>
        (document.querySelector('[data-panel-index="0"]') as HTMLElement | null)?.scrollTop ?? -1,
    );
    expect(after).toBeGreaterThan(before);
    expect(await getActiveIndex(page)).toBe(0);
  });

  test('캔버스에 포커스 → ArrowRight / End / Home 으로 이동', async ({ page }) => {
    await gotoDemo(page);
    const canvas = page.getByTestId('sc-canvas');
    await expect(canvas).toHaveAttribute('tabindex', '0');
    await canvas.focus();
    await page.keyboard.press('ArrowRight');
    await waitForScrollSettle(page, 1);
    await page.keyboard.press('End');
    await waitForScrollSettle(page, 5);
    await page.keyboard.press('Home');
    await waitForScrollSettle(page, 0);
    expect(await getActiveIndex(page)).toBe(0);
  });

  test('Escape 는 줌 상태에서 zoom 1 로', async ({ page }) => {
    await gotoDemo(page);
    await clickZoomTo(page, 2, false);
    await expect(page.getByTestId('row-activeZoom-value')).toHaveText('2.000');
    await page.getByTestId('sc-canvas').focus();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('row-activeZoom-value')).toHaveText('1.000');
  });

  test('마우스 클릭이 패널 안 버튼(♡)에 닿는다 — likes 카운터 증가', async ({ page }) => {
    await gotoDemo(page);
    await expect(page.getByTestId('row-likes-value')).toHaveText('0');
    const like = page.locator('[data-panel-index="0"] [data-like]').first();
    await like.scrollIntoViewIfNeeded();
    await like.click();
    await expect(page.getByTestId('row-likes-value')).toHaveText('1');
    expect(await getActiveIndex(page)).toBe(0);
  });

  test('ARIA: 호스트 carousel 역할, 패널 slide 라벨, 활성 패널만 aria-hidden 없음', async ({
    page,
  }) => {
    await gotoDemo(page);
    const canvas = page.getByTestId('sc-canvas');
    await expect(canvas).toHaveAttribute('role', 'group');
    await expect(canvas).toHaveAttribute('aria-roledescription', 'carousel');
    const hidden = async () =>
      await page.evaluate(() =>
        Array.from(document.querySelectorAll<HTMLElement>('[data-panel-index]')).map((p) => [
          p.dataset.panelIndex,
          p.getAttribute('aria-roledescription'),
          p.getAttribute('aria-label'),
          p.getAttribute('aria-hidden'),
        ]),
      );
    const before = await hidden();
    expect(before.find((r) => r[0] === '0')).toEqual(['0', 'slide', '1 / 6', null]);
    expect(before.find((r) => r[0] === '1')).toEqual(['1', 'slide', '2 / 6', 'true']);

    await clickScrollTo(page, 2, false);
    await waitForScrollSettle(page, 2);
    const after = await hidden();
    expect(after.find((r) => r[0] === '2')?.[3]).toBeNull();
    expect(after.find((r) => r[0] === '1')?.[3]).toBe('true');
    expect(after.find((r) => r[0] === '3')?.[3]).toBe('true');
  });
});

// 드래그 시작 여유 · 방향 잠금: 여유(10px) 안에서는 움직이지 않고, 넘을 때 우세 축(45°)으로 방향을 정한다.
// 정착 후 값만 보면 "흔들렸다 돌아온" 것을 놓치므로 move 마다 카메라를 기록해 단언한다.
test.describe('ScrollContainer · S18 드래그 시작 여유 · 방향 잠금', () => {
  test('8px 가로 떨림(탭 흔들림)은 페이저를 한 번도 움직이지 않는다', async ({ page }) => {
    await gotoDemo(page);
    const samples = await dragSampleCamera(page, [
      [-3, 0],
      [-6, 1],
      [-8, 0],
      [-5, 1],
    ]);
    expect(samples.every((c) => c.x === 0 && c.y === 0)).toBe(true);
    expect(await getActiveIndex(page)).toBe(0);
  });

  test('가로 드래그는 여유만큼 당겨 잡아 튀지 않는다 — 12px 에서 2, 20px 에서 10', async ({
    page,
  }) => {
    await gotoDemo(page);
    const samples = await dragSampleCamera(page, [
      [-5, 0],
      [-12, 0],
      [-20, 0],
    ]);
    expect(samples.map((c) => c.x)).toEqual([0, 2, 10]);
  });

  test('세로 우세 대각(zoom 1)은 페이저가 받지 않는다 — 이후 가로로 크게 움직여도 제자리', async ({
    page,
  }) => {
    await gotoDemo(page);
    const samples = await dragSampleCamera(page, [
      [-4, -12],
      [-10, -30],
      [-60, -40],
      [-120, -40],
    ]);
    expect(samples.every((c) => c.x === 0)).toBe(true);
    await waitForSceneStable(page);
    expect(await getActiveIndex(page)).toBe(0);
  });

  test('zoom 2 · pan-y 피드 패널 위 세로 터치는 브라우저 몫이라 카메라가 움직이지 않는다 (마우스는 움직인다)', async ({
    page,
  }) => {
    await gotoDemo(page);
    await clickZoomTo(page, 2, false);
    await expect(page.getByTestId('row-activeZoom-value')).toHaveText('2.000');
    const target = '[data-panel-index="0"] [data-like]';
    const touch = await dragSampleCamera(
      page,
      [
        [-2, -12],
        [-4, -30],
        [-6, -60],
      ],
      { targetSelector: target },
    );
    expect(touch.every((c) => c.x === 0 && c.y === 0)).toBe(true);
    await waitForSceneStable(page);
    const mouse = await dragSampleCamera(
      page,
      [
        [0, -12],
        [0, -30],
      ],
      { targetSelector: target, pointerType: 'mouse' },
    );
    // 마우스는 touch-action 과 무관 — 자유 2D pan: (30 − 10)/2 = 10 월드 위로
    expect(mouse[mouse.length - 1]?.y).toBeCloseTo(-10, 1);
  });

  test('dragThreshold=0 (데모 컨트롤) → 이전처럼 첫 move 부터 따라간다', async ({ page }) => {
    await gotoDemo(page);
    await page.getByTestId('ctl-drag-threshold').fill('0');
    await expect(page.getByTestId('row-activeIndex-value')).toHaveText('0');
    const samples = await dragSampleCamera(page, [
      [-3, 0],
      [-6, 1],
    ]);
    expect(samples.map((c) => c.x)).toEqual([3, 6]);
  });
});

// 가변 폭 · 피킹 · 간격 · 정렬: 패널의 실제 화면 위치(getBoundingClientRect)를 캔버스와 비교한다.
test.describe('ScrollContainer · S19 패널 폭 · 간격 · 정렬 (피킹)', () => {
  /** 캔버스 기준 패널 가로 위치 (left/right/center, 캔버스 왼쪽 = 0) */
  async function panelBox(page: import('@playwright/test').Page, index: number) {
    return await page.evaluate((i) => {
      const canvas = document.querySelector('[data-testid="sc-canvas"]') as HTMLElement;
      const panel = canvas.querySelector(`[data-panel-index="${i}"]`) as HTMLElement | null;
      const c = canvas.getBoundingClientRect();
      if (!panel || getComputedStyle(panel).display === 'none') return null;
      const r = panel.getBoundingClientRect();
      return {
        left: r.left - c.left,
        right: r.right - c.left,
        center: r.left + r.width / 2 - c.left,
        width: r.width,
        canvasWidth: c.width,
      };
    }, index);
  }

  test('panelWidth 0.85 + gap 12 (center) — 현재 패널은 가운데, 다음 패널이 오른쪽에 살짝 보이고, 넘기면 양옆이 보인다', async ({
    page,
  }) => {
    await gotoDemo(page);
    await page.getByTestId('ctl-panel-width').selectOption('0.85');
    await page.getByTestId('ctl-gap').fill('12');
    await expect(page.getByTestId('row-activeIndex-value')).toHaveText('0');
    await waitForSceneStable(page);

    const p0 = await panelBox(page, 0);
    const p1 = await panelBox(page, 1);
    expect(p0).not.toBeNull();
    expect(p1).not.toBeNull();
    const W = p0?.canvasWidth ?? 0;
    expect(p0?.width ?? 0).toBeCloseTo(W * 0.85, 0);
    expect(p0?.center ?? 0).toBeCloseTo(W / 2, 0);
    // 다음 패널 왼쪽 = 현재 패널 오른쪽 + 12, 그리고 캔버스 안(피킹)
    expect((p1?.left ?? 0) - (p0?.right ?? 0)).toBeCloseTo(12, 0);
    expect(p1?.left ?? W).toBeLessThan(W);

    await swipeOnCanvas(page, -Math.round(W * 0.6), 0);
    await waitForScrollSettle(page, 1);
    await waitForSceneStable(page);
    const q0 = await panelBox(page, 0);
    const q1 = await panelBox(page, 1);
    expect(q1?.center ?? 0).toBeCloseTo(W / 2, 0);
    expect(q0?.right ?? 0).toBeGreaterThan(0); // 이전 패널이 왼쪽에 살짝 보인다
  });

  test("align 'start' — 현재 패널 왼쪽이 캔버스 왼쪽에 붙고, scrollTo(2) 뒤에도 그렇다", async ({
    page,
  }) => {
    await gotoDemo(page);
    await page.getByTestId('ctl-panel-width').selectOption('0.7');
    await page.getByTestId('ctl-align').selectOption('start');
    await expect(page.getByTestId('row-activeIndex-value')).toHaveText('0');
    await waitForSceneStable(page);
    expect((await panelBox(page, 0))?.left ?? 99).toBeCloseTo(0, 0);

    await clickScrollTo(page, 2, false);
    await waitForScrollSettle(page, 2);
    await waitForSceneStable(page);
    const p2 = await panelBox(page, 2);
    expect(p2?.left ?? 99).toBeCloseTo(0, 0);
    expect(p2?.width ?? 0).toBeCloseTo((p2?.canvasWidth ?? 0) * 0.7, 0);
  });

  test('panelWidth 280px — 화면 폭과 상관없이 280px, 보이는 이웃 패널은 DOM 에 붙어 있다', async ({
    page,
  }) => {
    await gotoDemo(page);
    await page.getByTestId('ctl-panel-width').selectOption('280');
    await expect(page.getByTestId('row-activeIndex-value')).toHaveText('0');
    await waitForSceneStable(page);
    const p0 = await panelBox(page, 0);
    expect(p0?.width ?? 0).toBeCloseTo(280, 0);
    const p1 = await panelBox(page, 1);
    expect(p1).not.toBeNull();
  });
});

test.describe('ScrollContainer · S20 패널 안 캐러셀 (noDragSelector)', () => {
  const banner = '.swiper[data-banner="0"]';
  const counter = `${banner} [data-banner-counter]`;

  test('배너(Swiper)를 밀면 배너만 넘어가고 페이저는 움직이지 않는다', async ({ page }) => {
    await gotoDemo(page);
    await page.getByTestId('sc-canvas').scrollIntoViewIfNeeded();
    await expect(page.locator(counter)).toHaveText('1 | 5');
    const x0 = await getSceneXShift(page);

    await swipeOnElement(page, banner, -160);
    await expect(page.locator(counter)).toHaveText('2 | 5');
    await waitForSceneStable(page);

    expect(await getActiveIndex(page)).toBe(0);
    expect(await getSceneXShift(page)).toBe(x0);
  });

  test('배너 위 가로 휠은 페이지를 넘기지 않는다', async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name === 'mobile-safari',
      'Playwright: mobile WebKit 은 mouse.wheel 을 지원하지 않는다',
    );
    await gotoDemo(page);
    await page.getByTestId('sc-canvas').scrollIntoViewIfNeeded();
    const box = await page.locator(banner).boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(200, 0);
    await page.waitForTimeout(400);
    expect(await getActiveIndex(page)).toBe(0);
  });

  test('noDragSelector 를 끄면 같은 스와이프에 배너와 페이저가 함께 넘어간다 (옵션이 필요한 이유)', async ({
    page,
  }) => {
    await gotoDemo(page);
    await page.getByTestId('ctl-no-drag').uncheck();
    await page.getByTestId('sc-canvas').scrollIntoViewIfNeeded();
    await expect(page.locator(counter)).toHaveText('1 | 5');

    await swipeOnElement(page, banner, -160);
    await waitForScrollSettle(page, 1);

    expect(await getActiveIndex(page)).toBe(1);
    await expect(page.locator(counter)).toHaveText('2 | 5');
  });
});
