import { expect, test } from '@playwright/test';
import {
  getRefreshCount,
  gotoPtrTab,
  pullWithTouchAndSyntheticPointer,
  waitForState,
} from '../fixtures/pull-to-refresh';

/**
 * G4 골든 — touch + 합성 pointer 이중처리 방어 (B-10 / Sprint 5 T-04).
 *
 * 실 iOS는 하나의 손가락 제스처에 대해 TouchEvent와 (touch에서 합성된) PointerEvent를
 * 모두 발화한다. `activeSource` 가드 + 소스 승계(pull-to-refresh.ts 216-231)가 회귀하면
 * 두 소스가 같은 제스처를 각각 release해 onRefresh가 2회 발화한다 — 이 스펙은
 * 데모 계측 readout(`row-refresh-count-value`)으로 "정확히 1회"를 고정한다.
 *
 * TouchEvent 구성은 픽스처가 엔진별로 처리 (Chromium 실 생성자 / WebKit fallback) — skip 없음.
 */

test.describe('PullToRefresh · touch + synthetic pointer', () => {
  test('@golden touch+합성 pointer 풀 시퀀스 → onRefresh 정확히 1회', async ({ page }) => {
    await gotoPtrTab(page);

    expect(await getRefreshCount(page)).toBe(0);

    await pullWithTouchAndSyntheticPointer(page, 150);

    // 트리비얼 통과 방지: refreshing 진입을 먼저 확인한 뒤 idle 복귀를 기다린다
    await waitForState(page, 'refreshing');
    await waitForState(page, 'idle', 10000);

    // activeSource 가드 회귀 시 touch·pointer가 각각 release → 2가 되어 실패
    expect(await getRefreshCount(page)).toBe(1);
    await expect(page.getByText(/Refreshed at/)).toHaveCount(1);
  });
});
