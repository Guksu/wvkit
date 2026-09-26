import {
  type MaybeRefOrGetter,
  onMounted,
  onUnmounted,
  ref,
  type Ref,
  toRaw,
  toValue,
  watch,
} from 'vue';
import { createScrollContainer } from '@guksu/wvkit-core/scroll-container';
import type {
  ScrollContainerInstance,
  ScrollContainerOptions,
  ScrollContainerOptionsUpdate,
} from '@guksu/wvkit-core/scroll-container';

/** setOptions 로 넘기지 않는 키 — 콜백은 부를 때마다 최신 옵션에서 읽고, initialIndex 는 마운트 때만 쓴다 */
const SKIP_KEYS = new Set([
  'onIndexChange',
  'onZoomChange',
  'onPanelVisibilityChange',
  'initialIndex',
]);

/**
 * 옵션을 보통 객체로 읽는다 — reactive 프록시를 벗기고 패널 배열도 복사한다 (core 에 프록시를 넘기지 않게).
 * getter·ref 안의 값을 읽으므로 watch 의 소스로 쓰면 바뀐 키를 추적한다.
 */
function snapshot(options: MaybeRefOrGetter<ScrollContainerOptions>): ScrollContainerOptions {
  const o = toValue(options);
  return { ...toRaw(o), panels: [...o.panels].map((p) => toRaw(p)) };
}

/**
 * 이전에 적용한 옵션과 비교해 바뀐 키만 모은다. 패널 배열은 요소를 하나씩, 나머지는 `Object.is`.
 * 같은 결과를 내는 새 함수는 core 가 배치 결과를 비교해 아무 일도 하지 않는다.
 */
export function diffScrollContainerOptions(
  prev: ScrollContainerOptions,
  next: ScrollContainerOptions,
): ScrollContainerOptionsUpdate | null {
  const update: Record<string, unknown> = {};
  let changed = false;
  const a = prev as unknown as Record<string, unknown>;
  const b = next as unknown as Record<string, unknown>;
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (SKIP_KEYS.has(key)) continue;
    const same =
      key === 'panels'
        ? prev.panels.length === next.panels.length &&
          prev.panels.every((p, i) => p === next.panels[i])
        : Object.is(a[key], b[key]);
    if (!same) {
      update[key] = b[key];
      changed = true;
    }
  }
  return changed ? (update as ScrollContainerOptionsUpdate) : null;
}

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
 *  - `options` 는 보통 객체·`reactive` 객체·`ref`·getter 를 모두 받는다 (`toValue`). 반응형이면 값이 바뀔 때
 *    다시 마운트하지 않고 `setOptions` 로 바뀐 키만 넘긴다. 보통 객체면 마운트 때 값으로 고정된다.
 *  - 사용자 콜백 wrap: state ref 갱신 + 사용자 콜백 호출 (부를 때마다 최신 옵션의 콜백)
 *  - `initialIndex` 는 마운트 때만 쓴다
 *  - destroy 멱등성에 의존해 HMR/언마운트 안전 (#4에서 보장)
 */
export function useScrollContainer(options: MaybeRefOrGetter<ScrollContainerOptions>): {
  containerRef: Ref<HTMLElement | null>;
  activeIndex: Ref<number>;
  activeZoom: Ref<number>;
  scrollTo: (index: number, opts?: { animated?: boolean }) => void;
  zoomTo: (level: number, opts?: { animated?: boolean }) => void;
} {
  const containerRef = ref<HTMLElement | null>(null);
  const activeIndex = ref<number>(toValue(options).initialIndex ?? 0);
  const activeZoom = ref<number>(1);

  let instance: ScrollContainerInstance | null = null;
  /** 인스턴스에 마지막으로 적용한 옵션 */
  let applied: ScrollContainerOptions | null = null;

  onMounted(() => {
    if (!containerRef.value) return;
    const initOpts = snapshot(options);

    // 사용자 콜백 wrap: Vue ref 갱신 + 사용자 콜백 호출 (최신 옵션에서 읽는다)
    const wrappedOptions: ScrollContainerOptions = {
      ...initOpts,
      onIndexChange: (index) => {
        activeIndex.value = index;
        toValue(options).onIndexChange?.(index);
      },
      onZoomChange: (zoom) => {
        activeZoom.value = zoom;
        toValue(options).onZoomChange?.(zoom);
      },
      onPanelVisibilityChange: (index, visible, panel) =>
        toValue(options).onPanelVisibilityChange?.(index, visible, panel),
    };

    instance = createScrollContainer(containerRef.value, wrappedOptions);
    applied = initOpts;
    // core가 클램프/정규화한 초기 값으로 ref 동기화
    activeIndex.value = instance.getActiveIndex();
    activeZoom.value = instance.getZoom();
  });

  // 반응형 옵션이 바뀌면 바뀐 키만 setOptions (보통 객체면 추적할 것이 없어 한 번도 돌지 않는다)
  watch(
    () => snapshot(options),
    (next) => {
      if (!instance || !applied) return;
      const update = diffScrollContainerOptions(applied, next);
      applied = next;
      if (update) instance.setOptions(update);
    },
  );

  onUnmounted(() => {
    instance?.destroy();
    instance = null;
    applied = null;
  });

  function scrollTo(index: number, opts?: { animated?: boolean }): void {
    instance?.scrollTo(index, opts);
  }

  function zoomTo(level: number, opts?: { animated?: boolean }): void {
    instance?.zoomTo(level, opts);
  }

  return { containerRef, activeIndex, activeZoom, scrollTo, zoomTo };
}
