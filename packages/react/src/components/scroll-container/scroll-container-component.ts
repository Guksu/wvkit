import { createScrollContainer } from '@guksu/wvkit-core/scroll-container';
import type {
  ScrollContainerInstance,
  ScrollContainerOptions,
} from '@guksu/wvkit-core/scroll-container';
import {
  type CSSProperties,
  type ForwardedRef,
  type HTMLAttributes,
  type ReactNode,
  createContext,
  createElement,
  forwardRef,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { diffScrollContainerOptions } from './use-scroll-container';

/**
 * 컴포넌트 API — `panels` 배열 대신 자식으로 패널을 쓴다.
 *
 * ```tsx
 * <ScrollContainer direction="horizontal" gap={12} style={{ height: 560 }} ref={sc}>
 *   {tabs.map((t) => (
 *     <ScrollPanel key={t.id}>
 *       <Feed tab={t} />
 *     </ScrollPanel>
 *   ))}
 * </ScrollContainer>
 * ```
 *
 * 구조:
 *  - core 는 패널 요소를 자기 scene 으로 옮긴다. React 가 관리하는 DOM 을 옮기면 나중에 React 가 지울 때
 *    부모가 달라 오류가 나므로, 각 `ScrollPanel` 은 자기 패널 요소(div)를 직접 만들고 내용을 포털로 그 안에 그린다.
 *  - 패널 순서는 `ScrollPanel` 이 제자리에 남기는 숨은 표시 요소(span)의 DOM 순서다 — 조건부 렌더·감싼 컴포넌트가
 *    있어도 화면에 쓴 순서와 같다.
 *  - 패널 목록·옵션이 바뀌면 `setOptions` 로 넘긴다 (다시 마운트하지 않음). 패널이 하나도 없으면 인스턴스를 만들지 않는다.
 *  - SSR: 서버에서는 표시 요소만 그리고 패널 내용은 그리지 않는다 (포털은 브라우저에서만).
 *  - `lazy`: 패널 내용은 core 가 그 패널을 처음 렌더 창에 넣을 때(onPanelVisibilityChange) 마운트하고 그 뒤로 유지한다.
 */

/** 옵션 키 — props 에서 옵션과 DOM 속성을 나눈다 (`panels` 는 자식에서 온다) */
const OPTION_KEYS = [
  'direction',
  'initialIndex',
  'panelHeight',
  'panelWidth',
  'gap',
  'align',
  'onIndexChange',
  'onPanelVisibilityChange',
  'overscan',
  'snapThreshold',
  'dragThreshold',
  'noDragSelector',
  'resistance',
  'enablePinchZoom',
  'minZoom',
  'maxZoom',
  'doubleTapZoom',
  'onZoomChange',
  'wheel',
  'keyboard',
  'a11y',
] as const satisfies ReadonlyArray<keyof ScrollContainerOptions>;

// 옵션이 늘면 여기서 타입 오류가 난다 — OPTION_KEYS 에 추가할 것 (타입만, 번들에 코드가 남지 않는다)
type AssertNever<T extends never> = T;
export type _OptionKeysComplete = AssertNever<
  Exclude<keyof ScrollContainerOptions, 'panels' | (typeof OPTION_KEYS)[number]>
>;

export type ScrollContainerProps = Omit<ScrollContainerOptions, 'panels'> &
  Omit<HTMLAttributes<HTMLDivElement>, (typeof OPTION_KEYS)[number] | 'children'> & {
    children?: ReactNode;
    /**
     * `true` 면 각 패널 내용을 그 패널이 처음 렌더 창(화면에 보이는 패널 + 양쪽 `overscan`)에 들어올 때
     * 마운트하고, 그 뒤로는 유지한다. 기본값 `false` — 모든 패널 내용을 처음부터 마운트한다.
     */
    lazy?: boolean;
  };

/** `ref` 로 받는 명령형 핸들 */
export interface ScrollContainerHandle {
  scrollTo(index: number, opts?: { animated?: boolean }): void;
  zoomTo(level: number, opts?: { animated?: boolean }): void;
  getActiveIndex(): number;
  getZoom(): number;
}

export type ScrollPanelProps = HTMLAttributes<HTMLDivElement> & {
  children?: ReactNode;
  /** 패널 요소의 `aria-label` (없으면 a11y 가 "n / N" 을 붙인다) */
  label?: string;
};

interface Registry {
  register(marker: Element, panel: HTMLElement): () => void;
}

// 최상위 호출에 PURE 표시 — 훅만 가져오는 번들에서 컴포넌트 코드가 빠지게 (tree-shaking)
const PanelRegistry = /*#__PURE__*/ createContext<Registry | null>(null);

/** lazy 상태 — 등록부와 따로 둔다 (등록부가 바뀌면 ScrollPanel 이 다시 등록하므로) */
interface LazyState {
  lazy: boolean;
  /** 한 번이라도 렌더 창에 들어온 패널 요소 */
  shown: ReadonlySet<HTMLElement>;
  version: number;
}
const PanelLazy = /*#__PURE__*/ createContext<LazyState | null>(null);

const HOST_STYLE: CSSProperties = { position: 'relative', overflow: 'hidden', touchAction: 'none' };

function ScrollContainerRender(
  props: ScrollContainerProps,
  ref: ForwardedRef<ScrollContainerHandle>,
) {
  const { children, style, lazy = false, ...rest } = props;
  const options: Record<string, unknown> = {};
  const attrs: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rest)) {
    if ((OPTION_KEYS as ReadonlyArray<string>).includes(key)) options[key] = value;
    else attrs[key] = value;
  }

  const hostRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<ScrollContainerInstance | null>(null);
  const appliedRef = useRef<ScrollContainerOptions | null>(null);
  // 최신 props — 콜백은 이 ref 로 부른다 (인스턴스는 처음 만든 래퍼 콜백을 계속 쓴다)
  const propsRef = useRef(props);
  propsRef.current = props;

  // 패널 등록부: 표시 요소 → 패널 요소. 바뀌면 다시 렌더해 아래 effect 가 동기화한다
  const entries = useRef(new Map<Element, HTMLElement>()).current;
  const [, bump] = useReducer((v: number) => v + 1, 0);
  // 한 번이라도 렌더 창에 들어온 패널 — lazy 를 꺼 두어도 기록한다 (나중에 켜도 이미 본 패널은 그대로)
  const shown = useRef(new Set<HTMLElement>()).current;
  const [shownVersion, bumpShown] = useReducer((v: number) => v + 1, 0);
  const lazyState = useMemo<LazyState>(
    () => ({ lazy, shown, version: shownVersion }),
    [lazy, shown, shownVersion],
  );
  const registry = useMemo<Registry>(
    () => ({
      register(marker, panel) {
        entries.set(marker, panel);
        bump();
        return () => {
          entries.delete(marker);
          bump();
        };
      },
    }),
    [entries],
  );

  // 언마운트 — 동기화 effect 보다 먼저 선언해 StrictMode 재실행에서도 순서가 맞게
  useEffect(
    () => () => {
      instanceRef.current?.destroy();
      instanceRef.current = null;
      appliedRef.current = null;
    },
    [],
  );

  // 렌더마다: 표시 요소의 DOM 순서로 패널 목록을 만들고 인스턴스를 만들거나 바뀐 것만 넘긴다
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const panels = [...entries]
      .sort(([a], [b]) =>
        a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
      )
      .map(([, panel]) => panel);
    const next = {
      ...(options as Omit<ScrollContainerOptions, 'panels'>),
      panels,
    } as ScrollContainerOptions;

    // 세로 페이저 + panelHeight 면 패널 요소 높이도 맞춘다 (패널 요소는 이 컴포넌트가 만든 것)
    for (let i = 0; i < panels.length; i++) {
      const h = next.direction === 'vertical' ? next.panelHeight?.(i) : undefined;
      (panels[i] as HTMLElement).style.height = h === undefined ? '100%' : `${h}px`;
    }

    const instance = instanceRef.current;
    if (panels.length === 0) {
      instance?.destroy();
      instanceRef.current = null;
      appliedRef.current = null;
      return;
    }
    if (!instance) {
      instanceRef.current = createScrollContainer(host, {
        ...next,
        onIndexChange: (i) => propsRef.current.onIndexChange?.(i),
        onZoomChange: (z) => propsRef.current.onZoomChange?.(z),
        onPanelVisibilityChange: (i, visible, panel) => {
          if (visible && !shown.has(panel)) {
            shown.add(panel);
            bumpShown();
          }
          propsRef.current.onPanelVisibilityChange?.(i, visible, panel);
        },
      });
      appliedRef.current = next;
      return;
    }
    const prev = appliedRef.current;
    appliedRef.current = next;
    const update = prev ? diffScrollContainerOptions(prev, next) : null;
    if (update) instance.setOptions(update);
  });

  useImperativeHandle(
    ref,
    () => ({
      scrollTo: (index, opts) => instanceRef.current?.scrollTo(index, opts),
      zoomTo: (level, opts) => instanceRef.current?.zoomTo(level, opts),
      getActiveIndex: () =>
        instanceRef.current?.getActiveIndex() ?? propsRef.current.initialIndex ?? 0,
      getZoom: () => instanceRef.current?.getZoom() ?? 1,
    }),
    [],
  );

  return createElement(
    'div',
    { ...attrs, ref: hostRef, style: { ...HOST_STYLE, ...style } },
    // 표시 요소만 담는 숨은 상자 — 패널 내용은 포털로 core 의 scene 안 패널 요소에 그려진다
    createElement(
      PanelRegistry.Provider,
      { value: registry },
      createElement(
        PanelLazy.Provider,
        { value: lazyState },
        createElement('div', { hidden: true }, children),
      ),
    ),
  );
}

export const ScrollContainer = /*#__PURE__*/ forwardRef(ScrollContainerRender);

export function ScrollPanel(props: ScrollPanelProps) {
  const { children, label, style, ...attrs } = props;
  const registry = useContext(PanelRegistry);
  const lazyState = useContext(PanelLazy);
  const markerRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  /** 우리가 aria-label 을 붙였는지 — label 을 거둘 때 core a11y 가 붙인 "n / N" 은 지우지 않게 */
  const labeledRef = useRef(false);
  const [panel, setPanel] = useState<HTMLDivElement | null>(null);

  // 브라우저에서만 패널 요소를 만든다 (SSR 에는 포털이 없다). StrictMode 재실행에서도 같은 요소를 쓴다.
  // biome-ignore lint/correctness/useExhaustiveDependencies: label 변경은 아래 effect 가 반영한다 (다시 등록하지 않게)
  useEffect(() => {
    if (!panelRef.current) {
      const el = document.createElement('div');
      el.style.width = '100%';
      el.style.height = '100%';
      panelRef.current = el;
    }
    const el = panelRef.current;
    // 등록(→ core a11y 가 속성을 붙임) 전에 label 을 붙인다 — 있으면 a11y 는 "n / N" 을 붙이지도, 나중에 지우지도 않는다
    if (label !== undefined) {
      el.setAttribute('aria-label', label);
      labeledRef.current = true;
    }
    setPanel(el);
    const marker = markerRef.current;
    return marker && registry ? registry.register(marker, el) : undefined;
  }, [registry]);

  useEffect(() => {
    if (!panel) return;
    if (label !== undefined) {
      panel.setAttribute('aria-label', label);
      labeledRef.current = true;
    } else if (labeledRef.current) {
      panel.removeAttribute('aria-label');
      labeledRef.current = false;
    }
  }, [panel, label]);

  // lazy: 렌더 창에 처음 들어오기 전에는 내용 없이 빈 내용 요소만 둔다
  const showContent = !lazyState?.lazy || (panel !== null && lazyState.shown.has(panel));
  return createElement(
    'span',
    { ref: markerRef, hidden: true, 'data-scroll-panel': '' },
    panel
      ? createPortal(
          createElement(
            'div',
            { ...attrs, style: { height: '100%', ...style } },
            showContent ? children : null,
          ),
          panel,
        )
      : null,
  );
}
