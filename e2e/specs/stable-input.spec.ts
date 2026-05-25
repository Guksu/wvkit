import { expect, test } from '@playwright/test';
import {
  displayInput,
  getHiddenValue,
  gotoStableInputTab,
  hiddenInput,
  isHiddenFocused,
  typeIntoHidden,
} from '../fixtures/stable-input';

test.describe('StableInput', () => {
  test('마운트: display + hidden 두 input이 모두 존재한다', async ({ page }) => {
    await gotoStableInputTab(page);

    await expect(displayInput(page)).toHaveCount(1);
    await expect(hiddenInput(page)).toHaveCount(1);
  });

  test('display input은 readonly + tabindex=-1', async ({ page }) => {
    await gotoStableInputTab(page);

    const di = displayInput(page);
    await expect(di).toHaveAttribute('readonly', '');
    await expect(di).toHaveAttribute('tabindex', '-1');
  });

  test('hidden input은 화면 밖에 배치 + aria-label = placeholder', async ({ page }) => {
    await gotoStableInputTab(page);

    const placeholder = await displayInput(page).getAttribute('placeholder');
    expect(placeholder).toBeTruthy();
    await expect(hiddenInput(page)).toHaveAttribute('aria-label', placeholder!);
  });

  test('hidden에 값 입력 시 display value가 동기화된다', async ({ page }) => {
    await gotoStableInputTab(page);

    await typeIntoHidden(page, 'sync-test');

    await expect(displayInput(page)).toHaveValue('sync-test');
    expect(await getHiddenValue(page)).toBe('sync-test');

    // 데모의 별도 readout(value: ...)에도 반영
    await expect(page.getByTestId('stable-input-value')).toContainText('sync-test');
  });

  test('focus() 버튼 클릭 시 hidden input이 포커스된다', async ({ page }) => {
    await gotoStableInputTab(page);

    await page.getByTestId('stable-input-focus').click();
    // focus 라우팅이 micro-task에서 일어날 수 있어 짧게 폴링
    await expect.poll(async () => isHiddenFocused(page)).toBe(true);
  });

  test('setValue() 버튼 클릭 시 display와 hidden이 모두 갱신된다', async ({ page }) => {
    await gotoStableInputTab(page);

    await page.getByTestId('stable-input-set').click();

    await expect(displayInput(page)).toHaveValue('Hello, WebView!');
    expect(await getHiddenValue(page)).toBe('Hello, WebView!');
  });

  test('탭 전환 시 hidden input이 body에서 제거된다 (destroy 멱등성)', async ({ page }) => {
    await gotoStableInputTab(page);
    await expect(hiddenInput(page)).toHaveCount(1);

    // 다른 탭으로 이동 → 컴포넌트 언마운트
    await page.getByTestId('tab-safe-area').click();
    await page.getByTestId('row-top-value').waitFor();

    await expect(hiddenInput(page)).toHaveCount(0);
  });
});
