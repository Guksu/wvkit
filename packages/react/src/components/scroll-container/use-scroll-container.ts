import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { createScrollContainer } from '@wvkit/core';
import type { ScrollContainerInstance, ScrollContainerOptions } from '@wvkit/core';

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
  useEffect(() => {
    optionsRef.current = options;
  });

  const [activeIndex, setActiveIndex] = useState<number>(options.initialIndex ?? 0);
  const [activeZoom, setActiveZoom] = useState<number>(1);

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
    };

    const instance = createScrollContainer(containerRef.current, wrappedOptions);
    instanceRef.current = instance;
    // 초기 상태 반영 (initialIndex가 useState 기본값과 다를 수 있고, zoom은 core에서 결정)
    setActiveIndex(instance.getActiveIndex());
    setActiveZoom(instance.getZoom());

    return () => {
      // StrictMode 더블 마운트에서도 안전 (core destroy는 멱등 + null 가드)
      instance.destroy();
      if (instanceRef.current === instance) {
        instanceRef.current = null;
      }
    };
    // 의존성 빈 배열: 옵션은 ref로 최신값 추적, 인스턴스는 마운트/언마운트에만 묶음
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scrollTo = useCallback((index: number, opts?: { animated?: boolean }) => {
    instanceRef.current?.scrollTo(index, opts);
  }, []);

  const zoomTo = useCallback((level: number, opts?: { animated?: boolean }) => {
    instanceRef.current?.zoomTo(level, opts);
  }, []);

  return { containerRef, activeIndex, activeZoom, scrollTo, zoomTo };
}
