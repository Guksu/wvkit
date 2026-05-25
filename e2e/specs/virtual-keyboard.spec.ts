import { expect, test } from '@playwright/test';

/**
 * VirtualKeyboard 훅은 visualViewport.resize/scroll 이벤트를 듣고 baseHeight(마운트 시점) 와의
 * delta로 키보드 상태를 추론한다. 실제 키보드를 열 수 없으므로 visualViewport.height를 강제로
 * 줄이고 resize 이벤트를 직접 발화해 검증한다.
 *
 * 데스크탑 브라우저는 visualViewport 동작이 다르고 의미상 키보드 개념이 없으므로 mobile 프로젝트로 한정.
 */
test.describe('VirtualKeyboard (mobile-only)', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      !/mobile/.test(testInfo.project.name),
      'mobile-safari / mobile-chrome 에서만 실행',
    );
  });

  async function goto(page: import('@playwright/test').Page): Promise<void> {
    await page.goto('/');
    await page.getByTestId('tab-virtual-keyboard').click();
    await page.getByTestId('row-isOpen-value').waitFor();
  }

  test('초기 상태: isOpen=false, keyboardHeight=0px', async ({ page }) => {
    await goto(page);

    await expect(page.getByTestId('row-isOpen-value')).toHaveText('false');
    await expect(page.getByTestId('row-keyboardHeight-value')).toHaveText('0px');
  });

  test('visualViewport.height가 threshold(100px) 이상 줄어들면 isOpen=true & height>0', async ({ page }) => {
    await goto(page);

    // baseHeight를 300px 줄여서 resize 발화 — 임계값(100)을 충분히 넘김
    await page.evaluate(() => {
      const vp = window.visualViewport;
      if (!vp) throw new Error('visualViewport not available');
      const orig = vp.height;
      // defineProperty로 getter override (configurable해야 함)
      Object.defineProperty(vp, 'height', {
        configurable: true,
        get: () => orig - 300,
      });
      vp.dispatchEvent(new Event('resize'));
    });

    await expect(page.getByTestId('row-isOpen-value')).toHaveText('true');
    const heightText = await page.getByTestId('row-keyboardHeight-value').textContent();
    const h = Number.parseInt(heightText ?? '0', 10);
    expect(h).toBeGreaterThanOrEqual(100);
  });

  test('viewport 복원 시 isOpen=false로 돌아간다', async ({ page }) => {
    await goto(page);

    // 1. 키보드 열림 시뮬레이션
    await page.evaluate(() => {
      const vp = window.visualViewport;
      if (!vp) throw new Error('visualViewport not available');
      const orig = vp.height;
      (window as unknown as { __vpOrig?: number }).__vpOrig = orig;
      Object.defineProperty(vp, 'height', {
        configurable: true,
        get: () => orig - 300,
      });
      vp.dispatchEvent(new Event('resize'));
    });
    await expect(page.getByTestId('row-isOpen-value')).toHaveText('true');

    // 2. height 원복 → resize 재발화
    await page.evaluate(() => {
      const vp = window.visualViewport;
      if (!vp) throw new Error('visualViewport not available');
      const orig = (window as unknown as { __vpOrig?: number }).__vpOrig;
      if (orig == null) throw new Error('__vpOrig missing');
      Object.defineProperty(vp, 'height', {
        configurable: true,
        get: () => orig,
      });
      vp.dispatchEvent(new Event('resize'));
    });

    await expect(page.getByTestId('row-isOpen-value')).toHaveText('false');
    await expect(page.getByTestId('row-keyboardHeight-value')).toHaveText('0px');
  });

  test('threshold 이하 변화(<100px)는 isOpen 변화 없음', async ({ page }) => {
    await goto(page);

    await page.evaluate(() => {
      const vp = window.visualViewport;
      if (!vp) throw new Error('visualViewport not available');
      const orig = vp.height;
      Object.defineProperty(vp, 'height', {
        configurable: true,
        get: () => orig - 50, // threshold 100보다 작음
      });
      vp.dispatchEvent(new Event('resize'));
    });

    await expect(page.getByTestId('row-isOpen-value')).toHaveText('false');
    await expect(page.getByTestId('row-keyboardHeight-value')).toHaveText('0px');
  });
});
