import { expect, test } from '@playwright/test';

async function gotoSafeAreaTab(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await page.getByTestId('tab-safe-area').click();
  await page.getByTestId('row-top-value').waitFor();
}

/**
 * `getComputedStyle`을 래핑해 SafeArea sentinel(safe-area.ts:12-26 — 인라인 padding에
 * `env(safe-area-inset-*)`를 쓰는 유일한 element)의 padding 4방향을 `window.__fakeInsets`에서
 * 읽어 반환한다. 반드시 `page.goto` 전에 호출 (mount 시 초기 readInsets부터 스텁 적용).
 */
async function installInsetStub(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript(() => {
    (window as unknown as { __fakeInsets: Record<string, string> }).__fakeInsets = {
      top: '0px',
      right: '0px',
      bottom: '0px',
      left: '0px',
    };
    const orig = window.getComputedStyle.bind(window);
    window.getComputedStyle = ((el: Element, pseudo?: string | null) => {
      const cs = orig(el, pseudo ?? undefined);
      const inline = (el as HTMLElement).style;
      if (inline?.paddingTop?.includes('env(safe-area-inset-top')) {
        return new Proxy(cs, {
          get(target, prop) {
            const fake = (window as unknown as { __fakeInsets: Record<string, string> })
              .__fakeInsets;
            if (prop === 'paddingTop') return fake.top;
            if (prop === 'paddingRight') return fake.right;
            if (prop === 'paddingBottom') return fake.bottom;
            if (prop === 'paddingLeft') return fake.left;
            const v = target[prop as keyof CSSStyleDeclaration];
            return typeof v === 'function' ? (v as () => unknown).bind(target) : v;
          },
        });
      }
      return cs;
    }) as typeof window.getComputedStyle;
  });
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

  // G3 골든: SafeArea의 존재 이유 — orientation 변경 시 inset을 재측정해 반응형으로 제공한다.
  test('@golden orientationchange 후 inset readout이 재측정된다', async ({ page }) => {
    await installInsetStub(page);
    await gotoSafeAreaTab(page);

    // 초기 스텁값 0px 확인 (mount 시 readInsets부터 스텁 경유)
    await expect(page.getByTestId('row-top-value')).toHaveText('0px');
    await expect(page.getByTestId('row-bottom-value')).toHaveText('0px');

    // 회전 시뮬: fake inset 교체 + orientationchange dispatch
    await page.evaluate(() => {
      (window as unknown as { __fakeInsets: Record<string, string> }).__fakeInsets = {
        top: '47px',
        right: '0px',
        bottom: '34px',
        left: '0px',
      };
      window.dispatchEvent(new Event('orientationchange'));
    });

    // 고정 대기 금지 — readout 갱신을 폴링 (orientationchange → readInsets → onChange → setInsets)
    await expect
      .poll(async () => await page.getByTestId('row-top-value').textContent(), {
        timeout: 3000,
      })
      .toBe('47px');
    await expect
      .poll(async () => await page.getByTestId('row-bottom-value').textContent(), {
        timeout: 3000,
      })
      .toBe('34px');
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
