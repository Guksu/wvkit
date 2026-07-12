import { test, expect } from '@playwright/test';
import {
  gotoDemo,
  getActiveIndex,
  getActiveZoom,
  getDirection,
  getSceneXShift,
  getSceneYShift,
  swipeOnCanvas,
  pinchOnCanvas,
  clickZoomTo,
  waitForScrollSettle,
  waitForSceneStable,
} from '../fixtures/scroll-container';

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
  test("TC-24-05: direction=both는 horizontal로 폴백 — 가로 스와이프만 스냅, 세로 입력은 무시", async ({ page }) => {
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

  test('TC-24-06: zoom=2 상태의 가로 pan — 콘텐츠가 실제 이동하고 zoom은 오염되지 않는다', async ({ page }) => {
    await gotoDemo(page);

    await clickZoomTo(page, 2, false);
    await expect(page.getByTestId('row-activeZoom-value')).toHaveText('2.000');

    const x0 = await getSceneXShift(page);
    expect(x0).not.toBeNull();

    // zoom=2에서는 화면 1px = 월드 0.5unit — 스냅 임계(0.3*width)를 확실히 넘도록 크게 스와이프
    await swipeOnCanvas(page, -500, 0);
    await waitForScrollSettle(page, 1);

    // pan이 콘텐츠를 실제 이동시킨다 (다음 패널로 스냅 → scene X-shift 대폭 변화)
    const x1 = await getSceneXShift(page);
    expect(Math.abs((x1 ?? 0) - (x0 ?? 0))).toBeGreaterThan(50);
    // pan이 zoom을 오염시키지 않는다
    expect(await getActiveZoom(page)).toBe(2);
  });
});
