import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { createScrollContainer } from '@guksu/wvkit-core/scroll-container';
import type {
  ScrollContainerInstance,
  ScrollContainerOptions,
  ScrollContainerOptionsUpdate,
} from '@guksu/wvkit-core/scroll-container';

/** setOptions 로 넘기지 않는 키 — 콜백은 ref 로 최신값을 부르고, initialIndex 는 마운트 때만 쓴다 */
const SKIP_KEYS = new Set([
  'onIndexChange',
  'onZoomChange',
  'onPanelVisibilityChange',
  'initialIndex',
]);

/**
 * 이전에 적용한 옵션과 비교해 바뀐 키만 모은다. 패널 배열은 요소를 하나씩 비교한다 (매 렌더 새 배열이어도
 * 같은 요소면 바뀌지 않은 것). 나머지는 `Object.is`. 같은 결과를 내는 새 함수(인라인 panelHeight 등)는
 * 여기서는 바뀐 것으로 넘어가지만, core 가 배치 결과를 비교해 아무 일도 하지 않는다.
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
 * React 어댑터 — core `createScrollContainer`를 감싸는 훅.
 *
 * 사용 패턴:
 * ```tsx
 * const { containerRef, activeIndex, activeZoom, scrollTo, zoomTo } =
 *   useScrollContainer({ direction: 'horizontal', panels });
 * return <div ref={containerRef} style={{ position: 'relative' }} />;
 * ```
 *
 * 규칙:
 *  - SSR 안전: `createScrollContainer`는 `useEffect` 안에서만 호출
 *  - options ref 패턴: 매 렌더 options 객체가 새로 만들어져도 인스턴스 재생성 없음
 *  - 사용자 콜백(onIndexChange/onZoomChange)은 ref로 받아 stale closure 회피
 *  - non-callback 옵션(`panels`/`direction`/`minZoom` 등)이 바뀌면 다시 마운트하지 않고
 *    `setOptions` 로 넘긴다 (바뀐 키만). 패널 배열은 요소 단위로 비교하므로 매 렌더 새 배열이어도 된다.
 *    `initialIndex` 는 마운트 때만 쓴다
 *  - 명령형 메서드(scrollTo/zoomTo)는 `useCallback`으로 안정화, instance 마운트 전 호출은 noop
 */
export function useScrollContainer(options: ScrollContainerOptions): {
  containerRef: RefObject<HTMLDivElement>;
  activeIndex: number;
  activeZoom: number;
  scrollTo: (index: number, opts?: { animated?: boolean }) => void;
  zoomTo: (level: number, opts?: { animated?: boolean }) => void;
} {
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<ScrollContainerInstance | null>(null);

  // 매 렌더의 최신 options를 ref로 보관 — effect 내부 초기화는 1회만 수행
  const optionsRef = useRef(options);
  /** 인스턴스에 마지막으로 적용한 옵션 — 다음 렌더와 비교해 바뀐 것만 setOptions 로 넘긴다 */
  const appliedRef = useRef<ScrollContainerOptions | null>(null);
  useEffect(() => {
    optionsRef.current = options;
  });

  const [activeIndex, setActiveIndex] = useState<number>(options.initialIndex ?? 0);
  const [activeZoom, setActiveZoom] = useState<number>(1);

  // 옵션은 ref(optionsRef)로 최신값 추적하고 인스턴스 라이프사이클은 마운트/언마운트에만 묶는다.
  // effect 본문이 optionsRef.current(ref)만 읽어 reactive dep이 없으므로 빈 배열이 정확하다.
  useEffect(() => {
    if (!containerRef.current) return;
    const initOpts = optionsRef.current;

    // 사용자 콜백 wrap: state setter + 사용자 콜백(최신 ref 경유)을 둘 다 호출
    const wrappedOptions: ScrollContainerOptions = {
      ...initOpts,
      onIndexChange: (index) => {
        setActiveIndex(index);
        optionsRef.current.onIndexChange?.(index);
      },
      onZoomChange: (zoom) => {
        setActiveZoom(zoom);
        optionsRef.current.onZoomChange?.(zoom);
      },
      onPanelVisibilityChange: (index, visible, panel) =>
        optionsRef.current.onPanelVisibilityChange?.(index, visible, panel),
    };

    const instance = createScrollContainer(containerRef.current, wrappedOptions);
    instanceRef.current = instance;
    appliedRef.current = initOpts;
    // 초기 상태 반영 (initialIndex가 useState 기본값과 다를 수 있고, zoom은 core에서 결정)
    setActiveIndex(instance.getActiveIndex());
    setActiveZoom(instance.getZoom());

    return () => {
      // StrictMode 더블 마운트에서도 안전 (core destroy는 멱등 + null 가드)
      instance.destroy();
      if (instanceRef.current === instance) {
        instanceRef.current = null;
        appliedRef.current = null;
      }
    };
  }, []);

  // 옵션 변경 → 바뀐 것만 setOptions (마운트 effect 다음에 돈다 — 첫 렌더는 같은 객체라 변화 없음)
  useEffect(() => {
    const instance = instanceRef.current;
    const prev = appliedRef.current;
    if (!instance || !prev) return;
    const next = optionsRef.current;
    const update = diffScrollContainerOptions(prev, next);
    appliedRef.current = next;
    if (update) instance.setOptions(update);
  });

  const scrollTo = useCallback((index: number, opts?: { animated?: boolean }) => {
    instanceRef.current?.scrollTo(index, opts);
  }, []);

  const zoomTo = useCallback((level: number, opts?: { animated?: boolean }) => {
    instanceRef.current?.zoomTo(level, opts);
  }, []);

  return { containerRef, activeIndex, activeZoom, scrollTo, zoomTo };
}
