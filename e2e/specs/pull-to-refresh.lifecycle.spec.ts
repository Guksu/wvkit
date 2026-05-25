import { expect, test } from '@playwright/test';
import {
  clickTrigger,
  getState,
  gotoPtrTab,
  waitForState,
} from '../fixtures/pull-to-refresh';

test.describe('PullToRefresh — lifecycle', () => {
  test('trigger() 호출 시 idle → refreshing → idle 전이', async ({ page }) => {
    await gotoPtrTab(page);
    expect(await getState(page)).toBe('idle');

    await clickTrigger(page);
    // refreshing 상태가 잠시 노출되어야 함 (demo onRefresh는 1500ms 대기)
    await waitForState(page, 'refreshing');
    expect(await getState(page)).toBe('refreshing');

    // 새로고침 끝나면 idle 복귀 (resetting을 거치지 않을 수도 — trigger는 PT 제스처가 아니므로)
    await waitForState(page, 'idle', 5000);
  });

  test('새로고침이 끝나면 리스트 맨 위에 항목이 추가된다', async ({ page }) => {
    await gotoPtrTab(page);
    const container = page.getByTestId('ptr-container');
    const initialFirstText = (await container.locator('> div').first().textContent()) ?? '';

    await clickTrigger(page);
    await waitForState(page, 'idle', 5000);

    const afterFirstText = (await container.locator('> div').first().textContent()) ?? '';
    expect(afterFirstText).not.toBe(initialFirstText);
    expect(afterFirstText).toContain('Refreshed');
  });
});
