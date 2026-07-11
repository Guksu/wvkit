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

/**
 * [B-09] 어댑터 실질화 — unmount(destroy) 후 리스너가 실제로 제거되고
 * overscrollBehavior가 복원되는지 관측 가능한 부수효과로 단언한다.
 *
 * 제스처 시뮬레이션: happy-dom은 TouchEvent 부분 지원 → core 통합 테스트와 동일하게
 * PointerEvent로 시뮬 (scrollTop=0 기본값으로 top 가드 충족).
 */
function pointerEvent(
  type: string,
  init: { pointerId: number; clientY: number; clientX?: number },
): Event {
  try {
    return new PointerEvent(type, {
      pointerId: init.pointerId,
      clientX: init.clientX ?? 100,
      clientY: init.clientY,
      bubbles: true,
      cancelable: true,
    });
  } catch {
    const ev = new Event(type, { bubbles: true, cancelable: true });
    Object.assign(ev, init);
    return ev;
  }
}

describe('usePullToRefresh (Vue) [B-09] 실질 검증', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('[B-09] A9: unmount 후 원 컨테이너에 제스처를 디스패치해도 onPull이 발화하지 않고 overscrollBehavior가 복원된다', async () => {
    const onPull = vi.fn();
    const onStateChange = vi.fn();
    const { wrapper } = mountWithComposable({
      onRefresh: () => Promise.resolve(),
      onPull,
      onStateChange,
    });
    await wrapper.vm.$nextTick();
    const containerEl = wrapper.element as HTMLElement;

    // 마운트 시점 계약 성립 확인 — contain 적용 + 제스처가 실제로 콜백을 발화하는 상태
    expect(containerEl.style.overscrollBehavior).toBe('contain');
    containerEl.dispatchEvent(pointerEvent('pointerdown', { pointerId: 1, clientY: 100 }));
    containerEl.dispatchEvent(pointerEvent('pointermove', { pointerId: 1, clientY: 140 }));
    expect(onPull).toHaveBeenCalledTimes(1);
    onPull.mockClear();
    onStateChange.mockClear();

    wrapper.unmount();

    // destroy가 원래 값('')으로 복원 — 'contain' 잔존이면 destroy 미실행
    expect(containerEl.style.overscrollBehavior).toBe('');

    containerEl.dispatchEvent(pointerEvent('pointerdown', { pointerId: 2, clientY: 100 }));
    containerEl.dispatchEvent(pointerEvent('pointermove', { pointerId: 2, clientY: 140 }));

    expect(onPull).toHaveBeenCalledTimes(0);
    expect(onStateChange).toHaveBeenCalledTimes(0);
  });
});
