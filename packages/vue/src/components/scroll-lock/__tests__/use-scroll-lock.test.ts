import { describe, it, expect, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent } from 'vue';
import { useScrollLock } from '../use-scroll-lock';

function mountWithComposable() {
  let exposed: ReturnType<typeof useScrollLock> | undefined;
  const Component = defineComponent({
    setup() {
      exposed = useScrollLock();
      return {};
    },
    template: '<div />',
  });
  const wrapper = mount(Component);
  return { wrapper, get composable() { return exposed!; } };
}

describe('useScrollLock (Vue)', () => {
  afterEach(() => {
    document.body.style.cssText = '';
  });

  it('초기 상태에서 isLocked는 false다', () => {
    const { composable } = mountWithComposable();
    expect(composable.isLocked.value).toBe(false);
  });

  it('lock() 호출 시 isLocked가 true가 된다', async () => {
    const { composable, wrapper } = mountWithComposable();
    composable.lock();
    await wrapper.vm.$nextTick();
    expect(composable.isLocked.value).toBe(true);
  });

  it('unlock() 호출 시 isLocked가 false로 돌아온다', async () => {
    const { composable, wrapper } = mountWithComposable();
    composable.lock();
    await wrapper.vm.$nextTick();
    composable.unlock();
    await wrapper.vm.$nextTick();
    expect(composable.isLocked.value).toBe(false);
  });

  it('lock() 호출 시 body overflow가 hidden으로 설정된다', () => {
    const { composable } = mountWithComposable();
    composable.lock();
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('언마운트 시 잠금 상태가 해제된다', () => {
    const { composable, wrapper } = mountWithComposable();
    composable.lock();
    expect(document.body.style.overflow).toBe('hidden');
    wrapper.unmount();
    expect(document.body.style.overflow).toBe('');
  });
});
