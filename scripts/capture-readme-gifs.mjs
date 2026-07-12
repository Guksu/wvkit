/**
 * README 히어로 GIF 캡처 — Playwright(iPhone 에뮬레이션)로 데모를 실제 제스처로 구동하며
 * 영상을 녹화하고, 산출된 webm을 ffmpeg/gifski로 GIF 변환한다 (변환은 셸에서 수행).
 *
 * 사용:
 *   1) pnpm --filter @wvkit/react-example build && pnpm --filter @wvkit/react-example preview --port 4173
 *   2) node scripts/capture-readme-gifs.mjs
 *   3) scripts/gif-out/*.webm → ffmpeg/gifski 변환 (README의 docs/assets/*.gif)
 *
 * 주의: 에뮬레이션 데모 화면이다(실기기 아님). 실기기 캡처를 확보하면 교체한다.
 */
import { webkit, devices } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { rename } from 'node:fs/promises';

const BASE = process.env.DEMO_URL ?? 'http://localhost:4173/wvkit/';
const OUT = new URL('./gif-out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const iphone = devices['iPhone 14 Pro'];

/** 캔버스 요소 위 단일 포인터 드래그 (e2e/fixtures/scroll-container.ts의 swipeOnCanvas 축약판) */
async function swipe(page, testid, dx, dy, { steps = 20, duration = 420 } = {}) {
  await page.evaluate(
    async ({ testid, dx, dy, steps, duration }) => {
      const el = document.querySelector(`[data-testid="${testid}"]`);
      if (!el) throw new Error(`${testid} not found`);
      const rect = el.getBoundingClientRect();
      const sx = rect.left + rect.width / 2;
      const sy = rect.top + rect.height / 2;
      const fire = (type, x, y, buttons, button) =>
        el.dispatchEvent(
          new PointerEvent(type, {
            pointerId: 1, pointerType: 'touch', isPrimary: true,
            clientX: x, clientY: y, screenX: x, screenY: y,
            bubbles: true, cancelable: true, buttons, button,
          }),
        );
      fire('pointerdown', sx, sy, 1, 0);
      const dt = duration / steps;
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        fire('pointermove', sx + dx * t, sy + dy * t, 1, -1);
        await new Promise((r) => setTimeout(r, dt));
      }
      fire('pointerup', sx + dx, sy + dy, 0, 0);
    },
    { testid, dx, dy, steps, duration },
  );
}

/** 두 손가락 핀치 (pinchOnCanvas 축약판) */
async function pinch(page, testid, startGap, endGap, { steps = 20, duration = 480 } = {}) {
  await page.evaluate(
    async ({ testid, startGap, endGap, steps, duration }) => {
      const el = document.querySelector(`[data-testid="${testid}"]`);
      if (!el) throw new Error(`${testid} not found`);
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const fire = (pid, type, x, y, buttons, button, isPrimary) =>
        el.dispatchEvent(
          new PointerEvent(type, {
            pointerId: pid, pointerType: 'touch', isPrimary,
            clientX: x, clientY: y, screenX: x, screenY: y,
            bubbles: true, cancelable: true, buttons, button,
          }),
        );
      fire(1, 'pointerdown', cx - startGap / 2, cy, 1, 0, true);
      fire(2, 'pointerdown', cx + startGap / 2, cy, 1, 0, false);
      const dt = duration / steps;
      for (let i = 1; i <= steps; i++) {
        const g = startGap + (endGap - startGap) * (i / steps);
        fire(1, 'pointermove', cx - g / 2, cy, 1, -1, true);
        fire(2, 'pointermove', cx + g / 2, cy, 1, -1, false);
        await new Promise((r) => setTimeout(r, dt));
      }
      fire(1, 'pointerup', cx - endGap / 2, cy, 0, 0, true);
      fire(2, 'pointerup', cx + endGap / 2, cy, 0, 0, false);
    },
    { testid, startGap, endGap, steps, duration },
  );
}

async function record(name, run) {
  const browser = await webkit.launch();
  const ctx = await browser.newContext({
    ...iphone,
    viewport: { width: 393, height: 700 }, // 데드존 최소화 — 인터랙션 영역 중심 프레이밍
    hasTouch: true,
    recordVideo: { dir: OUT, size: { width: 393, height: 700 } },
  });
  const page = await ctx.newPage();
  await page.goto(BASE);
  await page.getByTestId('row-activeIndex-value').waitFor({ timeout: 15000 });
  await page.waitForTimeout(600); // 첫 렌더 안정화 (녹화 도입부)
  await run(page);
  await page.waitForTimeout(700); // 마무리 프레임
  const video = page.video();
  await ctx.close();
  const path = await video.path();
  await rename(path, `${OUT}${name}.webm`);
  await browser.close();
  console.log(`captured: ${name}.webm`);
}

// 1) ScrollContainer — 스와이프 스냅 전환 + 엣지 저항 + 핀치 줌
await record('scroll-container', async (page) => {
  await page.getByTestId('sc-canvas').scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await swipe(page, 'sc-canvas', -260, 0); // 0 → 1
  await page.waitForTimeout(650);
  await swipe(page, 'sc-canvas', -260, 0); // 1 → 2
  await page.waitForTimeout(650);
  await swipe(page, 'sc-canvas', 260, 0); // 2 → 1 (복귀)
  await page.waitForTimeout(650);
  await pinch(page, 'sc-canvas', 90, 240); // 줌인
  await page.waitForTimeout(600);
  await pinch(page, 'sc-canvas', 240, 90); // 줌아웃
  await page.waitForTimeout(500);
});

// 2) PullToRefresh — 당김 → armed → 새로고침 → 복귀
await record('pull-to-refresh', async (page) => {
  await page.getByTestId('tab-pull-to-refresh').click();
  await page.getByTestId('ptr-container').waitFor();
  await page.getByTestId('ptr-container').scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await swipe(page, 'ptr-container', 0, 150, { steps: 26, duration: 900 });
  await page.waitForTimeout(2200); // refreshing → idle 복귀 관찰
  await swipe(page, 'ptr-container', 0, 60, { steps: 14, duration: 380 }); // 미달 당김 — 복원
  await page.waitForTimeout(900);
});

// 3) StableInput — 탭 → 한글 타이핑(디스플레이 인풋 미러링) → Enter 제출
await record('stable-input', async (page) => {
  await page.getByTestId('tab-stable-input').click();
  await page.waitForTimeout(600);
  const display = page.locator('input[readonly]').first();
  await display.tap();
  await page.waitForTimeout(400);
  await page.keyboard.type('안녕하세요 wvkit!', { delay: 90 });
  await page.waitForTimeout(500);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(900);
});

console.log('done — 변환: ffmpeg palettegen 또는 gifski (README용 360px 폭 권장)');
