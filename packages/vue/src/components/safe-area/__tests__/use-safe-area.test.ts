import { describe, it, expect, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent } from 'vue';
import { useSafeArea } from '../use-safe-area';

function mountWithComposable() {
  let exposedInsets: ReturnType<typeof useSafeArea> | undefined;
  const Component = defineComponent({
    setup() {
      exposedInsets = useSafeArea();
      return {};
    },
    template: '<div />',
  });
  const wrapper = mount(Component);
  return { wrapper, get insets() { return exposedInsets!; } };
}

describe('useSafeArea (Vue)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('초기 인셋 0을 반환한다', () => {
    const { insets } = mountWithComposable();
    expect(insets.value).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });

  it('마운트 후 getInsets() 결과로 갱신된다', async () => {
    const { insets, wrapper } = mountWithComposable();
    await wrapper.vm.$nextTick();
    expect(insets.value).toHaveProperty('top');
    expect(typeof insets.value.top).toBe('number');
  });

  it('언마운트 시 에러 없이 정리된다', () => {
    const childrenBefore = document.body.children.length;
    const { wrapper } = mountWithComposable();
    // 마운트가 sentinel을 body에 추가했다는 전제 확인 — 아래 제거 단언이 공허해지지 않게
    expect(document.body.children.length).toBe(childrenBefore + 1);
    expect(() => wrapper.unmount()).not.toThrow();
    // destroy 실행 증거 — sentinel이 body에서 제거된다 (B-22)
    expect(document.body.children.length).toBe(childrenBefore);
  });
});
