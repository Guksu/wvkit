import { describe, it, expect, vi, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, } from 'vue';
import { useStableInput } from '../use-stable-input';

function mountWithComposable(options = {}) {
  let exposed: ReturnType<typeof useStableInput> | undefined;
  const Component = defineComponent({
    setup() {
      exposed = useStableInput(options);
      return { containerRef: exposed.containerRef };
    },
    template: '<div ref="containerRef" />',
  });
  const wrapper = mount(Component, { attachTo: document.body });
  return { wrapper, get composable() { return exposed!; } };
}

describe('useStableInput (Vue)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('containerRef, focus, blur, setValue, getValue를 반환한다', () => {
    const { composable } = mountWithComposable();
    expect(composable.containerRef).toBeDefined();
    expect(typeof composable.focus).toBe('function');
    expect(typeof composable.blur).toBe('function');
    expect(typeof composable.setValue).toBe('function');
    expect(typeof composable.getValue).toBe('function');
  });

  it('마운트 후 hiddenInput이 body에 추가된다', async () => {
    const { wrapper } = mountWithComposable({ placeholder: '검색…' });
    await wrapper.vm.$nextTick();
    const inputs = document.body.querySelectorAll('input');
    expect(inputs.length).toBeGreaterThan(0);
  });

  it('onChange 콜백이 위임된다', async () => {
    const onChange = vi.fn();
    const { wrapper } = mountWithComposable({ onChange });
    await wrapper.vm.$nextTick();

    const hiddenInput = Array.from(document.body.querySelectorAll('input'))
      .find((el) => el.style.position === 'fixed') as HTMLInputElement | undefined;

    if (hiddenInput) {
      Object.defineProperty(hiddenInput, 'value', { value: 'hello', writable: true });
      hiddenInput.dispatchEvent(new Event('input', { bubbles: true }));
      expect(onChange).toHaveBeenCalledWith('hello');
    }
  });

  it('언마운트 시 hiddenInput이 제거된다', async () => {
    const { wrapper } = mountWithComposable();
    await wrapper.vm.$nextTick();
    const before = document.body.querySelectorAll('input').length;
    wrapper.unmount();
    const after = document.body.querySelectorAll('input').length;
    expect(after).toBeLessThan(before);
  });

  it('getValue()는 기본값으로 빈 문자열을 반환한다', async () => {
    const { composable, wrapper } = mountWithComposable();
    await wrapper.vm.$nextTick();
    expect(composable.getValue()).toBe('');
  });
});

/**
 * [B-09] 어댑터 실질화 — unmount(destroy) 후 displayInput/hiddenInput이
 * document에서 완전히 제거되는지 수치로 단언한다 (기존 smoke는 감소만 확인).
 */
describe('useStableInput (Vue) [B-09] 실질 검증', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('[B-09] A10: unmount 후 document에 인풋이 0개다 (displayInput/hiddenInput.remove 실효)', async () => {
    const { wrapper } = mountWithComposable({ placeholder: '검색…' });
    await wrapper.vm.$nextTick();
    // 마운트 시점 계약: display 1 + hidden 1 = 정확히 2개
    expect(document.querySelectorAll('input').length).toBe(2);

    wrapper.unmount();

    expect(document.querySelectorAll('input').length).toBe(0);
  });
});
