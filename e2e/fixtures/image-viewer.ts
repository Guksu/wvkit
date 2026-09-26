import type { Page } from '@playwright/test';

/**
 * 문서 레시피 "이미지 뷰어" 예제 페이지 (examples/*-example/recipes/image-viewer/*.html).
 * 페이지는 레시피 파일을 그대로 띄운다 — 문서가 같은 파일을 코드 블록으로 가져온다.
 */
export const IMAGE_VIEWER_PAGES = [
  { name: 'vanilla', url: '/wvkit/recipes/image-viewer/vanilla.html' },
  { name: 'react', url: '/wvkit/recipes/image-viewer/react.html' },
  // Vue 예제는 playwright.config 의 두 번째 webServer (4174)
  { name: 'vue', url: 'http://localhost:4174/wvkit/vue/recipes/image-viewer/vue.html' },
] as const;

const PAGER = '[aria-label="Photos"]';

/** 사진 요청을 순서대로 기록한다 (photo-N.svg 의 N). goto 전에 호출. */
export function recordPhotoRequests(page: Page): number[] {
  const requested: number[] = [];
  page.on('request', (req) => {
    const m = req.url().match(/\/photo-(\d+)\.svg/);
    if (m) requested.push(Number(m[1]));
  });
  return requested;
}

/** 화면에 보이는 번호 ("2 / 6") */
export function countText(page: Page): Promise<string | null> {
  return page.locator('.image-viewer-count').textContent();
}

/** scene transform 의 scale — 카메라 줌 (scene 은 슬라이드들의 부모) */
export async function sceneZoom(page: Page): Promise<number> {
  return page.evaluate((pager) => {
    const slide = document.querySelector(`${pager} [aria-roledescription="slide"]`);
    const tf = (slide?.parentElement as HTMLElement | null)?.style.transform ?? '';
    const m = tf.match(/scale\(([-\d.e]+)\)/);
    return m ? Number.parseFloat(m[1] ?? '1') : 1;
  }, PAGER);
}

/** n 번째(1부터) 사진 슬라이드의 화면 위치 — 페이저 기준 left, 페이저 폭 */
export async function slideLeft(page: Page, n: number): Promise<{ left: number; width: number }> {
  return page.evaluate(
    ([pager, n]) => {
      const host = document.querySelector(pager as string) as HTMLElement;
      const slide = host.querySelector(`[aria-label="${n} / 6"]`) as HTMLElement;
      const h = host.getBoundingClientRect();
      return { left: slide.getBoundingClientRect().left - h.left, width: h.width };
    },
    [PAGER, n] as const,
  );
}

/** 페이저 가운데에서 한 손가락으로 가로로 끈다 (마지막에 멈췄다가 놓아 관성 없이). */
export async function drag(page: Page, dx: number): Promise<void> {
  await page.evaluate(
    async ([pager, dx]) => {
      const el = document.querySelector(pager as string) as HTMLElement;
      const r = el.getBoundingClientRect();
      const x0 = r.left + r.width / 2;
      const y0 = r.top + r.height / 2;
      const send = (type: string, x: number, buttons: number) =>
        el.dispatchEvent(
          new PointerEvent(type, {
            pointerId: 1,
            pointerType: 'touch',
            isPrimary: true,
            clientX: x,
            clientY: y0,
            buttons,
            bubbles: true,
            cancelable: true,
          }),
        );
      const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
      send('pointerdown', x0, 1);
      const steps = 12;
      for (let i = 1; i <= steps; i++) {
        send('pointermove', x0 + ((dx as number) * i) / steps, 1);
        await wait(20);
      }
      await wait(120);
      send('pointermove', x0 + (dx as number), 1); // 멈춤 → 릴리스 속도 0
      send('pointerup', x0 + (dx as number), 0);
    },
    [PAGER, dx] as const,
  );
}

/** 페이저 가운데를 두 번 톡톡 친다 (더블탭 줌). */
export async function doubleTap(page: Page): Promise<void> {
  await page.evaluate(async (pager) => {
    const el = document.querySelector(pager) as HTMLElement;
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const send = (type: string, buttons: number) =>
      el.dispatchEvent(
        new PointerEvent(type, {
          pointerId: 1,
          pointerType: 'touch',
          isPrimary: true,
          clientX: x,
          clientY: y,
          buttons,
          bubbles: true,
          cancelable: true,
        }),
      );
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
    send('pointerdown', 1);
    await wait(40);
    send('pointerup', 0);
    await wait(80);
    send('pointerdown', 1);
    await wait(40);
    send('pointerup', 0);
  }, PAGER);
}
