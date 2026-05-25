import { expect, test } from '@playwright/test';
import { gotoPtrTab, getState, getDistance, getProgress } from '../fixtures/pull-to-refresh';

test.describe('PullToRefresh — smoke', () => {
  test('탭 진입 시 컨테이너와 상태 readout이 렌더된다', async ({ page }) => {
    await gotoPtrTab(page);

    await expect(page.getByTestId('ptr-container')).toBeVisible();
    await expect(page.getByTestId('row-state-value')).toBeVisible();
    await expect(page.getByTestId('row-distance-value')).toBeVisible();
    await expect(page.getByTestId('row-progress-value')).toBeVisible();
  });

  test('초기 상태는 idle, distance=0, progress=0', async ({ page }) => {
    await gotoPtrTab(page);

    expect(await getState(page)).toBe('idle');
    expect(await getDistance(page)).toBe(0);
    expect(await getProgress(page)).toBe(0);
  });

  test('Refresh 트리거 버튼이 노출되고 클릭 가능하다', async ({ page }) => {
    await gotoPtrTab(page);

    const trigger = page.getByTestId('ptr-trigger');
    await expect(trigger).toBeVisible();
    await expect(trigger).toBeEnabled();
  });
});
