import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { createPullToRefresh } from '@wvkit/core';
import type {
  PullToRefreshInstance,
  PullToRefreshOptions,
  PullToRefreshState,
} from '@wvkit/core';

/**
 * React 어댑터 — core `createPullToRefresh`를 감싸는 훅.
 *
 * 사용 패턴:
 * ```tsx
 * const { containerRef, state, distance, progress, trigger } = usePullToRefresh({
 *   onRefresh: async () => { await fetchData(); },
 * });
 * return <div ref={containerRef} style={{ overflowY: 'auto', height: 400 }}>{...}</div>;
 * ```
 *
 * 규칙 (useScrollContainer #6 패턴 그대로):
 *  - SSR 안전: `createPullToRefresh`는 `useEffect` 안에서만 호출
 *  - options ref 패턴: 매 렌더 options 객체가 새로 만들어져도 인스턴스 재생성 없음
 *  - 사용자 콜백(`onStateChange` / `onPull` / `onRefresh`)은 ref로 받아 stale closure 회피
 *  - 명령형 메서드(`trigger` / `setEnabled`)는 `useCallback`으로 안정화, instance 마운트 전 호출은 자연 noop
 */
export function usePullToRefresh(options: PullToRefreshOptions): {
  containerRef: RefObject<HTMLDivElement>;
  state: PullToRefreshState;
  distance: number;
  progress: number;
  trigger: () => Promise<void>;
  setEnabled: (enabled: boolean) => void;
} {
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<PullToRefreshInstance | null>(null);

  // 매 렌더의 최신 options를 ref로 보관 — effect 내부 초기화는 1회만 수행
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  const [state, setStateValue] = useState<PullToRefreshState>('idle');
  const [distance, setDistance] = useState<number>(0);
  const [progress, setProgress] = useState<number>(0);

  useEffect(() => {
    if (!containerRef.current) return;
    const initOpts = optionsRef.current;

    // 사용자 콜백 wrap: state setter + 사용자 콜백(최신 ref 경유)을 둘 다 호출
    const wrappedOptions: PullToRefreshOptions = {
      ...initOpts,
      // onRefresh는 wrap 불필요 — 최신 ref 경유로 호출
      onRefresh: () => optionsRef.current.onRefresh(),
      onStateChange: (s) => {
        setStateValue(s);
        optionsRef.current.onStateChange?.(s);
      },
      onPull: (d, p) => {
        setDistance(d);
        setProgress(p);
        optionsRef.current.onPull?.(d, p);
      },
    };

    const instance = createPullToRefresh(containerRef.current, wrappedOptions);
    instanceRef.current = instance;
    // 초기 상태 동기화 (core가 정규화한 결과 반영)
    setStateValue(instance.getState());

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

  const trigger = useCallback((): Promise<void> => {
    return instanceRef.current?.trigger() ?? Promise.resolve();
  }, []);

  const setEnabled = useCallback((enabled: boolean): void => {
    instanceRef.current?.setEnabled(enabled);
  }, []);

  return { containerRef, state, distance, progress, trigger, setEnabled };
}
