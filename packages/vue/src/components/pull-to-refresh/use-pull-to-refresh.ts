import { onMounted, onUnmounted, ref, type Ref } from 'vue';
import { createPullToRefresh } from '@wvkit/core';
import type {
  PullToRefreshInstance,
  PullToRefreshOptions,
  PullToRefreshState,
} from '@wvkit/core';

/**
 * Vue 3 어댑터 — core `createPullToRefresh`를 감싸는 컴포저블.
 *
 * 사용 패턴:
 * ```vue
 * <script setup>
 * const { containerRef, state, distance, progress, trigger } = usePullToRefresh({
 *   onRefresh: async () => { await fetchData(); },
 * });
 * </script>
 * <template>
 *   <div ref="containerRef" style="overflow-y: auto; height: 400px">{...}</div>
 * </template>
 * ```
 *
 * 규칙 (useScrollContainer #7 패턴 그대로):
 *  - SSR 안전: `createPullToRefresh`는 `onMounted` 안에서만 호출
 *  - 사용자 콜백 wrap: state ref 갱신 + 사용자 콜백 호출 (Vue 클로저는 재호출되지 않으므로
 *    React와 달리 stale closure 이슈 없음 — options는 setup 시점에 고정)
 *  - destroy 멱등성에 의존해 HMR/언마운트 안전 (#18에서 보장)
 */
export function usePullToRefresh(options: PullToRefreshOptions): {
  containerRef: Ref<HTMLElement | null>;
  state: Ref<PullToRefreshState>;
  distance: Ref<number>;
  progress: Ref<number>;
  trigger: () => Promise<void>;
  setEnabled: (enabled: boolean) => void;
} {
  const containerRef = ref<HTMLElement | null>(null);
  const state = ref<PullToRefreshState>('idle');
  const distance = ref<number>(0);
  const progress = ref<number>(0);

  let instance: PullToRefreshInstance | null = null;

  onMounted(() => {
    if (!containerRef.value) return;

    // 사용자 콜백 wrap: Vue ref 갱신 + 사용자 콜백 호출
    const wrappedOptions: PullToRefreshOptions = {
      ...options,
      // onRefresh는 wrap 불필요 — options 클로저가 setup 시점 고정이라 stale 없음
      onRefresh: () => options.onRefresh(),
      onStateChange: (s) => {
        state.value = s;
        options.onStateChange?.(s);
      },
      onPull: (d, p) => {
        distance.value = d;
        progress.value = p;
        options.onPull?.(d, p);
      },
    };

    instance = createPullToRefresh(containerRef.value, wrappedOptions);
    // core가 정규화한 초기 상태 반영
    state.value = instance.getState();
  });

  onUnmounted(() => {
    instance?.destroy();
    instance = null;
  });

  function trigger(): Promise<void> {
    return instance?.trigger() ?? Promise.resolve();
  }

  function setEnabled(enabled: boolean): void {
    instance?.setEnabled(enabled);
  }

  return { containerRef, state, distance, progress, trigger, setEnabled };
}
