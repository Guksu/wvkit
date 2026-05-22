import { test, expect } from '@playwright/test';
import {
  gotoDemo,
  getActiveIndex,
  getActiveZoom,
  getSceneXShift,
  getVisiblePanelIndices,
  clickScrollTo,
  clickZoomTo,
  waitForScrollSettle,
} from '../fixtures/scroll-container';

test.describe('ScrollContainer · S2 scrollTo API', () => {
  test('animated scrollTo(2): activeIndex 갱신 + scene shift + 가시 패널 윈도 이동', async ({
    page,
  }) => {
    await gotoDemo(page);
    expect(await getActiveIndex(page)).toBe(0);
    expect(await getVisiblePanelIndices(page)).toEqual([0, 1]);

    const xBefore = await getSceneXShift(page);
    expect(xBefore).not.toBeNull();

    await clickScrollTo(page, 2, true);
    await waitForScrollSettle(page, 2);

    expect(await getActiveIndex(page)).toBe(2);
    expect(await getVisiblePanelIndices(page)).toEqual([1, 2, 3]);

    const xAfter = await getSceneXShift(page);
    expect(xAfter).not.toBeNull();
    // 패널 2로 카메라 이동 → scene X shift 가 의미 있는 양으로 변했어야 함
    expect(Math.abs(xAfter! - xBefore!)).toBeGreaterThan(100);
  });

  test('non-animated scrollTo(2): 즉시 activeIndex=2', async ({ page }) => {
    await gotoDemo(page);
    await clickScrollTo(page, 2, false);
    await expect(page.getByTestId('row-activeIndex-value')).toHaveText('2');
    expect(await getActiveIndex(page)).toBe(2);
  });

  test('마지막 인덱스(5) clamp', async ({ page }) => {
    await gotoDemo(page);
    await clickScrollTo(page, 5, false);
    await expect(page.getByTestId('row-activeIndex-value')).toHaveText('5');
    await clickScrollTo(page, 5, false);
    await expect(page.getByTestId('row-activeIndex-value')).toHaveText('5');
    // 마지막 인덱스에서는 overscan=1 → 보이는 패널 [4, 5]
    expect(await getVisiblePanelIndices(page)).toEqual([4, 5]);
  });

  test('연속 scrollTo round-trip: 0 → 2 → 0', async ({ page }) => {
    await gotoDemo(page);
    const x0 = await getSceneXShift(page);

    await clickScrollTo(page, 2, true);
    await waitForScrollSettle(page, 2);
    expect(await getActiveIndex(page)).toBe(2);

    await clickScrollTo(page, 0, true);
    await waitForScrollSettle(page, 0);
    expect(await getActiveIndex(page)).toBe(0);

    const x0Back = await getSceneXShift(page);
    expect(x0Back).not.toBeNull();
    expect(Math.abs(x0Back! - x0!)).toBeLessThan(2);
    expect(await getVisiblePanelIndices(page)).toEqual([0, 1]);
  });
});

test.describe('ScrollContainer · S3 zoomTo API', () => {
  test('animated zoomTo(2): activeZoom 2.000으로 갱신', async ({ page }) => {
    await gotoDemo(page);
    expect(await getActiveZoom(page)).toBe(1);

    await clickZoomTo(page, 2, true);
    await expect(page.getByTestId('row-activeZoom-value')).toHaveText('2.000');
    expect(await getActiveZoom(page)).toBe(2);
  });

  test('non-animated zoomTo(3): 즉시 갱신', async ({ page }) => {
    await gotoDemo(page);
    await clickZoomTo(page, 3, false);
    await expect(page.getByTestId('row-activeZoom-value')).toHaveText('3.000');
  });

  test('zoom round-trip: 1 → 3 → 1', async ({ page }) => {
    await gotoDemo(page);
    await clickZoomTo(page, 3, false);
    await expect(page.getByTestId('row-activeZoom-value')).toHaveText('3.000');
    await clickZoomTo(page, 1, false);
    await expect(page.getByTestId('row-activeZoom-value')).toHaveText('1.000');
  });
});
