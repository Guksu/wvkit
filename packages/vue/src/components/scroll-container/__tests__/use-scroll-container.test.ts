import { mount } from '@vue/test-utils';
import { defineComponent, nextTick, reactive, ref } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { diffScrollContainerOptions, useScrollContainer } from '../use-scroll-container';

/**
 * Vue 어댑터 smoke 테스트. 정밀 행렬·축 제약 검증은 core 단위 테스트(#5) 영역.
 */

function makePanels(count: number): HTMLElement[] {
  return Array.from({ length: count }, (_, i) => {
    const el = document.createElement('div');
    el.dataset.idx = String(i);
    return el;
  });
}

function mountWithComposable(options: Parameters<typeof useScrollContainer>[0]) {
  let exposed: ReturnType<typeof useScrollContainer> | undefined;
  const Component = defineComponent({
    setup() {
      exposed = useScrollContainer(options);
      return { containerRef: exposed.containerRef };
    },
    template: '<div ref="containerRef" style="width: 400px; height: 600px; position: relative" />',
  });
  const wrapper = mount(Component, { attachTo: document.body });
  return {
    wrapper,
    get composable() {
      return exposed!;
    },
  };
}

describe('useScrollContainer (Vue)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('컴포저블이 containerRef + 상태 ref + 명령형 메서드를 반환한다', () => {
    const panels = makePanels(3);
    const { composable } = mountWithComposable({
      direction: 'horizontal',
      panels,
    });
    expect(composable.containerRef).toBeDefined();
    expect(composable.activeIndex.value).toBe(0);
    expect(composable.activeZoom.value).toBe(1);
    expect(typeof composable.scrollTo).toBe('function');
    expect(typeof composable.zoomTo).toBe('function');
  });

  it('마운트 후 containerRef DOM에 renderer.domElement가 attach된다', async () => {
    const panels = makePanels(3);
    const { wrapper } = mountWithComposable({
      direction: 'horizontal',
      panels,
    });
    await wrapper.vm.$nextTick();
    const containerEl = wrapper.element as HTMLElement;
    expect(containerEl.children.length).toBeGreaterThan(0);
  });

  it('scrollTo 호출 시 activeIndex ref + 사용자 onIndexChange가 동기화된다', async () => {
    const onIndexChange = vi.fn();
    const panels = makePanels(4);
    const { wrapper, composable } = mountWithComposable({
      direction: 'horizontal',
      panels,
      onIndexChange,
    });
    await wrapper.vm.$nextTick();
    composable.scrollTo(2);
    expect(composable.activeIndex.value).toBe(2);
    expect(onIndexChange).toHaveBeenCalledWith(2);
  });

  it('언마운트 시 에러 없이 정리된다', async () => {
    const panels = makePanels(3);
    const { wrapper } = mountWithComposable({
      direction: 'horizontal',
      panels,
    });
    await wrapper.vm.$nextTick();
    const containerEl = wrapper.element as HTMLElement;
    // 마운트 중에는 renderer DOM이 attach되어 있다 — 아래 제거 단언이 공허해지지 않게
    expect(containerEl.children.length).toBeGreaterThan(0);
    expect(() => wrapper.unmount()).not.toThrow();
    // destroy 실행 증거 — 컨테이너에 renderer DOM 잔존 없음 (B-22)
    expect(containerEl.children.length).toBe(0);
  });
});

/**
 * [B-09] 어댑터 실질화 — unmount 후 명령형 메서드가 noop이 되는지
 * (instance null 가드 실효, use-scroll-container.ts:60-63) 콜백 미발화로 단언한다.
 */
describe('useScrollContainer (Vue) [B-09] 실질 검증', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('[B-09] A11: unmount 후 scrollTo(1)을 호출해도 onIndexChange가 발화하지 않는다 (noop 가드)', async () => {
    const onIndexChange = vi.fn();
    const panels = makePanels(4);
    const { wrapper, composable } = mountWithComposable({
      direction: 'horizontal',
      panels,
      onIndexChange,
    });
    await wrapper.vm.$nextTick();

    // 마운트 시점 계약 성립 확인 — scrollTo가 실제로 콜백을 발화하는 상태
    composable.scrollTo(2, { animated: false });
    expect(onIndexChange).toHaveBeenCalledWith(2);
    onIndexChange.mockClear();

    wrapper.unmount();

    expect(() => composable.scrollTo(1, { animated: false })).not.toThrow();
    expect(onIndexChange).toHaveBeenCalledTimes(0);
    // ref도 unmount 이전 값에서 변하지 않는다
    expect(composable.activeIndex.value).toBe(2);
  });
});

/**
 * [B-25] 어댑터 계약 핀 — 보통 객체 옵션은 마운트 때 값으로 고정되고, 반응형(reactive·ref·getter) 옵션은
 * 바뀌면 인스턴스를 다시 만들지 않고 `setOptions` 로 반영한다.
 */
describe('useScrollContainer (Vue) [B-25] 옵션 변경 계약', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('[B-25] V1: 보통 객체의 panels 를 바꿔도 추적하지 않는다 (마운트 때 값 고정)', async () => {
    const options = { direction: 'horizontal' as const, panels: makePanels(3) };
    const { wrapper, composable } = mountWithComposable(options);
    await wrapper.vm.$nextTick();

    const containerEl = wrapper.element as HTMLElement;
    const rendererEl = containerEl.firstElementChild;
    expect(rendererEl).not.toBeNull();
    const indexBefore = composable.activeIndex.value;

    const next = makePanels(5);
    options.panels = next;
    await wrapper.vm.$nextTick();

    expect(containerEl.firstElementChild).toBe(rendererEl);
    expect(composable.activeIndex.value).toBe(indexBefore);
    expect(next[0]?.parentNode).toBeNull();
  });

  it('[B-25] V2: reactive 옵션의 panels 를 바꾸면 같은 인스턴스가 새 패널을 쓰고, 보던 패널을 유지한다', async () => {
    const panels = makePanels(3);
    const options = reactive({
      direction: 'horizontal' as const,
      panels,
      initialIndex: 1,
    });
    const { wrapper, composable } = mountWithComposable(options);
    await nextTick();
    const containerEl = wrapper.element as HTMLElement;
    const rendererEl = containerEl.firstElementChild;
    expect(composable.activeIndex.value).toBe(1);

    const added = makePanels(1);
    options.panels = [...added, ...panels];
    await nextTick();

    expect(containerEl.firstElementChild).toBe(rendererEl);
    expect(composable.activeIndex.value).toBe(2);
    expect(added[0]?.style.position).toBe('absolute');
  });

  it('[B-25] V3: ref 옵션의 minZoom 을 올리면 줌을 새 범위로 올린다', async () => {
    const options = ref({ direction: 'horizontal' as const, panels: makePanels(2), minZoom: 1 });
    const { composable } = mountWithComposable(options);
    await nextTick();
    options.value = { ...options.value, minZoom: 2 };
    await nextTick();
    expect(composable.activeZoom.value).toBe(2);
  });

  it('[B-25] V4: 바뀐 키만 모은다 — 같은 요소의 새 배열·콜백·initialIndex 는 제외', () => {
    const panels = makePanels(2);
    const base = { direction: 'horizontal' as const, panels, minZoom: 1 };
    expect(diffScrollContainerOptions(base, { ...base, panels: [...panels] })).toBeNull();
    expect(
      diffScrollContainerOptions(base, { ...base, onZoomChange: () => {}, initialIndex: 1 }),
    ).toBeNull();
    expect(diffScrollContainerOptions(base, { ...base, gap: 4 })).toEqual({ gap: 4 });
  });
});
