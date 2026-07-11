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

  test('TC-24-03: resize 없이 scroll 이벤트만으로도 키보드 상태가 갱신된다', async ({ page }) => {
    await goto(page);

    // virtual-keyboard.ts:56-58 — vv에 resize와 scroll 양쪽 리스너 등록. scroll 경로만 발화.
    await page.evaluate(() => {
      const vp = window.visualViewport;
      if (!vp) throw new Error('visualViewport not available');
      const orig = vp.height;
      Object.defineProperty(vp, 'height', {
        configurable: true,
        get: () => orig - 300,
      });
      vp.dispatchEvent(new Event('scroll'));
    });

    await expect(page.getByTestId('row-isOpen-value')).toHaveText('true');
    const heightText = await page.getByTestId('row-keyboardHeight-value').textContent();
    expect(Number.parseInt(heightText ?? '0', 10)).toBeGreaterThanOrEqual(100);
  });

  test('TC-24-04: 탭 이탈(언마운트) 시 등록한 resize/scroll 리스너가 전부 해제된다', async ({ page }) => {
    type VvCount = { add: Record<string, number>; remove: Record<string, number> };

    // VisualViewport.prototype 래핑 — 페이지 로드 전에 설치해야 마운트 시점 등록을 관측한다
    await page.addInitScript(() => {
      const counts = { add: {} as Record<string, number>, remove: {} as Record<string, number> };
      (window as unknown as { __vvCount: typeof counts }).__vvCount = counts;
      const proto = (
        window as unknown as { VisualViewport?: { prototype: EventTarget } }
      ).VisualViewport?.prototype;
      if (!proto) return;
      const origAdd = proto.addEventListener;
      const origRemove = proto.removeEventListener;
      proto.addEventListener = function (type: string, ...rest: unknown[]) {
        counts.add[type] = (counts.add[type] ?? 0) + 1;
        return (origAdd as (...args: unknown[]) => void).call(this, type, ...rest);
      } as typeof proto.addEventListener;
      proto.removeEventListener = function (type: string, ...rest: unknown[]) {
        counts.remove[type] = (counts.remove[type] ?? 0) + 1;
        return (origRemove as (...args: unknown[]) => void).call(this, type, ...rest);
      } as typeof proto.removeEventListener;
    });

    const readCounts = () =>
      page.evaluate(
        () => JSON.parse(JSON.stringify((window as unknown as { __vvCount: unknown }).__vvCount)) as VvCount,
      );

    await page.goto('/');
    await page.getByTestId('tab-virtual-keyboard').waitFor();
    // VK 탭 진입 직전 스냅샷 — 다른 visualViewport 소비자(StableInput 등)와의 간섭을 델타 비교로 차단
    const before = await readCounts();

    await page.getByTestId('tab-virtual-keyboard').click();
    await page.getByTestId('row-isOpen-value').waitFor();
    const afterMount = await readCounts();

    const addDelta = (c: VvCount, type: string) => (c.add[type] ?? 0) - (before.add[type] ?? 0);
    // 마운트가 실제로 리스너를 등록했다 — 아래 델타 일치 단언이 공허해지지 않게
    expect(addDelta(afterMount, 'resize')).toBeGreaterThanOrEqual(1);
    expect(addDelta(afterMount, 'scroll')).toBeGreaterThanOrEqual(1);

    // 다른 탭으로 이탈 → VK 데모 언마운트 (destroy)
    await page.getByTestId('tab-safe-area').click();
    await page.getByTestId('row-top-value').waitFor();

    // add 델타 === remove 델타 (타입별) — 해제 누락도 과잉 해제도 없다
    await expect
      .poll(
        async () => {
          const now = await readCounts();
          return (['resize', 'scroll'] as const).every(
            (type) =>
              (now.remove[type] ?? 0) - (before.remove[type] ?? 0) === addDelta(now, type),
          );
        },
        { timeout: 3000, message: 'vv listener add/remove deltas converge per type' },
      )
      .toBe(true);
  });
});
