import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent } from 'vue';
import { useVirtualKeyboard } from '../use-virtual-keyboard';

function mockVisualViewport(height = 800) {
  const vv = {
    height,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  Object.defineProperty(window, 'visualViewport', { value: vv, writable: true, configurable: true });
  return vv;
}

function mountWithComposable(options = {}) {
  let exposed: ReturnType<typeof useVirtualKeyboard> | undefined;
  const Component = defineComponent({
    setup() {
      exposed = useVirtualKeyboard(options);
      return {};
    },
    template: '<div />',
  });
  const wrapper = mount(Component);
  return { wrapper, get composable() { return exposed!; } };
}

describe('useVirtualKeyboard (Vue)', () => {
  beforeEach(() => {
    mockVisualViewport(800);
    Object.defineProperty(window, 'innerHeight', { value: 800, writable: true, configurable: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('초기 상태는 isOpen=false, keyboardHeight=0이다', () => {
    const { composable } = mountWithComposable();
    expect(composable.isOpen.value).toBe(false);
    expect(composable.keyboardHeight.value).toBe(0);
  });

  it('threshold 옵션을 전달하면 에러 없이 초기화된다', () => {
    expect(() => mountWithComposable({ threshold: 150 })).not.toThrow();
  });

  it('언마운트 시 에러 없이 정리된다', () => {
    const { wrapper } = mountWithComposable();
    expect(() => wrapper.unmount()).not.toThrow();
  });
});
