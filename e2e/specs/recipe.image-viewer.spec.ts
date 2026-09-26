import { expect, test } from '@playwright/test';
import {
  IMAGE_VIEWER_PAGES,
  countText,
  doubleTap,
  drag,
  recordPhotoRequests,
  sceneZoom,
  slideLeft,
} from '../fixtures/image-viewer';

/**
 * 문서 레시피 "이미지 뷰어" — 바닐라·React·Vue 레시피 파일을 그대로 띄운 페이지에서, 문서가 약속하는
 * 동작(옆 사진만 미리 받기, 넘기면 번호 갱신, 줌한 채로 넘기면 새 사진은 1배)을 실제 브라우저로 확인한다.
 */
for (const { name, url } of IMAGE_VIEWER_PAGES) {
  test.describe(`레시피 · 이미지 뷰어 (${name})`, () => {
    test('처음에는 첫 사진과 옆 사진만 받는다', async ({ page }) => {
      const requested = recordPhotoRequests(page);
      await page.goto(url);
      await expect.poll(() => countText(page)).toBe('1 / 6');
      await expect.poll(() => [...new Set(requested)].sort()).toEqual([1, 2]);
      await page.waitForTimeout(300); // 늦게 오는 요청이 없는지
      expect([...new Set(requested)].sort()).toEqual([1, 2]);
    });

    test('넘기면 번호가 바뀌고, 그다음 사진을 미리 받는다', async ({ page }) => {
      const requested = recordPhotoRequests(page);
      await page.goto(url);
      await expect.poll(() => countText(page)).toBe('1 / 6');
      const { width } = await slideLeft(page, 1);

      await drag(page, -width * 0.6);
      await expect.poll(() => countText(page)).toBe('2 / 6');
      await expect.poll(async () => Math.round((await slideLeft(page, 2)).left)).toBe(0);
      await expect.poll(() => [...new Set(requested)].sort()).toEqual([1, 2, 3]);
    });

    test('줌한 채로 넘기면 새 사진은 1배로, 화면 가운데에서 시작한다', async ({ page }) => {
      await page.goto(url);
      await expect.poll(() => countText(page)).toBe('1 / 6');
      const { width } = await slideLeft(page, 1);

      await doubleTap(page);
      await expect.poll(() => sceneZoom(page)).toBeCloseTo(2.5, 2);

      // 2.5배에서 카메라는 손가락의 1/2.5 만큼 움직인다. 사진 1 의 오른쪽 끝까지 0.3 × 폭, 거기서 사진 2 의
      // 왼쪽 끝까지 0.4 × 폭 + gap. 1.15 × 폭을 끌면 끝을 0.16 × 폭 넘는다 — 그 사이의 30%(snapThreshold)는
      // 넘어 사진 2 로 가지만 절반은 안 돼, 놓는 순간 카메라는 아직 사진 1 에 더 가깝다.
      // 그래도 사진 2 가운데에 서야 한다 (zoomTo 가 카메라 근처가 아닌 활성 패널 기준이어야 한다).
      await drag(page, -width * 1.15);
      await expect.poll(() => countText(page)).toBe('2 / 6');
      await expect.poll(() => sceneZoom(page)).toBe(1);
      await expect.poll(async () => Math.round((await slideLeft(page, 2)).left)).toBe(0);
    });
  });
}
