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

/** 캔버스의 렌더러 DOM(첫 자식)을 window 에 기억해 두고, 나중에 같은 요소인지 비교한다 (다시 마운트 여부) */
async function rememberRenderer(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(() => {
    (window as unknown as { __renderer?: Element | null }).__renderer = document.querySelector(
      '[data-testid="sc-canvas"]',
    )?.firstElementChild;
  });
}
async function sameRenderer(page: import('@playwright/test').Page): Promise<boolean> {
  return page.evaluate(
    () =>
      document.querySelector('[data-testid="sc-canvas"]')?.firstElementChild ===
      (window as unknown as { __renderer?: Element | null }).__renderer,
  );
}

test.describe('ScrollContainer · S7 options change (no remount)', () => {
  test('direction 을 바꿔도 다시 마운트하지 않는다 — 렌더러 DOM 유지, 패널 교체, 같은 번호 자리', async ({
    page,
  }) => {
    await gotoDemo(page);
    await clickScrollTo(page, 2, false);
    await expect(page.getByTestId('row-activeIndex-value')).toHaveText('2');
    await rememberRenderer(page);

    await page.getByTestId('ctl-direction').selectOption('vertical');

    await expect(page.getByTestId('row-direction-value')).toHaveText('vertical');
    // 가로 피드 패널이 세로 카드 패널로 바뀌었다 — 보던 패널이 없어져 같은 번호(2) 자리의 카드로
    await expect(page.getByTestId('row-activeIndex-value')).toHaveText('2');
    expect(await sameRenderer(page)).toBe(true);
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

  // 숨긴(display:none) 패널의 스크롤 위치는 브라우저가 지킨다 — 라이브러리는 저장·복원하지 않는다.
  // CI 는 chromium · webkit · mobile-safari · mobile-chrome 에서 돈다 (문서의 WebKit 확인 근거).
  test('창 밖으로 나가 숨겨졌다가 돌아온 패널의 스크롤 위치가 그대로다', async ({ page }) => {
    await gotoDemo(page);
    const panel0 = (fn: string) =>
      page.evaluate((f) => {
        const p = document.querySelector('[data-panel-index="0"]') as HTMLElement | null;
        if (!p) return null;
        if (f === 'display') return getComputedStyle(p).display;
        return p.scrollTop;
      }, fn);
    await page.evaluate(() => {
      const p = document.querySelector('[data-panel-index="0"]') as HTMLElement | null;
      if (p) p.scrollTop = 400;
    });
    expect(await panel0('scrollTop')).toBe(400);

    await clickScrollTo(page, 5, false);
    await expect(page.getByTestId('row-activeIndex-value')).toHaveText('5');
    expect(await panel0('display')).toBe('none'); // 창 밖 → 숨김

    await clickScrollTo(page, 0, false);
    await expect(page.getByTestId('row-activeIndex-value')).toHaveText('0');
    await expect.poll(() => panel0('scrollTop')).toBe(400);
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

    // pull-to-refresh 탭으로 이동 — PTR 데모 마운트 완료 신호 대기 (B-23: 고정 대기 대체)
    await page.getByTestId('tab-pull-to-refresh').click();
    await page.getByTestId('ptr-container').waitFor();

    // scroll-container 탭으로 복귀 (B-23: 텍스트 정규식 → testid)
    await page.getByTestId('tab-scroll-container').click();

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

test.describe('ScrollContainer · S21 패널 추가·삭제 (setPanels)', () => {
  const box = (page: import('@playwright/test').Page, sel: string) =>
    page.locator(sel).boundingBox();

  test('앞에 추가하면 보던 패널이 제자리에 그대로 있고 activeIndex 만 하나 는다', async ({
    page,
  }) => {
    await gotoDemo(page);
    await page.getByTestId('sc-canvas').scrollIntoViewIfNeeded();
    const before = await box(page, '[data-panel-index="0"]');
    expect(before).not.toBeNull();
    await rememberRenderer(page);

    await page.getByTestId('btn-add-first').click();

    await expect(page.getByTestId('row-activeIndex-value')).toHaveText('1');
    await expect(page.getByTestId('row-panels-value')).toHaveText('7');
    const after = await box(page, '[data-panel-index="0"]');
    expect(after?.x ?? 0).toBeCloseTo(before?.x ?? -1, 0);
    expect(await sameRenderer(page)).toBe(true);
  });

  test('패널을 추가·삭제하고 옵션을 바꿔도 남은 패널의 스크롤 위치가 그대로다', async ({
    page,
  }) => {
    await gotoDemo(page);
    const scrollTop = () =>
      page.evaluate(
        () =>
          (document.querySelector('[data-panel-index="0"]') as HTMLElement | null)?.scrollTop ?? -1,
      );
    await page.evaluate(() => {
      const p = document.querySelector('[data-panel-index="0"]') as HTMLElement | null;
      if (p) p.scrollTop = 400;
    });
    expect(await scrollTop()).toBe(400);

    await page.getByTestId('btn-add-last').click();
    await expect(page.getByTestId('row-panels-value')).toHaveText('7');
    expect(await scrollTop()).toBe(400);

    await page.getByTestId('ctl-gap').fill('8'); // setOptions({ gap: 8 })
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (document.querySelector('[data-panel-index="1"]') as HTMLElement | null)?.style
              .transform ?? '',
        ),
      )
      .toContain('px, 0px)');
    expect(await scrollTop()).toBe(400);
  });

  test('지금 패널을 지우면 같은 번호 자리의 패널이 보인다', async ({ page }) => {
    await gotoDemo(page);
    await clickScrollTo(page, 2, false);
    await page.getByTestId('btn-remove-current').click();
    await expect(page.getByTestId('row-panels-value')).toHaveText('5');
    await expect(page.getByTestId('row-activeIndex-value')).toHaveText('2');
    // 원래 3번 패널이 2번 자리 — 화면 가운데(캔버스 안)에 있다
    const canvas = await box(page, '[data-testid="sc-canvas"]');
    const p3 = await box(page, '[data-panel-index="3"]');
    expect(p3).not.toBeNull();
    expect(Math.abs((p3?.x ?? 0) - (canvas?.x ?? 0))).toBeLessThan(2);
    expect(await page.locator('[data-panel-index="2"]').count()).toBe(0);
  });
});
