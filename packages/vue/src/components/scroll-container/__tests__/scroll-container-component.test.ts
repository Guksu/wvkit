import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { createSSRApp, defineComponent, h, nextTick, onMounted, ref } from 'vue';
import { renderToString } from 'vue/server-renderer';
import {
  ScrollContainer,
  type ScrollContainerHandle,
  ScrollPanel,
} from '../scroll-container-component';

/**
 * 컴포넌트 API — <ScrollContainer> + <ScrollPanel> (Vue).
 * happy-dom 은 레이아웃이 없어 host 폭이 0 → core 는 1px 로 본다. 패널 i 의 중심 x = i (gap 0) 로 순서를 읽는다.
 */

function sceneOf(host: Element): HTMLElement | null {
  const renderer = Array.from(host.children).find((c) => !(c as HTMLElement).hidden) as
    | HTMLElement
    | undefined;
  return (renderer?.firstElementChild as HTMLElement | null | undefined) ?? null;
}

function panelTexts(host: Element): string[] {
  const scene = sceneOf(host);
  if (!scene) return [];
  return Array.from(scene.children)
    .map((p) => ({
      x: Number(
        /translate\((-?[\d.]+)px/.exec((p as HTMLElement).style.transform)?.[1] ?? Number.NaN,
      ),
      text: (p.textContent ?? '').trim(),
    }))
    .sort((a, b) => a.x - b.x)
    .map((p) => p.text);
}

function makeApp() {
  const items = ref(['a', 'b', 'c']);
  const gap = ref(0);
  const showMiddle = ref(true);
  const events: number[] = [];
  const sc = ref<ScrollContainerHandle | null>(null);
  const App = defineComponent({
    components: { ScrollContainer, ScrollPanel },
    setup() {
      return { items, gap, showMiddle, sc, onIndex: (i: number) => events.push(i) };
    },
    template: `
      <ScrollContainer ref="sc" direction="horizontal" class="pager" data-testid="host"
        :gap="gap" :overscan="10" :initial-index="1" @index-change="onIndex">
        <ScrollPanel v-for="t in items" :key="t" class="inner"><p>{{ t }}</p></ScrollPanel>
      </ScrollContainer>`,
  });
  return { App, items, gap, showMiddle, events, sc };
}

describe('ScrollContainer · ScrollPanel (Vue 컴포넌트)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('V1: 자식 순서대로 패널을 만들고 내용은 core scene 안에 그린다 · class 와 기본 스타일', async () => {
    const { App } = makeApp();
    const wrapper = mount(App, { attachTo: document.body });
    await nextTick();
    const host = wrapper.element as HTMLElement;
    expect(host.className).toBe('pager');
    expect(host.style.position).toBe('relative');
    expect(host.style.touchAction).toBe('none');
    expect(panelTexts(host)).toEqual(['a', 'b', 'c']);
    // ScrollPanel 의 class 는 포털 안 내용 요소로
    expect(sceneOf(host)?.querySelector('.inner')).not.toBeNull();
    wrapper.unmount();
  });

  it('V2: 보던 패널 앞에 끼워 넣으면 index-change(새 번호) · 다시 마운트 없음', async () => {
    const { App, items, events } = makeApp();
    const wrapper = mount(App, { attachTo: document.body });
    await nextTick();
    const host = wrapper.element as HTMLElement;
    const renderer = sceneOf(host)?.parentElement;
    items.value = ['new', ...items.value];
    await nextTick();
    await nextTick();
    expect(panelTexts(host)).toEqual(['new', 'a', 'b', 'c']);
    expect(events[events.length - 1]).toBe(2);
    expect(sceneOf(host)?.parentElement).toBe(renderer);
    wrapper.unmount();
  });

  it('V3: v-if 로 가운데 패널을 넣었다 빼도 화면에 쓴 순서를 따른다', async () => {
    const show = ref(false);
    const App = defineComponent({
      components: { ScrollContainer, ScrollPanel },
      setup: () => ({ show }),
      template: `
        <ScrollContainer direction="horizontal" :overscan="10">
          <ScrollPanel>a</ScrollPanel>
          <ScrollPanel v-if="show">b</ScrollPanel>
          <ScrollPanel>c</ScrollPanel>
        </ScrollContainer>`,
    });
    const wrapper = mount(App, { attachTo: document.body });
    await nextTick();
    expect(panelTexts(wrapper.element)).toEqual(['a', 'c']);
    show.value = true;
    await nextTick();
    await nextTick();
    expect(panelTexts(wrapper.element)).toEqual(['a', 'b', 'c']);
    wrapper.unmount();
  });

  it('V4: 옵션 prop 을 바꾸면 같은 인스턴스가 반영한다 (gap)', async () => {
    const { App, gap } = makeApp();
    const wrapper = mount(App, { attachTo: document.body });
    await nextTick();
    const second = () =>
      Array.from(sceneOf(wrapper.element)?.children ?? []).find(
        (p) => (p.textContent ?? '').trim() === 'b',
      ) as HTMLElement;
    expect(second().style.transform).toContain('translate(1px, 0px)');
    gap.value = 10;
    await nextTick();
    await nextTick();
    expect(second().style.transform).toContain('translate(11px, 0px)');
    wrapper.unmount();
  });

  it('V5: 패널이 모두 없어지면 렌더러를 거두고, 다시 생기면 만든다', async () => {
    const { App, items } = makeApp();
    const wrapper = mount(App, { attachTo: document.body });
    await nextTick();
    items.value = [];
    await nextTick();
    await nextTick();
    expect(sceneOf(wrapper.element)).toBeNull();
    items.value = ['z'];
    await nextTick();
    await nextTick();
    expect(panelTexts(wrapper.element)).toEqual(['z']);
    wrapper.unmount();
  });

  it('V6: 템플릿 ref 핸들로 scrollTo · getActiveIndex', async () => {
    const { App, sc, events } = makeApp();
    const wrapper = mount(App, { attachTo: document.body });
    await nextTick();
    sc.value?.scrollTo(0, { animated: false });
    expect(events[events.length - 1]).toBe(0);
    expect(sc.value?.getActiveIndex()).toBe(0);
    expect(sc.value?.getZoom()).toBe(1);
    wrapper.unmount();
  });

  it('V7: label 은 패널 요소의 aria-label — 없으면 a11y 의 "n / N"', async () => {
    const App = defineComponent({
      components: { ScrollContainer, ScrollPanel },
      template: `
        <ScrollContainer direction="horizontal" :overscan="10">
          <ScrollPanel label="추천">a</ScrollPanel>
          <ScrollPanel>b</ScrollPanel>
        </ScrollContainer>`,
    });
    const wrapper = mount(App, { attachTo: document.body });
    await nextTick();
    const panels = Array.from(sceneOf(wrapper.element)?.children ?? []);
    const byText = (t: string) => panels.find((p) => (p.textContent ?? '').trim() === t);
    expect(byText('a')?.getAttribute('aria-label')).toBe('추천');
    expect(byText('b')?.getAttribute('aria-label')).toBe('2 / 2');
    wrapper.unmount();
  });

  it('V8: 빠진 불리언 prop 은 core 기본값 그대로 (keyboard·a11y 켜짐)', async () => {
    const App = defineComponent({
      components: { ScrollContainer, ScrollPanel },
      template: `<ScrollContainer direction="horizontal"><ScrollPanel>a</ScrollPanel></ScrollContainer>`,
    });
    const wrapper = mount(App, { attachTo: document.body });
    await nextTick();
    const host = wrapper.element as HTMLElement;
    expect(host.getAttribute('tabindex')).toBe('0'); // keyboard 기본 true
    expect(host.getAttribute('aria-roledescription')).toBe('carousel'); // a11y 기본 true
    wrapper.unmount();
  });

  it('V9: SSR — 서버 렌더는 오류 없이 host 와 표시 요소만 (패널 내용은 브라우저에서)', async () => {
    const app = createSSRApp({
      render: () =>
        h(ScrollContainer, { direction: 'horizontal' }, () => [
          h(ScrollPanel, null, () => h('p', null, 'a')),
        ]),
    });
    const html = await renderToString(app);
    expect(html).toContain('data-scroll-panel');
    expect(html).not.toContain('<p>a</p>');
  });

  it('V10: 언마운트하면 인스턴스를 정리한다 (core 렌더러가 남지 않음)', async () => {
    const { App } = makeApp();
    const wrapper = mount(App, { attachTo: document.body });
    await nextTick();
    const host = wrapper.element as HTMLElement;
    expect(sceneOf(host)).not.toBeNull();
    wrapper.unmount();
    expect(sceneOf(host)).toBeNull();
  });

  /** 마운트될 때 id 를 기록하는 패널 내용 */
  const Probe = defineComponent({
    props: { id: { type: String, required: true }, log: { type: Array, required: true } },
    setup(props) {
      onMounted(() => (props.log as string[]).push(props.id));
      return () => h('p', null, props.id);
    },
  });

  function makeLazyApp(opts: { lazy?: boolean; onVis?: (i: number, v: boolean) => void }) {
    const log: string[] = [];
    const sc = ref<ScrollContainerHandle | null>(null);
    const App = defineComponent({
      setup() {
        return () =>
          h(
            ScrollContainer,
            {
              ref: sc,
              direction: 'horizontal',
              overscan: 0,
              ...(opts.lazy !== undefined && { lazy: opts.lazy }),
              ...(opts.onVis && {
                onPanelVisibilityChange: (i: number, v: boolean) => opts.onVis?.(i, v),
              }),
            },
            () => ['a', 'b', 'c', 'd'].map((id) => h(ScrollPanel, { key: id }, () => h(Probe, { id, log }))),
          );
      },
    });
    return { App, log, sc };
  }

  it('V11: lazy 면 패널 내용을 처음 렌더 창에 들어올 때 마운트하고, 그 뒤로는 유지한다', async () => {
    const { App, log, sc } = makeLazyApp({ lazy: true });
    const wrapper = mount(App, { attachTo: document.body });
    await nextTick();
    await nextTick();
    expect(log).toEqual(['a']); // overscan 0 → 활성 패널만
    sc.value?.scrollTo(2, { animated: false });
    await nextTick();
    expect(log).toEqual(['a', 'c']); // 건너뛴 b 는 마운트하지 않는다
    sc.value?.scrollTo(0, { animated: false });
    await nextTick();
    expect(log).toEqual(['a', 'c']); // a 는 계속 마운트돼 있다
    wrapper.unmount();
  });

  it('V12: lazy 를 켜지 않으면 지금처럼 모든 패널 내용을 처음부터 마운트한다', async () => {
    const { App, log } = makeLazyApp({});
    const wrapper = mount(App, { attachTo: document.body });
    await nextTick();
    await nextTick();
    expect([...log].sort()).toEqual(['a', 'b', 'c', 'd']);
    wrapper.unmount();
  });

  it('V13: panel-visibility-change 이벤트는 core 알림을 그대로 받는다', async () => {
    const calls: Array<[number, boolean]> = [];
    const { App, sc } = makeLazyApp({ onVis: (i, v) => calls.push([i, v]) });
    const wrapper = mount(App, { attachTo: document.body });
    await nextTick();
    expect(calls).toEqual([[0, true]]);
    sc.value?.scrollTo(1, { animated: false });
    expect(calls).toEqual([
      [0, true],
      [0, false],
      [1, true],
    ]);
    wrapper.unmount();
  });
});
