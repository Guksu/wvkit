import { test, expect, type ConsoleMessage } from '@playwright/test';

test.describe('ScrollContainer · S1 smoke', () => {
  test('데모 페이지가 마운트되고 콘솔 에러가 없다', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg: ConsoleMessage) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await page.goto('/');

    // 첫 번째 탭이 scroll-container 이므로 별도 클릭 불필요
    const canvas = page.getByTestId('sc-canvas');
    await expect(canvas).toBeVisible();

    // CSS3DRenderer가 자식 div를 한 개 이상 생성하는지 확인
    await expect.poll(async () => (await canvas.locator(':scope > *').count())).toBeGreaterThan(0);

    await expect(page.getByTestId('row-activeIndex-value')).toHaveText('0');
    await expect(page.getByTestId('row-activeZoom-value')).toHaveText('1.000');
    await expect(page.getByTestId('row-direction-value')).toHaveText('horizontal');

    expect(consoleErrors, `unexpected console errors:\n${consoleErrors.join('\n')}`).toEqual([]);
  });
});
