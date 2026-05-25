import { expect, test } from '@playwright/test';
import {
  getDistance,
  getState,
  gotoPtrTab,
  pullOnContainer,
  waitForState,
} from '../fixtures/pull-to-refresh';

test.describe('PullToRefresh — gesture', () => {
  test('threshold 미달 당김 → release 시 onRefresh 발화 없이 idle 복귀', async ({ page }) => {
    await gotoPtrTab(page);

    // threshold(기본 60) 미달, 저항(0.5) 적용 후도 60 안 됨 — dy=80 정도면 적정
    await pullOnContainer(page, 40, { duration: 200 });

    // hold 안 했으니 자동 release — refreshing으로 안 가야 함
    await page.waitForTimeout(50);
    const finalState = await getState(page);
    expect(['idle', 'resetting']).toContain(finalState);

    // 충분히 기다리면 idle로 정착
    await waitForState(page, 'idle', 2000);
  });

  test('threshold 초과 당김 후 release → refreshing → idle', async ({ page }) => {
    await gotoPtrTab(page);

    // dy=200 정도면 저항을 거쳐도 threshold 60 넘김
    await pullOnContainer(page, 220, { duration: 250 });

    // hold 안 했으니 자동 release → refreshing 진입해야 함
    await waitForState(page, 'refreshing', 2000);

    // 복귀 대기
    await waitForState(page, 'idle', 5000);
  });

  test('당기는 동안 distance가 0보다 커진다 (hold)', async ({ page }) => {
    await gotoPtrTab(page);

    const handle = await pullOnContainer(page, 80, { duration: 200, hold: true });
    if (!handle) throw new Error('hold:true 인데 handle이 없음');

    // hold 중에는 pulling/armed 상태이고 distance > 0
    const stateWhileHeld = await getState(page);
    expect(['pulling', 'armed']).toContain(stateWhileHeld);
    expect(await getDistance(page)).toBeGreaterThan(0);

    await handle.release();
    await waitForState(page, 'idle', 3000);
  });
});
