import { mount } from '@vue/test-utils';
import { defineComponent } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePullToRefresh } from '../use-pull-to-refresh';

/**
 * Vue 어댑터 smoke 테스트.
 * core 단위 테스트(#19)가 정밀 검증(상태머신/저항/destroy 등) 담당.
 */

function mountWithComposable(options: Parameters<typeof usePullToRefresh>[0]) {
  let exposed: ReturnType<typeof usePullToRefresh> | undefined;
  const Component = defineComponent({
    setup() {
      exposed = usePullToRefresh(options);
      return { containerRef: exposed.containerRef };
    },
    template: '<div ref="containerRef" style="width: 400px; height: 400px; overflow-y: auto" />',
  });
  const wrapper = mount(Component, { attachTo: document.body });
  return {
    wrapper,
    get composable() {
      return exposed!;
    },
  };
}

describe('usePullToRefresh (Vue)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('컴포저블이 containerRef + 상태 refs + 명령형 메서드를 반환한다', () => {
    const { composable } = mountWithComposable({
      onRefresh: () => Promise.resolve(),
    });
    expect(composable.containerRef).toBeDefined();
    expect(composable.state.value).toBe('idle');
    expect(composable.distance.value).toBe(0);
    expect(composable.progress.value).toBe(0);
    expect(typeof composable.trigger).toBe('function');
    expect(typeof composable.setEnabled).toBe('function');
  });

  it('마운트 후 containerRef에 overscrollBehavior=contain이 자동 적용된다 (D3)', async () => {
    const { wrapper } = mountWithComposable({
      onRefresh: () => Promise.resolve(),
    });
    await wrapper.vm.$nextTick();
    const containerEl = wrapper.element as HTMLElement;
    expect(containerEl.style.overscrollBehavior).toBe('contain');
  });

  it('trigger() 호출 시 onRefresh + onStateChange 사용자 콜백이 호출되고 state ref가 갱신된다', async () => {
    const onRefresh = vi.fn(() => Promise.resolve());
    const onStateChange = vi.fn();
    const { wrapper, composable } = mountWithComposable({
      onRefresh,
      onStateChange,
    });
    await wrapper.vm.$nextTick();
    await composable.trigger();
    expect(onRefresh).toHaveBeenCalled();
    const states = onStateChange.mock.calls.map((c) => c[0]);
    expect(states).toContain('refreshing');
  });

  it('언마운트 시 에러 없이 정리된다', async () => {
    const { wrapper } = mountWithComposable({
      onRefresh: () => Promise.resolve(),
    });
    await wrapper.vm.$nextTick();
    expect(() => wrapper.unmount()).not.toThrow();
  });
});
