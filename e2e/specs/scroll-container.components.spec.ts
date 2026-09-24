import { expect, test } from '@playwright/test';
import { gotoDemo, swipeOnElement } from '../fixtures/scroll-container';

/**
 * S22 — 컴포넌트 API (<ScrollContainer> + <ScrollPanel>) 데모.
 * 패널 내용은 포털로 core 가 배치하는 패널 요소 안에 그려진다. 실제 브라우저에서 순서·추가·스크롤 위치·제스처를 본다.
 */

const CANVAS = '[data-testid="cmp-canvas"]';
const indexValue = (page: import('@playwright/test').Page) =>
  page.getByTestId('row-componentIndex-value');

/** 패널 id 의 화면 x (캔버스 기준) */
async function panelX(page: import('@playwright/test').Page, id: number): Promise<number> {
  return page.evaluate(
    ([sel, pid]) => {
      const canvas = document.querySelector(sel as string) as HTMLElement;
      const inner = canvas.querySelector(`[data-cmp-panel="${pid}"]`) as HTMLElement;
      return inner.getBoundingClientRect().left - canvas.getBoundingClientRect().left;
    },
    [CANVAS, id],
  );
}

test.describe('ScrollContainer · S22 컴포넌트 API (ScrollContainer + ScrollPanel)', () => {
  test('자식 순서대로 패널이 놓이고, 앞에 추가하면 보던 패널이 제자리에 남는다', async ({
    page,
  }) => {
    await gotoDemo(page);
    await page.locator(CANVAS).scrollIntoViewIfNeeded();
    const x1 = await panelX(page, 1);
    const x2 = await panelX(page, 2);
    expect(x2).toBeGreaterThan(x1); // 2 가 1 의 오른쪽

    await page.getByTestId('cmp-add-first').click();
    await expect(indexValue(page)).toHaveText('1');
    await expect(page.getByTestId('row-componentPanels-value')).toHaveText('4');
    expect(await panelX(page, 1)).toBeCloseTo(x1, 0);
    expect(await panelX(page, 4)).toBeLessThan(x1); // 새 패널(4)은 왼쪽
  });

  test('패널을 추가·삭제해도 남은 패널의 스크롤 위치가 그대로다', async ({ page }) => {
    await gotoDemo(page);
    const scrollTop = () =>
      page.evaluate(
        (sel) =>
          (document.querySelector(`${sel} [data-cmp-panel="1"]`) as HTMLElement | null)
            ?.scrollTop ?? -1,
        CANVAS,
      );
    await page.evaluate((sel) => {
      const el = document.querySelector(`${sel} [data-cmp-panel="1"]`) as HTMLElement | null;
      if (el) el.scrollTop = 300;
    }, CANVAS);
    expect(await scrollTop()).toBe(300);

    await page.getByTestId('cmp-add-first').click();
    await expect(page.getByTestId('row-componentPanels-value')).toHaveText('4');
    expect(await scrollTop()).toBe(300);

    await page.getByTestId('cmp-remove-last').click();
    await expect(page.getByTestId('row-componentPanels-value')).toHaveText('3');
    expect(await scrollTop()).toBe(300);
  });

  test('포털로 그린 내용 위에서 스와이프하면 다음 패널 · ref 핸들 scrollTo', async ({ page }) => {
    await gotoDemo(page);
    await page.locator(CANVAS).scrollIntoViewIfNeeded();
    await swipeOnElement(page, `${CANVAS} [data-cmp-panel="1"]`, -200);
    await expect(indexValue(page)).toHaveText('1');

    await page.getByTestId('cmp-next').click();
    await expect(indexValue(page)).toHaveText('2');
  });
});
