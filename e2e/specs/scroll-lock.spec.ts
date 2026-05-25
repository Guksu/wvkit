import { expect, test } from '@playwright/test';

async function gotoScrollLockTab(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await page.getByTestId('tab-scroll-lock').click();
  await page.getByTestId('lock-status').waitFor();
}

async function getBodyOverflow(page: import('@playwright/test').Page): Promise<string> {
  return await page.evaluate(() => document.body.style.overflow);
}

test.describe('ScrollLock', () => {
  test('초기 상태는 unlocked, body overflow는 비어있다', async ({ page }) => {
    await gotoScrollLockTab(page);

    await expect(page.getByTestId('lock-status')).toHaveAttribute('data-locked', 'false');
    expect(await getBodyOverflow(page)).toBe('');
  });

  test('lock() 호출 시 body overflow=hidden, status=locked', async ({ page }) => {
    await gotoScrollLockTab(page);

    await page.getByTestId('lock-btn').click();

    await expect(page.getByTestId('lock-status')).toHaveAttribute('data-locked', 'true');
    expect(await getBodyOverflow(page)).toBe('hidden');
  });

  test('unlock() 호출 시 body overflow 복원 + status=unlocked', async ({ page }) => {
    await gotoScrollLockTab(page);

    await page.getByTestId('lock-btn').click();
    await expect(page.getByTestId('lock-status')).toHaveAttribute('data-locked', 'true');

    await page.getByTestId('unlock-btn').click();

    await expect(page.getByTestId('lock-status')).toHaveAttribute('data-locked', 'false');
    expect(await getBodyOverflow(page)).toBe('');
  });

  test('잠금 상태에서는 lock 버튼이 비활성, 해제 상태에서는 unlock 버튼이 비활성', async ({ page }) => {
    await gotoScrollLockTab(page);

    // 초기: unlocked → unlock 버튼 비활성
    await expect(page.getByTestId('unlock-btn')).toBeDisabled();
    await expect(page.getByTestId('lock-btn')).toBeEnabled();

    // lock 후: lock 버튼 비활성
    await page.getByTestId('lock-btn').click();
    await expect(page.getByTestId('lock-btn')).toBeDisabled();
    await expect(page.getByTestId('unlock-btn')).toBeEnabled();
  });

  test('탭 전환 시 자동 unlock (destroy 가드)', async ({ page }) => {
    await gotoScrollLockTab(page);

    await page.getByTestId('lock-btn').click();
    expect(await getBodyOverflow(page)).toBe('hidden');

    await page.getByTestId('tab-safe-area').click();
    await page.getByTestId('row-top-value').waitFor();

    // ScrollLockDemo 언마운트 → useScrollLock cleanup의 unlock 호출로 body가 복원되어야 함
    expect(await getBodyOverflow(page)).toBe('');
  });
});
