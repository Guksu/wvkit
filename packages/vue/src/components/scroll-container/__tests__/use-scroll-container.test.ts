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
    expect(() => wrapper.unmount()).not.toThrow();
  });
});
