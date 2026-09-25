import { createScrollContainer } from '@guksu/wvkit-core/scroll-container';
import type {
  ScrollContainerDirection,
  ScrollContainerInstance,
  ScrollContainerOptions,
} from '@guksu/wvkit-core/scroll-container';
import {
  type ExtractPublicPropTypes,
  type InjectionKey,
  type PropType,
  Teleport,
  defineComponent,
  h,
  inject,
  mergeProps,
  onBeforeUnmount,
  onMounted,
  provide,
  ref,
  shallowRef,
  watch,
} from 'vue';
import { diffScrollContainerOptions } from './use-scroll-container';

/**
 * 컴포넌트 API — `panels` 배열 대신 자식으로 패널을 쓴다.
 *
 * ```vue
 * <ScrollContainer direction="horizontal" :gap="12" style="height: 560px" ref="sc" @index-change="onChange">
 *   <ScrollPanel v-for="t in tabs" :key="t.id"><Feed :tab="t" /></ScrollPanel>
 * </ScrollContainer>
 * ```
 *
 * 구조 (React 와 같음):
 *  - core 는 패널 요소를 자기 scene 으로 옮긴다. Vue 가 관리하는 DOM 을 옮기면 나중에 지울 때 부모가 달라
 *    오류가 나므로, 각 `ScrollPanel` 은 자기 패널 요소(div)를 만들고 내용을 `Teleport` 로 그 안에 그린다.
 *  - 패널 순서는 `ScrollPanel` 이 제자리에 남기는 숨은 표시 요소(span)의 DOM 순서다.
 *  - 패널 목록·옵션이 바뀌면 `setOptions` 로 넘긴다. 패널이 하나도 없으면 인스턴스를 만들지 않는다.
 *  - 불리언 옵션은 기본값을 `undefined` 로 둔다 — Vue 는 빠진 불리언 prop 을 `false` 로 바꾸므로 core 기본값이 사라진다.
 *  - `lazy`: 패널 내용은 core 가 그 패널을 처음 렌더 창에 넣을 때(onPanelVisibilityChange) 마운트하고 그 뒤로 유지한다.
 */

const scrollContainerProps = {
  /** 카메라 pan 축 제약. `'both'` 는 사용 중단 — `'horizontal'` 과 같고 1.0 에서 제거한다. */
  direction: { type: String as PropType<ScrollContainerDirection>, required: true as const },
  initialIndex: { type: Number, default: undefined },
  panelHeight: { type: Function as PropType<(index: number) => number>, default: undefined },
  panelWidth: {
    type: [Number, Function] as PropType<ScrollContainerOptions['panelWidth']>,
    default: undefined,
  },
  gap: { type: Number, default: undefined },
  align: { type: String as PropType<'center' | 'start'>, default: undefined },
  overscan: { type: Number, default: undefined },
  snapThreshold: { type: Number, default: undefined },
  dragThreshold: { type: Number, default: undefined },
  noDragSelector: { type: String, default: undefined },
  resistance: { type: Number, default: undefined },
  enablePinchZoom: { type: Boolean, default: undefined },
  minZoom: { type: Number, default: undefined },
  maxZoom: { type: Number, default: undefined },
  doubleTapZoom: { type: [Number, Boolean] as PropType<number | false>, default: undefined },
  wheel: { type: Boolean, default: undefined },
  keyboard: { type: Boolean, default: undefined },
  a11y: { type: Boolean, default: undefined },
  /**
   * `true` 면 각 패널 내용을 그 패널이 처음 렌더 창(화면에 보이는 패널 + 양쪽 `overscan`)에 들어올 때
   * 마운트하고, 그 뒤로는 유지한다. 기본값 `false` — 모든 패널 내용을 처음부터 마운트한다. (core 옵션이 아니다)
   */
  lazy: { type: Boolean, default: false },
};

export type ScrollContainerProps = ExtractPublicPropTypes<typeof scrollContainerProps>;

/** 템플릿 ref 로 받는 명령형 핸들 (`expose`) */
export interface ScrollContainerHandle {
  scrollTo(index: number, opts?: { animated?: boolean }): void;
  zoomTo(level: number, opts?: { animated?: boolean }): void;
  getActiveIndex(): number;
  getZoom(): number;
}

interface Registry {
  register(marker: Element, panel: HTMLElement): () => void;
  /** 이 패널의 내용을 그릴지 — lazy 면 렌더 창에 한 번이라도 들어온 패널만 (render 안에서 읽으면 반응한다) */
  showContent(panel: HTMLElement): boolean;
}

// 최상위 호출에 PURE 표시 — 훅만 가져오는 번들에서 컴포넌트 코드가 빠지게 (tree-shaking)
const REGISTRY: InjectionKey<Registry> = /*#__PURE__*/ Symbol('wvkit-scroll-container');

const HOST_STYLE = { position: 'relative', overflow: 'hidden', touchAction: 'none' };

export const ScrollContainer = /*#__PURE__*/ defineComponent({
  name: 'ScrollContainer',
  props: scrollContainerProps,
  emits: {
    indexChange: (index: number) => typeof index === 'number',
    zoomChange: (zoom: number) => typeof zoom === 'number',
    panelVisibilityChange: (index: number, visible: boolean, panel: HTMLElement) =>
      typeof index === 'number' && typeof visible === 'boolean' && panel instanceof HTMLElement,
  },
  setup(props, { slots, emit, expose }) {
    const hostRef = ref<HTMLElement | null>(null);
    let instance: ScrollContainerInstance | null = null;
    let applied: ScrollContainerOptions | null = null;
    let unmounted = false;

    // 패널 등록부: 표시 요소 → 패널 요소. 바뀌면 version 이 올라 동기화한다
    const entries = new Map<Element, HTMLElement>();
    const version = ref(0);
    // 한 번이라도 렌더 창에 들어온 패널 — lazy 를 꺼 두어도 기록한다 (나중에 켜도 이미 본 패널은 그대로)
    const shown = new Set<HTMLElement>();
    const shownVersion = ref(0);
    provide(REGISTRY, {
      register(marker, panel) {
        entries.set(marker, panel);
        version.value++;
        return () => {
          entries.delete(marker);
          version.value++;
        };
      },
      showContent(panel) {
        if (!props.lazy) return true;
        void shownVersion.value; // 반응성 추적 — 새 패널이 창에 들어오면 다시 그린다
        return shown.has(panel);
      },
    });

    /** 표시 요소의 DOM 순서로 패널 목록을 만들고 인스턴스를 만들거나 바뀐 것만 넘긴다 */
    function sync(): void {
      const host = hostRef.value;
      if (!host || unmounted) return;
      const panels = [...entries]
        .sort(([a], [b]) =>
          a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
        )
        .map(([, panel]) => panel);
      const options: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(props)) {
        if (key !== 'lazy' && value !== undefined) options[key] = value;
      }
      const next = { ...options, panels } as unknown as ScrollContainerOptions;

      // 세로 페이저 + panelHeight 면 패널 요소 높이도 맞춘다 (패널 요소는 이 컴포넌트가 만든 것)
      panels.forEach((panel, i) => {
        const hgt = next.direction === 'vertical' ? next.panelHeight?.(i) : undefined;
        panel.style.height = hgt === undefined ? '100%' : `${hgt}px`;
      });

      if (panels.length === 0) {
        instance?.destroy();
        instance = null;
        applied = null;
        return;
      }
      if (!instance) {
        instance = createScrollContainer(host, {
          ...next,
          onIndexChange: (i) => emit('indexChange', i),
          onZoomChange: (z) => emit('zoomChange', z),
          onPanelVisibilityChange: (i, visible, panel) => {
            if (visible && !shown.has(panel)) {
              shown.add(panel);
              shownVersion.value++;
            }
            emit('panelVisibilityChange', i, visible, panel);
          },
        });
        applied = next;
        return;
      }
      const update = applied ? diffScrollContainerOptions(applied, next) : null;
      applied = next;
      if (update) instance.setOptions(update);
    }

    onMounted(sync);
    watch([version, () => ({ ...props })], sync, { flush: 'post' });
    onBeforeUnmount(() => {
      unmounted = true;
      instance?.destroy();
      instance = null;
      applied = null;
    });

    expose({
      scrollTo: (index: number, opts?: { animated?: boolean }) => instance?.scrollTo(index, opts),
      zoomTo: (level: number, opts?: { animated?: boolean }) => instance?.zoomTo(level, opts),
      getActiveIndex: () => instance?.getActiveIndex() ?? props.initialIndex ?? 0,
      getZoom: () => instance?.getZoom() ?? 1,
    } satisfies ScrollContainerHandle);

    // 표시 요소만 담는 숨은 상자 — 패널 내용은 Teleport 로 core 의 scene 안 패널 요소에 그려진다.
    // class·style 등 나머지 속성은 Vue 가 이 루트 div 에 합친다 (style 은 기본값 뒤에 붙어 덮어쓴다).
    return () =>
      h('div', { ref: hostRef, style: HOST_STYLE }, [h('div', { hidden: '' }, slots.default?.())]);
  },
});

export const ScrollPanel = /*#__PURE__*/ defineComponent({
  name: 'ScrollPanel',
  inheritAttrs: false,
  props: {
    /** 패널 요소의 `aria-label` (없으면 a11y 가 "n / N" 을 붙인다) */
    label: { type: String, default: undefined },
  },
  setup(props, { slots, attrs }) {
    const registry = inject(REGISTRY, null);
    const markerRef = ref<HTMLElement | null>(null);
    const panel = shallowRef<HTMLElement | null>(null);
    let labeled = false;
    let unregister: (() => void) | undefined;

    function applyLabel(el: HTMLElement): void {
      if (props.label !== undefined) {
        el.setAttribute('aria-label', props.label);
        labeled = true;
      } else if (labeled) {
        // 우리가 붙인 것만 지운다 — core a11y 가 붙인 "n / N" 은 그대로
        el.removeAttribute('aria-label');
        labeled = false;
      }
    }

    // 브라우저에서만 패널 요소를 만든다 (SSR 에는 Teleport 대상이 없다)
    onMounted(() => {
      const el = document.createElement('div');
      el.style.width = '100%';
      el.style.height = '100%';
      // 등록(→ core a11y 가 속성을 붙임) 전에 label 을 붙인다
      applyLabel(el);
      panel.value = el;
      if (markerRef.value && registry) unregister = registry.register(markerRef.value, el);
    });
    watch(
      () => props.label,
      () => {
        if (panel.value) applyLabel(panel.value);
      },
    );
    onBeforeUnmount(() => unregister?.());

    return () =>
      h(
        'span',
        { ref: markerRef, hidden: '', 'data-scroll-panel': '' },
        panel.value
          ? [
              h(Teleport, { to: panel.value }, [
                // lazy: 렌더 창에 처음 들어오기 전에는 내용 없이 빈 내용 요소만 둔다
                h(
                  'div',
                  mergeProps({ style: { height: '100%' } }, attrs),
                  registry && !registry.showContent(panel.value) ? undefined : slots.default?.(),
                ),
              ]),
            ]
          : undefined,
      );
  },
});
