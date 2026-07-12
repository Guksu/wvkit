import { mount } from '@vue/test-utils';
import { defineComponent } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useScrollContainer } from '../use-scroll-container';

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
 * [B-25] 어댑터 계약 핀 — non-callback 옵션(panels 등)은 setup 시점에 1회 고정되며
 * 이후 변경은 인스턴스를 재생성하지 않는다(문서화된 계약). 이 동작이 조용히 바뀌면
 * 문서와 어긋나므로 테스트로 고정한다.
 */
describe('useScrollContainer (Vue) [B-25] non-callback 옵션 1회 고정 계약', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('[B-25] V1: 마운트 후 options 객체의 panels를 교체해도 인스턴스는 재생성되지 않는다', async () => {
    const options = { direction: 'horizontal' as const, panels: makePanels(3) };
    const { wrapper, composable } = mountWithComposable(options);
    await wrapper.vm.$nextTick();

    const containerEl = wrapper.element as HTMLElement;
    // 재생성되면 CSS3DRenderer.domElement가 detach 후 새로 append되어 참조가 바뀐다
    const rendererEl = containerEl.firstElementChild;
    expect(rendererEl).not.toBeNull();
    const indexBefore = composable.activeIndex.value;

    // 옵션 객체의 panels 교체 — 어댑터는 이를 감지하지 않는다(재마운트가 유일한 반영 수단)
    options.panels = makePanels(5);
    await wrapper.vm.$nextTick();

    expect(containerEl.firstElementChild).toBe(rendererEl);
    expect(composable.activeIndex.value).toBe(indexBefore);
  });
});
