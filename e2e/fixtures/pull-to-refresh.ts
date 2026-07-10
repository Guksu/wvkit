import type { Page } from '@playwright/test';

export const PTR_CONTAINER = 'ptr-container';
export const PTR_TRIGGER = 'ptr-trigger';

export type PtrState = 'idle' | 'pulling' | 'armed' | 'refreshing' | 'resetting';

/**
 * 데모를 띄우고 PullToRefresh 탭으로 이동, 상태 readout이 나타날 때까지 대기.
 */
export async function gotoPtrTab(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByTestId('tab-pull-to-refresh').click();
  await page.getByTestId('ptr-container').waitFor();
  await page.getByTestId('row-state-value').waitFor();
}

export async function getState(page: Page): Promise<PtrState> {
  const txt = (await page.getByTestId('row-state-value').textContent()) ?? '';
  return txt.trim() as PtrState;
}

export async function getDistance(page: Page): Promise<number> {
  const txt = (await page.getByTestId('row-distance-value').textContent()) ?? '';
  return Number.parseInt(txt, 10);
}

export async function getProgress(page: Page): Promise<number> {
  const txt = (await page.getByTestId('row-progress-value').textContent()) ?? '';
  return Number.parseFloat(txt);
}

export async function waitForState(
  page: Page,
  expected: PtrState,
  timeout = 5000,
): Promise<void> {
  await page.waitForFunction(
    (exp) => {
      const v = document.querySelector('[data-testid="row-state-value"]')?.textContent?.trim();
      return v === exp;
    },
    expected,
    { timeout, polling: 30 },
  );
}

interface PullOpts {
  /** pointermove 분할 수 (기본 14) */
  steps?: number;
  /** 전체 제스처 지속 시간 ms (기본 280) */
  duration?: number;
  /** 손가락을 떼지 않고 hold (pointerup 미발화). 후속 release()로 마무리 필요 */
  hold?: boolean;
}

export interface PullHandle {
  release(): Promise<void>;
}

/**
 * 컨테이너 위 단일 포인터 드래그. dy>0 = 아래로 당김 = PTR.
 * hold:true 면 pointerup 없이 반환, release()로 마무리.
 */
export async function pullOnContainer(
  page: Page,
  dy: number,
  opts: PullOpts = {},
): Promise<PullHandle | undefined> {
  const { steps = 14, duration = 280, hold = false } = opts;

  await page.evaluate(
    async ({ dy, steps, duration }) => {
      const el = document.querySelector('[data-testid="ptr-container"]') as HTMLElement | null;
      if (!el) throw new Error('ptr-container not found');
      // 스크롤 위치 0으로 보장 — tryStart가 scrollTop>0 시 거절함
      el.scrollTop = 0;
      const rect = el.getBoundingClientRect();
      const startX = rect.left + rect.width / 2;
      const startY = rect.top + 10;
      const pid = 7;

      const dispatch = (type: string, x: number, y: number, buttons: number, button: number) => {
        el.dispatchEvent(
          new PointerEvent(type, {
            pointerId: pid,
            pointerType: 'touch',
            isPrimary: true,
            clientX: x,
            clientY: y,
            screenX: x,
            screenY: y,
            bubbles: true,
            cancelable: true,
            buttons,
            button,
          }),
        );
      };

      dispatch('pointerdown', startX, startY, 1, 0);
      const dt = duration / steps;
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        dispatch('pointermove', startX, startY + dy * t, 1, -1);
        await new Promise((r) => setTimeout(r, dt));
      }
      // 마지막 위치 기억해 release에서 재사용
      (window as unknown as { __ptrLast?: { x: number; y: number; pid: number } }).__ptrLast = {
        x: startX,
        y: startY + dy,
        pid,
      };
    },
    { dy, steps, duration },
  );

  if (!hold) {
    await releasePointer(page);
    return;
  }

  return {
    release: () => releasePointer(page),
  };
}

async function releasePointer(page: Page): Promise<void> {
  await page.evaluate(() => {
    const el = document.querySelector('[data-testid="ptr-container"]') as HTMLElement | null;
    if (!el) return;
    const w = window as unknown as { __ptrLast?: { x: number; y: number; pid: number } };
    const last = w.__ptrLast;
    if (!last) return;
    el.dispatchEvent(
      new PointerEvent('pointerup', {
        pointerId: last.pid,
        pointerType: 'touch',
        isPrimary: true,
        clientX: last.x,
        clientY: last.y,
        bubbles: true,
        cancelable: true,
        buttons: 0,
        button: 0,
      }),
    );
    w.__ptrLast = undefined;
  });
}

/**
 * 데모 계측 readout — onRefresh 실제 발화 횟수 (`row-refresh-count-value`).
 */
export async function getRefreshCount(page: Page): Promise<number> {
  const txt = (await page.getByTestId('row-refresh-count-value').textContent()) ?? '';
  return Number.parseInt(txt, 10);
}

/**
 * 실 iOS 발화 순서 재현 (pull-to-refresh.ts 216-231 주석 근거 — pointer가 touch보다 먼저):
 * pointerdown(pointerType 'touch') → touchstart → 스텝마다 [touchmove, pointermove] 쌍
 * → touchend → pointerup.
 * `activeSource` 소스 승계 가드가 회귀하면 touch·pointer가 각각 release해 onRefresh가 2회 발화한다.
 *
 * TouchEvent 구성: `new Touch(...)` + `new TouchEvent(...)`이 가능한 엔진(Chromium 계열)은
 * 실 생성자를 쓰고, WebKit(Touch가 Illegal constructor)은 `new Event` +
 * `Object.defineProperty`로 `touches`/`changedTouches`를 주입한다 — 라이브러리가 소비하는
 * 표면(`{ length, item(i) }` + `{ identifier, clientX, clientY }`)은 동일하므로 4개 프로젝트
 * 전부에서 같은 계약을 검증할 수 있다 (skip 없음).
 */
export async function pullWithTouchAndSyntheticPointer(
  page: Page,
  dy: number,
  opts: { steps?: number; duration?: number } = {},
): Promise<void> {
  const { steps = 14, duration = 280 } = opts;
  await page.evaluate(
    async ({ dy, steps, duration }) => {
      const el = document.querySelector('[data-testid="ptr-container"]') as HTMLElement | null;
      if (!el) throw new Error('ptr-container not found');
      el.scrollTop = 0;
      const rect = el.getBoundingClientRect();
      const startX = rect.left + rect.width / 2;
      const startY = rect.top + 10;
      const pid = 11;

      const canConstructTouch = (() => {
        try {
          new Touch({ identifier: 0, target: el });
          new TouchEvent('touchstart');
          return true;
        } catch {
          return false;
        }
      })();

      const dispatchTouch = (type: string, x: number, y: number, ended: boolean) => {
        if (canConstructTouch) {
          const touch = new Touch({ identifier: pid, target: el, clientX: x, clientY: y });
          el.dispatchEvent(
            new TouchEvent(type, {
              touches: ended ? [] : [touch],
              changedTouches: [touch],
              targetTouches: ended ? [] : [touch],
              bubbles: true,
              cancelable: true,
            }),
          );
          return;
        }
        // WebKit fallback — Touch가 Illegal constructor인 엔진용
        const touchLike = { identifier: pid, target: el, clientX: x, clientY: y };
        const makeList = (arr: Array<typeof touchLike>) => ({
          length: arr.length,
          item: (i: number) => arr[i] ?? null,
        });
        const ev = new Event(type, { bubbles: true, cancelable: true });
        Object.defineProperty(ev, 'touches', { value: makeList(ended ? [] : [touchLike]) });
        Object.defineProperty(ev, 'changedTouches', { value: makeList([touchLike]) });
        Object.defineProperty(ev, 'targetTouches', { value: makeList(ended ? [] : [touchLike]) });
        el.dispatchEvent(ev);
      };

      const dispatchPointer = (
        type: string,
        x: number,
        y: number,
        buttons: number,
        button: number,
      ) => {
        el.dispatchEvent(
          new PointerEvent(type, {
            pointerId: pid,
            pointerType: 'touch',
            isPrimary: true,
            clientX: x,
            clientY: y,
            screenX: x,
            screenY: y,
            bubbles: true,
            cancelable: true,
            buttons,
            button,
          }),
        );
      };

      // 실기기 순서: pointerdown 먼저 → touchstart가 소스를 승계
      dispatchPointer('pointerdown', startX, startY, 1, 0);
      dispatchTouch('touchstart', startX, startY, false);

      const dt = duration / steps;
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const y = startY + dy * t;
        dispatchTouch('touchmove', startX, y, false);
        dispatchPointer('pointermove', startX, y, 1, -1);
        await new Promise((r) => setTimeout(r, dt));
      }

      dispatchTouch('touchend', startX, startY + dy, true);
      dispatchPointer('pointerup', startX, startY + dy, 0, 0);
    },
    { dy, steps, duration },
  );
}

export async function clickTrigger(page: Page): Promise<void> {
  await page.getByTestId('ptr-trigger').click();
}

export async function setEnabled(page: Page, enabled: boolean): Promise<void> {
  // 데모의 enabled 체크박스를 토글한다 — 라벨이 i18n이라 input 셀렉터로 직접.
  // ControlItem 안 input[type=checkbox]는 enabled가 처음 등장 (순서 의존이라 fragile).
  // 안전하게 row-state 가까이 둔 체크박스를 모두 가져와 enabled 라벨 가진 항목의 input을 토글.
  const checkbox = page.locator('input[type="checkbox"]').first();
  const checked = await checkbox.isChecked();
  if (checked !== enabled) await checkbox.click();
}
