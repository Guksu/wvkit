import { expect, test } from '@playwright/test';
import {
  getDistance,
  getOverscrollBehavior,
  getRefreshCount,
  getState,
  gotoPtrTab,
  pullOnContainer,
  setEnabled,
  setFailNext,
  waitForState,
} from '../fixtures/pull-to-refresh';

/**
 * PullToRefresh CLAUDE §5 계약 e2e (B-18 / T-06).
 *
 * 고정 대기(waitForTimeout) 금지 — waitForState / expect.poll만 사용.
 * PointerEvent 합성만 사용하므로 4개 프로젝트(chromium/webkit/mobile-*) 전부에서 skip 없음.
 * 수치 근거: threshold 60 / maxDistance 120 / resistance 0.5 (데모 기본값 = 라이브러리 기본값).
 */

const REFRESHED_ITEM = (page: import('@playwright/test').Page) =>
  page.locator('[data-testid="ptr-container"] > div').filter({ hasText: 'Refreshed' });

test.describe('PullToRefresh — contract', () => {
  test('contract — C1: enabled=false 당김 무시 + 재활성 후 정상 동작', async ({ page }) => {
    await gotoPtrTab(page);

    // 비활성 — 당김 동안·후 idle 유지, onRefresh 미발화
    await setEnabled(page, false);
    const handle = await pullOnContainer(page, 150, { hold: true });
    if (!handle) throw new Error('hold:true 인데 handle이 없음');
    expect(await getState(page)).toBe('idle');
    expect(await getDistance(page)).toBe(0);
    await handle.release();
    expect(await getState(page)).toBe('idle');
    expect(await getRefreshCount(page)).toBe(0);

    // 재활성 — 같은 제스처가 이제는 효력 있음 (토글의 양방향 증명)
    await setEnabled(page, true);
    await pullOnContainer(page, 150);
    await waitForState(page, 'refreshing');
    await waitForState(page, 'idle', 5000);
    expect(await getRefreshCount(page)).toBe(1);
  });

  test('contract — C2: onRefresh reject 시 console.error + idle 복귀 + 후속 정상', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await gotoPtrTab(page);
    await setFailNext(page);

    // 1차 당김 — onRefresh reject → console.error + idle 복귀, 리스트 항목 없음
    await pullOnContainer(page, 150);
    await expect.poll(() => getRefreshCount(page)).toBe(1);
    await waitForState(page, 'idle', 5000);
    await expect
      .poll(
        () =>
          consoleErrors.filter((e) => e.includes('[wvkit] PullToRefresh onRefresh error')).length,
      )
      .toBe(1);
    await expect(REFRESHED_ITEM(page)).toHaveCount(0);

    // 2차 당김 — 같은 인스턴스가 죽지 않고 정상 새로고침 (refreshing 경유 + 항목 1건)
    await pullOnContainer(page, 150);
    await waitForState(page, 'refreshing');
    await waitForState(page, 'idle', 5000);
    expect(await getRefreshCount(page)).toBe(2);
    await expect(REFRESHED_ITEM(page)).toHaveCount(1);
  });

  test('contract — C3: dy=600 hold 시 distance가 maxDistance(120) 정확값으로 cap', async ({
    page,
  }) => {
    await gotoPtrTab(page);

    // damped = min(raw / (1 + 0.5·raw/120), 120) — raw=600 ≥ 240이므로 정확히 120
    const handle = await pullOnContainer(page, 600, { hold: true });
    if (!handle) throw new Error('hold:true 인데 handle이 없음');
    await expect.poll(() => getDistance(page)).toBe(120);

    // 120 ≥ threshold(60) — armed였으므로 release 시 정상 refresh 완료
    await handle.release();
    await waitForState(page, 'refreshing');
    await waitForState(page, 'idle', 5000);
  });

  test('contract — C4: scrollTop>0이면 tryStart 거절 (idle 유지·distance 0·count 0)', async ({
    page,
  }) => {
    await gotoPtrTab(page);

    // 리스트 20항목 × ~40px > 높이 280px — 스크롤 가능 전제 성립
    await page.evaluate(() => {
      const el = document.querySelector('[data-testid="ptr-container"]') as HTMLElement | null;
      if (!el) throw new Error('ptr-container not found');
      el.scrollTop = 200;
    });

    const handle = await pullOnContainer(page, 150, { hold: true, scrollTopBefore: 200 });
    if (!handle) throw new Error('hold:true 인데 handle이 없음');
    expect(await getState(page)).toBe('idle');
    expect(await getDistance(page)).toBe(0);
    await handle.release();
    expect(await getState(page)).toBe('idle');
    expect(await getDistance(page)).toBe(0);
    expect(await getRefreshCount(page)).toBe(0);
  });

  test('contract — C5: overscroll-behavior 인라인 자동 적용(contain) / opt-out 시 미적용', async ({
    page,
  }) => {
    await gotoPtrTab(page);

    // 기본: 라이브러리가 el.style.overscrollBehavior = 'contain' 직접 기록
    expect(await getOverscrollBehavior(page)).toBe('contain');

    // opt-out 토글 — remountKey 경유 인스턴스 재생성이므로 poll로 새 컨테이너 반영 대기
    await page.getByTestId('ptr-overscroll-toggle').check();
    await page.getByTestId('ptr-container').waitFor();
    await expect.poll(() => getOverscrollBehavior(page)).toBe('');
  });
});
