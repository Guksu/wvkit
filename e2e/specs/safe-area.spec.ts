import { expect, test } from '@playwright/test';

async function gotoSafeAreaTab(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await page.getByTestId('tab-safe-area').click();
  await page.getByTestId('row-top-value').waitFor();
}

test.describe('SafeArea', () => {
  test('네 방향 inset readout이 모두 노출된다', async ({ page }) => {
    await gotoSafeAreaTab(page);

    await expect(page.getByTestId('row-top-value')).toBeVisible();
    await expect(page.getByTestId('row-right-value')).toBeVisible();
    await expect(page.getByTestId('row-bottom-value')).toBeVisible();
    await expect(page.getByTestId('row-left-value')).toBeVisible();
  });

  test('각 inset 값은 px 단위 숫자 형식이다', async ({ page }) => {
    await gotoSafeAreaTab(page);

    for (const side of ['top', 'right', 'bottom', 'left']) {
      const txt = await page.getByTestId(`row-${side}-value`).textContent();
      expect(txt).toMatch(/^\d+px$/);
    }
  });

  test('데스크탑 브라우저에서는 모든 inset이 0이다 (env() 미지정)', async ({ page }, testInfo) => {
    // 모바일 디바이스 프로젝트는 viewport meta + 디바이스 인셋이 있어 0이 아닐 수 있어 스킵.
    test.skip(
      /mobile/.test(testInfo.project.name),
      '모바일 프로젝트는 디바이스 safe-area-inset 값을 가질 수 있음',
    );

    await gotoSafeAreaTab(page);
    for (const side of ['top', 'right', 'bottom', 'left']) {
      const txt = await page.getByTestId(`row-${side}-value`).textContent();
      expect(txt).toBe('0px');
    }
  });
});
