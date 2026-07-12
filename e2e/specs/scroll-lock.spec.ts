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

  test('TC-24-01: unlock은 lock 시점의 스크롤 위치를 복원한다', async ({ page }) => {
    await gotoScrollLockTab(page);
    // scroll-spacer가 body를 실제 스크롤 가능하게 만든다
    await page.getByTestId('scroll-spacer').waitFor();

    // 레이아웃 정착 전에는 scrollTo가 0으로 클램프될 수 있어 poll 안에서 반복 시도
    await expect
      .poll(async () => {
        await page.evaluate(() => window.scrollTo(0, 500));
        return page.evaluate(() => window.scrollY);
      })
      .toBeGreaterThan(300);
    const savedY = await page.evaluate(() => window.scrollY);

    // Playwright click()의 자동 스크롤이 저장 위치를 훼손하지 않게 DOM click으로 잠금
    await page.evaluate(() =>
      (document.querySelector('[data-testid="lock-btn"]') as HTMLButtonElement).click(),
    );
    await expect(page.getByTestId('lock-status')).toHaveAttribute('data-locked', 'true');

    // 잠금 중 프로그램적 스크롤 이동 — 복원 단언이 공허해지지 않게 저장 위치와 다르게 만든다
    await page.evaluate(() => window.scrollTo(0, 0));

    await page.evaluate(() =>
      (document.querySelector('[data-testid="unlock-btn"]') as HTMLButtonElement).click(),
    );
    await expect(page.getByTestId('lock-status')).toHaveAttribute('data-locked', 'false');
    // scroll-lock.ts:60 `window.scrollTo(0, scrollY)` 복원 계약 — lock 시점 위치로 복귀 (DPR 오차 허용)
    await expect
      .poll(async () => Math.abs((await page.evaluate(() => window.scrollY)) - savedY))
      .toBeLessThanOrEqual(2);
  });

  test('TC-24-02: 중첩 lock — 각 인스턴스가 자신이 저장한 prev 값을 복원한다 (역순 해제)', async ({ page }) => {
    await gotoScrollLockTab(page);

    await page.getByTestId('lock-btn').click();
    await expect(page.getByTestId('lock-status')).toHaveAttribute('data-locked', 'true');
    expect(await getBodyOverflow(page)).toBe('hidden');

    await page.getByTestId('lock2-btn').click();
    await expect(page.getByTestId('lock2-status')).toHaveAttribute('data-locked', 'true');

    // 2번째 인스턴스 해제 — 자신이 저장한 prev('hidden')를 복원하므로 여전히 hidden 유지
    await page.getByTestId('unlock2-btn').click();
    await expect(page.getByTestId('lock2-status')).toHaveAttribute('data-locked', 'false');
    expect(await getBodyOverflow(page)).toBe('hidden');

    // 1번째 인스턴스 해제 — 완전 복원 (prev-값 복원 의미론: ref-count로 바꾸면 이 단언이 red)
    await page.getByTestId('unlock-btn').click();
    await expect(page.getByTestId('lock-status')).toHaveAttribute('data-locked', 'false');
    expect(await getBodyOverflow(page)).toBe('');
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
