import { test, expect, type ConsoleMessage } from '@playwright/test';
import {
  gotoDemo,
  getActiveIndex,
  getVisiblePanelIndices,
  clickScrollTo,
} from '../fixtures/scroll-container';

async function setRangeSlider(page: import('@playwright/test').Page, idx: number, value: string) {
  await page
    .locator('input[type="range"]')
    .nth(idx)
    .evaluate((el, v) => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )?.set;
      setter?.call(el, v);
      (el as HTMLInputElement).dispatchEvent(new Event('input', { bubbles: true }));
      (el as HTMLInputElement).dispatchEvent(new Event('change', { bubbles: true }));
    }, value);
}

test.describe('ScrollContainer · S7 options remount', () => {
  test('direction 변경 시 컴포넌트 리마운트 + activeIndex 0 리셋', async ({ page }) => {
    await gotoDemo(page);
    await clickScrollTo(page, 2, false);
    await expect(page.getByTestId('row-activeIndex-value')).toHaveText('2');

    await page.locator('select').first().selectOption('vertical');

    await expect(page.getByTestId('row-activeIndex-value')).toHaveText('0');
    await expect(page.getByTestId('row-direction-value')).toHaveText('vertical');
  });

  test('overscan 변경 시 가시 패널 윈도 폭 변동', async ({ page }) => {
    await gotoDemo(page);
    expect(await getVisiblePanelIndices(page)).toEqual([0, 1]);

    // overscan slider (range[0]) = 3 → 보이는 패널 [0,1,2,3]
    await setRangeSlider(page, 0, '3');

    await expect
      .poll(async () => (await getVisiblePanelIndices(page)).length, {
        message: 'overscan=3 expands visible window',
        timeout: 3000,
      })
      .toBeGreaterThan(2);

    expect(await getVisiblePanelIndices(page)).toEqual([0, 1, 2, 3]);
  });
});

test.describe('ScrollContainer · S8 virtualization', () => {
  test('activeIndex=0, overscan=1 → 패널 2~5는 가상화로 hidden', async ({ page }) => {
    await gotoDemo(page);
    const visible = await getVisiblePanelIndices(page);
    expect(visible).toEqual([0, 1]);
    expect(visible).not.toContain(2);
    expect(visible).not.toContain(5);
  });

  test('scrollTo(2) 후 가시 패널이 [1,2,3]로 시프트', async ({ page }) => {
    await gotoDemo(page);
    await clickScrollTo(page, 2, false);
    await expect(page.getByTestId('row-activeIndex-value')).toHaveText('2');
    expect(await getVisiblePanelIndices(page)).toEqual([1, 2, 3]);
  });

  test('scrollTo(5) — 마지막 패널, 우측 overscan 잘려서 [4,5]만 노출', async ({ page }) => {
    await gotoDemo(page);
    await clickScrollTo(page, 5, false);
    await expect(page.getByTestId('row-activeIndex-value')).toHaveText('5');
    expect(await getVisiblePanelIndices(page)).toEqual([4, 5]);
  });

  test('overscan=0 — 활성 패널 1개만 노출', async ({ page }) => {
    await gotoDemo(page);
    await setRangeSlider(page, 0, '0');

    await expect(page.getByTestId('row-activeIndex-value')).toHaveText('0');
    await expect
      .poll(async () => (await getVisiblePanelIndices(page)).length, {
        timeout: 3000,
      })
      .toBe(1);
    expect(await getVisiblePanelIndices(page)).toEqual([0]);
  });
});

test.describe('ScrollContainer · S10 cleanup', () => {
  test('다른 탭으로 이동 후 돌아와도 정상 마운트, 콘솔 에러 없음', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg: ConsoleMessage) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await gotoDemo(page);
    expect(await getActiveIndex(page)).toBe(0);

    // pull-to-refresh 탭으로 이동
    await page.getByRole('button', { name: /Pull/i }).first().click();
    await page.waitForTimeout(150);

    // scroll-container 탭으로 복귀 — 'Scroll' 텍스트 시작 버튼 (탭 활성 버튼)
    await page
      .getByRole('button', { name: /ScrollContainer|스크롤/i })
      .first()
      .click();

    // 데모 다시 마운트
    await page.getByTestId('row-activeIndex-value').waitFor();
    expect(await getActiveIndex(page)).toBe(0);
    expect(await getVisiblePanelIndices(page)).toEqual([0, 1]);

    expect(consoleErrors, `unexpected errors:\n${consoleErrors.join('\n')}`).toEqual([]);
  });

  test('전체 페이지 reload 후 깔끔히 재초기화', async ({ page }) => {
    await gotoDemo(page);
    await clickScrollTo(page, 2, false);
    await expect(page.getByTestId('row-activeIndex-value')).toHaveText('2');

    await page.reload();
    await page.getByTestId('row-activeIndex-value').waitFor();
    expect(await getActiveIndex(page)).toBe(0);
  });
});
