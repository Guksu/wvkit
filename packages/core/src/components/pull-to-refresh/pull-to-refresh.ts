import { WebviewHeadlessError } from '../../errors';
import type {
  PullToRefreshInstance,
  PullToRefreshOptions,
  PullToRefreshState,
} from './types';
import { applyResistance, easeOutCubic } from './utils';

/**
 * WebView/iOS Safari에서 네이티브 느낌의 당김 새로고침 (헤드리스).
 *
 * 결정사항 (D1~D6):
 *  - D1: 부착 대상은 HTMLElement만
 *  - D2: 헤드리스 정통 — 콜백만 제공, 인디케이터 헬퍼 없음
 *  - D3: `overscroll-behavior: contain` 자동 적용 (opt-out 가능)
 *  - D4: `onRefresh: () => Promise<void> | void`
 *  - D5: ScrollContainer와 독립
 *  - D6: onRefresh 에러는 console.error + idle 복귀 (별도 'error' state 없음)
 *
 * 입력 소스: TouchEvent(모바일 우선) + PointerEvent(데스크톱/테스트 fallback).
 * 동시 활성 가드(`activeSource !== null`)로 두 소스가 같은 제스처를 중복 처리하지 않음.
 */

const RESET_DURATION_MS = 200;

export function createPullToRefresh(
  root: HTMLElement,
  options: PullToRefreshOptions,
): PullToRefreshInstance {
  validateOptions(options);

  // --- 옵션 정규화 (SSR/실 환경 공통) ---
  const threshold = options.threshold ?? 60;
  const maxDistance = options.maxDistance ?? 120;
  const resistance = options.resistance ?? 0.5;
  let enabled = options.enabled ?? true;
  const disableOverscrollContain = options.disableOverscrollContain ?? false;

  let state: PullToRefreshState = 'idle';

  // --- SSR 가드 ---
  if (typeof window === 'undefined') {
    return {
      destroy: () => {},
      getState: () => 'idle',
      trigger: () => Promise.resolve(),
      setEnabled: () => {},
    };
  }

  // --- 제스처 추적 ---
  let activeGestureId: number | null = null;
  let activeSource: 'touch' | 'pointer' | null = null;
  /** 활성 pointer 제스처가 touch에서 합성된 것인지 (touchstart로의 소스 승계 판단용) */
  let activePointerIsTouch = false;
  let startClientY: number | null = null;
  let currentDistance = 0;

  // --- 트윈/RAF ---
  let rafId: number | null = null;
  let currentRefreshPromise: Promise<void> | null = null;
  let destroyed = false;

  // --- 리스너 일괄 등록/해제 ---
  type ListenerRec = {
    el: EventTarget;
    type: string;
    handler: EventListener;
    options?: AddEventListenerOptions;
  };
  const listeners: ListenerRec[] = [];

  function addListener(
    el: EventTarget,
    type: string,
    handler: EventListener,
    opts?: AddEventListenerOptions,
  ): void {
    el.addEventListener(type, handler, opts);
    if (opts !== undefined) {
      listeners.push({ el, type, handler, options: opts });
    } else {
      listeners.push({ el, type, handler });
    }
  }

  // --- overscroll-behavior 자동 적용 (D3) ---
  const prevOverscrollBehavior = root.style.overscrollBehavior;
  if (!disableOverscrollContain) {
    // 레이아웃 필수 인라인 스타일 (CLAUDE.md 예외 — #24에서 코드 컨벤션에 명시 추가).
    root.style.overscrollBehavior = 'contain';
  }

  // --- 상태 전이 헬퍼 (중복 호출 방지) ---
  function setState(next: PullToRefreshState): void {
    if (next === state) return;
    state = next;
    options.onStateChange?.(state);
  }

  function notifyPull(distance: number): void {
    currentDistance = distance;
    const progress = threshold > 0 ? distance / threshold : 0;
    options.onPull?.(distance, progress);
  }

  function updateDistance(rawDelta: number): void {
    const dist = applyResistance(rawDelta, maxDistance, resistance);
    notifyPull(dist);
    if (state === 'pulling' && dist >= threshold) setState('armed');
    else if (state === 'armed' && dist < threshold) setState('pulling');
  }

  // --- 제스처 시작/종료 ---
  function tryStart(clientY: number, gestureId: number, source: 'touch' | 'pointer'): boolean {
    if (destroyed) return false;
    if (!enabled) return false;
    if (state !== 'idle') return false;
    if (root.scrollTop > 0) return false;
    // 진행 중 reset 트윈이 있으면 즉시 취소 — 사용자가 다시 당기기 시작한 것
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    activeGestureId = gestureId;
    activeSource = source;
    startClientY = clientY;
    currentDistance = 0;
    setState('pulling');
    return true;
  }

  function clearGesture(): void {
    activeGestureId = null;
    activeSource = null;
    activePointerIsTouch = false;
    startClientY = null;
  }

  function handleRelease(): void {
    const wasArmed = state === 'armed';
    clearGesture();
    if (wasArmed) {
      void runRefresh();
    } else if (state === 'pulling') {
      void startResetTween();
    }
    // state === 'refreshing' (외부에서 trigger됨) 또는 'resetting' (이미 트윈 중) 이면 그대로 둠
  }

  // --- reset 트윈 (RAF + easeOutCubic 200ms, distance → 0) ---
  function startResetTween(): Promise<void> {
    return new Promise<void>((resolve) => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      if (state === 'pulling' || state === 'armed') {
        setState('resetting');
      }
      // 트윈 시작점 capture
      const startTime = performance.now();
      const startDist = currentDistance;
      const step = (): void => {
        if (destroyed) {
          rafId = null;
          resolve();
          return;
        }
        const elapsed = performance.now() - startTime;
        const t = Math.min(1, elapsed / RESET_DURATION_MS);
        const k = easeOutCubic(t);
        notifyPull(startDist * (1 - k));
        if (t < 1) {
          rafId = requestAnimationFrame(step);
        } else {
          rafId = null;
          notifyPull(0);
          if (state === 'resetting') setState('idle');
          resolve();
        }
      };
      rafId = requestAnimationFrame(step);
    });
  }

  // --- 새로고침 실행 (D4 + D6) ---
  // 일반 함수로 정의 (async function이 아님) — 두 호출자가 같은 Promise 인스턴스를 받도록.
  // async function이면 inner Promise를 outer Promise로 다시 wrap해 매 호출마다 새 Promise가 됨.
  function runRefresh(): Promise<void> {
    if (destroyed) return Promise.resolve();
    // 동시 호출 차단: 이미 진행 중이면 같은 Promise 반환
    if (currentRefreshPromise) return currentRefreshPromise;

    setState('refreshing');
    const promise = (async () => {
      try {
        const result = options.onRefresh();
        if (result instanceof Promise) await result;
      } catch (err) {
        // D6: 에러 swallow + console.error + idle 복귀
        console.error('[wvkit] PullToRefresh onRefresh error:', err);
      } finally {
        if (!destroyed) {
          setState('resetting');
          await startResetTween();
        }
        currentRefreshPromise = null;
      }
    })();
    currentRefreshPromise = promise;
    return promise;
  }

  // --- TouchEvent 핸들러 (passive: false on touchmove) ---
  function onTouchStart(ev: Event): void {
    const tev = ev as TouchEvent;
    if (tev.touches.length !== 1) return;
    const touch = tev.touches.item(0);
    if (!touch) return;
    // 실기기에서는 pointerdown이 touchstart보다 먼저 발화해 pointer 소스가 제스처를 선점한다.
    // touch에서 합성된 pointer 제스처면 touch 소스로 승계 — 이후 touchmove의 preventDefault가
    // 동작해야 pulling 중 native scroll이 차단된다.
    if (activeSource === 'pointer' && activePointerIsTouch) {
      activeSource = 'touch';
      activeGestureId = touch.identifier;
      return;
    }
    if (activeSource !== null) return;
    tryStart(touch.clientY, touch.identifier, 'touch');
  }

  function onTouchMove(ev: Event): void {
    const tev = ev as TouchEvent;
    if (activeSource !== 'touch') return;
    if (startClientY === null) return;
    // activeGestureId가 일치하는 touch 찾기
    let touch: Touch | null = null;
    for (let i = 0; i < tev.touches.length; i++) {
      const t = tev.touches.item(i);
      if (t && t.identifier === activeGestureId) {
        touch = t;
        break;
      }
    }
    if (!touch) return;
    if (state !== 'pulling' && state !== 'armed') return;
    const rawDelta = touch.clientY - startClientY;
    if (rawDelta > 0) {
      // pulling 동안 native scroll 차단
      tev.preventDefault();
      updateDistance(rawDelta);
    } else {
      // 시작점 위로 당김 — distance를 0으로 고정 (pulling 상태는 유지)
      updateDistance(0);
    }
  }

  function onTouchEnd(ev: Event): void {
    const tev = ev as TouchEvent;
    if (activeSource !== 'touch') return;
    // 활성 제스처의 touch가 끝났는지 확인 — changedTouches로 확인
    let ended = false;
    for (let i = 0; i < tev.changedTouches.length; i++) {
      const t = tev.changedTouches.item(i);
      if (t && t.identifier === activeGestureId) {
        ended = true;
        break;
      }
    }
    if (!ended) return;
    handleRelease();
  }

  // --- PointerEvent 핸들러 (데스크톱/테스트 fallback) ---
  function onPointerDown(ev: Event): void {
    const pev = ev as PointerEvent;
    // touch가 이미 활성화돼 있으면 pointer는 스킵 (touch에서 합성된 pointer 이중 처리 방지)
    if (activeSource !== null) return;
    if (tryStart(pev.clientY, pev.pointerId, 'pointer')) {
      activePointerIsTouch = pev.pointerType === 'touch';
      try {
        root.setPointerCapture(pev.pointerId);
      } catch {
        // happy-dom 등 일부 환경 미지원 — 무시
      }
    }
  }

  function onPointerMove(ev: Event): void {
    const pev = ev as PointerEvent;
    if (activeSource !== 'pointer' || pev.pointerId !== activeGestureId) return;
    if (startClientY === null) return;
    if (state !== 'pulling' && state !== 'armed') return;
    const rawDelta = pev.clientY - startClientY;
    if (rawDelta > 0) {
      updateDistance(rawDelta);
    } else {
      updateDistance(0);
    }
  }

  function onPointerEnd(ev: Event): void {
    const pev = ev as PointerEvent;
    if (activeSource !== 'pointer' || pev.pointerId !== activeGestureId) return;
    try {
      root.releasePointerCapture(pev.pointerId);
    } catch {
      // 무시
    }
    handleRelease();
  }

  // --- 리스너 등록 ---
  // touchmove는 passive: false 필수 (pulling 중 preventDefault 가능해야 함)
  addListener(root, 'touchstart', onTouchStart, { passive: true });
  addListener(root, 'touchmove', onTouchMove, { passive: false });
  addListener(root, 'touchend', onTouchEnd);
  addListener(root, 'touchcancel', onTouchEnd);
  addListener(root, 'pointerdown', onPointerDown);
  addListener(root, 'pointermove', onPointerMove);
  addListener(root, 'pointerup', onPointerEnd);
  addListener(root, 'pointercancel', onPointerEnd);

  // --- 공개 메서드 ---
  function destroy(): void {
    if (destroyed) return;
    destroyed = true;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    for (const { el, type, handler, options: opts } of listeners) {
      el.removeEventListener(type, handler, opts);
    }
    listeners.length = 0;
    // overscroll-behavior 원래 값 복원
    root.style.overscrollBehavior = prevOverscrollBehavior;
    clearGesture();
    currentRefreshPromise = null;
  }

  function getState(): PullToRefreshState {
    return state;
  }

  function trigger(): Promise<void> {
    if (destroyed) return Promise.resolve();
    return runRefresh();
  }

  function setEnabled(next: boolean): void {
    enabled = next;
    // 진행 중 pull/refresh는 그대로 — 새 트리거만 차단
  }

  return {
    destroy,
    getState,
    trigger,
    setEnabled,
  };
}

/**
 * 옵션 검증 — 잘못된 값은 즉시 `WebviewHeadlessError`로 차단.
 * 정규화된 값(기본값 적용 후)으로 검증해 기본값도 함께 sanity check.
 */
function validateOptions(options: PullToRefreshOptions): void {
  const threshold = options.threshold ?? 60;
  const maxDistance = options.maxDistance ?? 120;
  const resistance = options.resistance ?? 0.5;

  if (threshold <= 0) {
    throw new WebviewHeadlessError(
      `PullToRefresh: threshold must be > 0 (got ${threshold})`,
    );
  }
  if (maxDistance < threshold) {
    throw new WebviewHeadlessError(
      `PullToRefresh: maxDistance (${maxDistance}) must be >= threshold (${threshold})`,
    );
  }
  if (resistance < 0 || resistance > 1) {
    throw new WebviewHeadlessError(
      `PullToRefresh: resistance must be in [0, 1] (got ${resistance})`,
    );
  }
}
