import { onMounted, onUnmounted, ref, type Ref } from 'vue';
import { createScrollContainer } from '@wvkit/core';
import type { ScrollContainerInstance, ScrollContainerOptions } from '@wvkit/core';

/**
 * Vue 3 어댑터 — core `createScrollContainer`를 감싸는 컴포저블.
 *
 * 사용 패턴:
 * ```vue
 * <script setup>
 * const { containerRef, activeIndex, activeZoom, scrollTo, zoomTo } =
 *   useScrollContainer({ direction: 'horizontal', panels });
 * </script>
 * <template>
 *   <div ref="containerRef" style="position: relative; width: 400px; height: 600px" />
 * </template>
 * ```
 *
 * 규칙:
 *  - SSR 안전: `createScrollContainer`는 `onMounted` 안에서만 호출
 *  - 사용자 콜백 wrap: state ref 갱신 + 사용자 콜백 호출 (Vue 클로저는 재호출되지 않으므로
 *    React와 달리 stale closure 이슈 없음 — options는 setup 시점에 고정)
 *  - destroy 멱등성에 의존해 HMR/언마운트 안전 (#4에서 보장)
 */
export function useScrollContainer(options: ScrollContainerOptions): {
  containerRef: Ref<HTMLElement | null>;
  activeIndex: Ref<number>;
  activeZoom: Ref<number>;
  scrollTo: (index: number, opts?: { animated?: boolean }) => void;
  zoomTo: (level: number, opts?: { animated?: boolean }) => void;
} {
  const containerRef = ref<HTMLElement | null>(null);
  const activeIndex = ref<number>(options.initialIndex ?? 0);
  const activeZoom = ref<number>(1);

  let instance: ScrollContainerInstance | null = null;

  onMounted(() => {
    if (!containerRef.value) return;

    // 사용자 콜백 wrap: Vue ref 갱신 + 사용자 콜백 호출
    const wrappedOptions: ScrollContainerOptions = {
      ...options,
      onIndexChange: (index) => {
        activeIndex.value = index;
        options.onIndexChange?.(index);
      },
      onZoomChange: (zoom) => {
        activeZoom.value = zoom;
        options.onZoomChange?.(zoom);
      },
    };

    instance = createScrollContainer(containerRef.value, wrappedOptions);
    // core가 클램프/정규화한 초기 값으로 ref 동기화
    activeIndex.value = instance.getActiveIndex();
    activeZoom.value = instance.getZoom();
  });

  onUnmounted(() => {
    instance?.destroy();
    instance = null;
  });

  function scrollTo(index: number, opts?: { animated?: boolean }): void {
    instance?.scrollTo(index, opts);
  }

  function zoomTo(level: number, opts?: { animated?: boolean }): void {
    instance?.zoomTo(level, opts);
  }

  return { containerRef, activeIndex, activeZoom, scrollTo, zoomTo };
}
