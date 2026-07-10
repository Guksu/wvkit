import { expect, test } from '@playwright/test';
import {
  displayInput,
  getHiddenValue,
  gotoStableInputTab,
  hiddenInput,
  installVisualViewportStub,
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

  // G2 골든: suppressLayoutShift의 존재 이유 — 키보드 등장(VP resize)에도 레이아웃이 튀지 않는다.
  test('@golden suppressLayoutShift: VP resize 중 display input 위치·스크롤·포커스 불변', async ({
    page,
  }) => {
    await installVisualViewportStub(page);
    await gotoStableInputTab(page);

    const di = displayInput(page);

    // focus() 버튼으로 포커스 — display input에 data-focused가 반영될 때까지 폴링
    await page.getByTestId('stable-input-focus').click();
    await expect(di).toHaveAttribute('data-focused', 'true');

    // 기준선은 포커스 안정화 이후에 기록 — 검증 대상 계약은 "VP resize 전후" 위치 불변
    // (mobile-chrome에서 탭/포커스 자체의 미세 스크롤이 resize와 무관하게 섞이는 것을 배제)
    const top0 = await di.evaluate((el) => el.getBoundingClientRect().top);
    const scrollY0 = await page.evaluate(() => window.scrollY);
    const value0 = await di.inputValue();

    // 키보드 등장 시뮬: VP height 축소 + resize dispatch.
    // suppressLayoutShift 계약은 "overflow 0이면 무보정" — 인풋 컨테이너가 뷰포트 하단에
    // 가까운 프로젝트(mobile-safari)에서도 전제가 유지되도록 컨테이너 bottom 아래로는
    // 줄이지 않는다 (기본은 −320).
    await page.evaluate(() => {
      const container = document.querySelector(
        '[data-testid="stable-input-display"] > div',
      ) as HTMLElement | null;
      if (!container) throw new Error('stable-input container not found');
      const bottom = container.getBoundingClientRect().bottom;
      const target = Math.max(window.innerHeight - 320, Math.ceil(bottom) + 24);
      (window as unknown as { __vvStub: { setHeight(h: number): void } }).__vvStub.setHeight(
        target,
      );
    });

    // 데모 인풋은 뷰포트 상단 → overflow 0 → 보정 스크롤 없어야 함 (negative-space)
    const top1 = await di.evaluate((el) => el.getBoundingClientRect().top);
    expect(Math.abs(top1 - top0)).toBeLessThanOrEqual(0.5);
    const scrollY1 = await page.evaluate(() => window.scrollY);
    expect(Math.abs(scrollY1 - scrollY0)).toBeLessThanOrEqual(0.5);
    await expect(di).toHaveAttribute('data-focused', 'true');
    await expect(di).toHaveValue(value0);
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
