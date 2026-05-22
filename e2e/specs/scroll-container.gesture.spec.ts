import { test, expect } from '@playwright/test';
import {
  gotoDemo,
  getActiveIndex,
  getActiveZoom,
  getDirection,
  swipeOnCanvas,
  pinchOnCanvas,
  waitForScrollSettle,
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
    await page.locator('select').first().selectOption('vertical');

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
    await page.locator('input[type="checkbox"]').first().uncheck();
    // 리마운트 후 초기 zoom 1.0
    await expect(page.getByTestId('row-activeZoom-value')).toHaveText('1.000');

    await pinchOnCanvas(page, 100, 240);
    // 핀치 무시 → 1.0 유지 (2초간 변화 없으면 PASS)
    await page.waitForTimeout(400);
    expect(await getActiveZoom(page)).toBe(1);
  });
});
