import type { Locator, Page } from '@playwright/test';

/**
 * StableInput 데모 탭으로 이동하고 display 컨테이너가 마운트될 때까지 대기.
 */
export async function gotoStableInputTab(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByTestId('tab-stable-input').click();
  await page.getByTestId('stable-input-display').waitFor();
}

/**
 * display 컨테이너 안에 core가 동적으로 만든 <input> 엘리먼트 (readonly + tabindex=-1).
 */
export function displayInput(page: Page): Locator {
  return page.getByTestId('stable-input-display').locator('input');
}

/**
 * body 직접 자식으로 부착된 hidden input — position:fixed; top:-9999px.
 * 다른 인풋과 구분하기 위해 style 조건으로 필터.
 */
export function hiddenInput(page: Page): Locator {
  return page.locator(
    'body > input',
  );
}

/**
 * hidden input의 현재 value (DOM 속성).
 */
export async function getHiddenValue(page: Page): Promise<string> {
  return await page.evaluate(() => {
    const i = document.querySelector(
      'body > input',
    ) as HTMLInputElement | null;
    return i?.value ?? '';
  });
}

/**
 * hidden input의 value를 프로그램적으로 세팅하고 input 이벤트를 발화 — 사용자의 키 입력 시뮬레이션.
 */
export async function typeIntoHidden(page: Page, text: string): Promise<void> {
  await page.evaluate((t) => {
    const i = document.querySelector(
      'body > input',
    ) as HTMLInputElement | null;
    if (!i) throw new Error('hidden input not found');
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )?.set;
    setter?.call(i, t);
    i.dispatchEvent(new Event('input', { bubbles: true }));
  }, text);
}

/**
 * 현재 document.activeElement가 hidden input인지.
 */
export async function isHiddenFocused(page: Page): Promise<boolean> {
  return await page.evaluate(() => {
    const i = document.querySelector(
      'body > input',
    );
    return i !== null && document.activeElement === i;
  });
}
