import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebviewHeadlessError } from '../../../errors';
import { createStableInput } from '../stable-input';

describe('createStableInput', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    document.body.innerHTML = '';
  });

  it('에러 없이 초기화된다', () => {
    const instance = createStableInput(container, {});
    expect(instance).toBeDefined();
    instance.destroy();
  });

  it('컨테이너 안에 displayInput이 추가된다', () => {
    const instance = createStableInput(container, {});
    expect(container.querySelector('input')).not.toBeNull();
    instance.destroy();
  });

  it('document.body에 hiddenInput이 직접 추가된다', () => {
    const instance = createStableInput(container, {});
    // hiddenInput은 body 직하위에, displayInput은 container 안에 위치
    const bodyDirectInputs = Array.from(document.body.children).filter(
      (el) => el.tagName === 'INPUT',
    );
    expect(bodyDirectInputs.length).toBe(1);
    instance.destroy();
  });

  it('destroy 후 displayInput과 hiddenInput이 DOM에서 제거된다', () => {
    const instance = createStableInput(container, {});
    instance.destroy();
    expect(container.querySelector('input')).toBeNull();
    expect(document.body.querySelectorAll('input[style]').length).toBe(0);
  });

  it('setValue로 두 인풋의 값이 동시에 변경된다', () => {
    const instance = createStableInput(container, {});
    instance.setValue('hello');
    expect(instance.getValue()).toBe('hello');
    const displayInput = container.querySelector('input') as HTMLInputElement;
    expect(displayInput.value).toBe('hello');
    instance.destroy();
  });

  it('getValue가 현재 값을 반환한다', () => {
    const instance = createStableInput(container, {});
    instance.setValue('world');
    expect(instance.getValue()).toBe('world');
    instance.destroy();
  });

  it('hiddenInput input 이벤트 시 onChange와 displayInput 값이 갱신된다', () => {
    const onChange = vi.fn();
    const instance = createStableInput(container, { onChange });
    const hiddenInput = document.body.querySelector('input[style]') as HTMLInputElement;
    hiddenInput.value = 'test';
    hiddenInput.dispatchEvent(new Event('input'));
    expect(onChange).toHaveBeenCalledWith('test');
    const displayInput = container.querySelector('input') as HTMLInputElement;
    expect(displayInput.value).toBe('test');
    instance.destroy();
  });

  it('hiddenInput focus 시 onFocus 호출 및 displayInput data-focused 설정', () => {
    const onFocus = vi.fn();
    const instance = createStableInput(container, { onFocus });
    const hiddenInput = document.body.querySelector('input[style]') as HTMLInputElement;
    hiddenInput.dispatchEvent(new Event('focus'));
    expect(onFocus).toHaveBeenCalledOnce();
    const displayInput = container.querySelector('input') as HTMLInputElement;
    expect(displayInput.dataset.focused).toBe('true');
    instance.destroy();
  });

  it('hiddenInput blur 시 onBlur 호출 및 displayInput data-focused 제거', () => {
    const onBlur = vi.fn();
    const instance = createStableInput(container, { onBlur });
    const hiddenInput = document.body.querySelector('input[style]') as HTMLInputElement;
    hiddenInput.dispatchEvent(new Event('focus'));
    hiddenInput.dispatchEvent(new Event('blur'));
    expect(onBlur).toHaveBeenCalledOnce();
    const displayInput = container.querySelector('input') as HTMLInputElement;
    expect(displayInput.dataset.focused).toBeUndefined();
    instance.destroy();
  });

  it('Enter 키 입력 시 onSubmit이 현재 값으로 호출된다', () => {
    const onSubmit = vi.fn();
    const instance = createStableInput(container, { onSubmit });
    const hiddenInput = document.body.querySelector('input[style]') as HTMLInputElement;
    hiddenInput.value = 'send this';
    hiddenInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(onSubmit).toHaveBeenCalledWith('send this');
    instance.destroy();
  });

  it('IME 조합 중 Enter(isComposing:true)는 onSubmit을 발화하지 않는다', () => {
    const onSubmit = vi.fn();
    const instance = createStableInput(container, { onSubmit });
    const hiddenInput = document.body.querySelector('input[style]') as HTMLInputElement;
    hiddenInput.value = '한글';

    const ev = new KeyboardEvent('keydown', { key: 'Enter' });
    // happy-dom의 KeyboardEvent 생성자는 isComposing을 반영하지 않으므로 직접 주입
    Object.defineProperty(ev, 'isComposing', { value: true });
    expect(ev.isComposing).toBe(true); // 이벤트에 값이 실제로 실렸는지 자기검증
    hiddenInput.dispatchEvent(ev);

    expect(onSubmit).toHaveBeenCalledTimes(0);
    instance.destroy();
  });

  it('IME 조합 확정 Enter(keyCode:229, isComposing 미채움)는 onSubmit을 발화하지 않는다', () => {
    const onSubmit = vi.fn();
    const instance = createStableInput(container, { onSubmit });
    const hiddenInput = document.body.querySelector('input[style]') as HTMLInputElement;
    hiddenInput.value = '한글';

    // isComposing을 채우지 않는 구형 WebView/Safari 재현 — keyCode 229로만 판별
    const ev = new KeyboardEvent('keydown', { key: 'Enter' });
    Object.defineProperty(ev, 'keyCode', { value: 229 });
    expect(ev.keyCode).toBe(229);
    expect(ev.isComposing).toBe(false);
    hiddenInput.dispatchEvent(ev);

    expect(onSubmit).toHaveBeenCalledTimes(0);
    instance.destroy();
  });

  it('조합 종료 후 일반 Enter는 onSubmit을 정확히 1회 발화한다', () => {
    const onSubmit = vi.fn();
    const instance = createStableInput(container, { onSubmit });
    const hiddenInput = document.body.querySelector('input[style]') as HTMLInputElement;
    hiddenInput.value = '한글';

    // 조합이 끝난 정상 Enter — 가드가 정상 입력까지 막지 않음을 확인
    const ev = new KeyboardEvent('keydown', { key: 'Enter' });
    expect(ev.isComposing).toBe(false);
    expect(ev.keyCode).not.toBe(229);
    hiddenInput.dispatchEvent(ev);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith('한글');
    instance.destroy();
  });

  it('placeholder 옵션이 displayInput과 hiddenInput aria-label에 반영된다', () => {
    const instance = createStableInput(container, { placeholder: '검색어 입력' });
    const displayInput = container.querySelector('input') as HTMLInputElement;
    expect(displayInput.placeholder).toBe('검색어 입력');
    const hiddenInput = document.body.querySelector('input[style]') as HTMLInputElement;
    expect(hiddenInput.getAttribute('aria-label')).toBe('검색어 입력');
    instance.destroy();
  });

  it('[BUG-02] click 시 hiddenInput.focus가 preventScroll:true로 호출된다', () => {
    const focusSpy = vi.spyOn(HTMLInputElement.prototype, 'focus').mockImplementation(() => {});
    const instance = createStableInput(container, {});
    container.dispatchEvent(new MouseEvent('click'));
    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
    instance.destroy();
  });

  it('[BUG-01] container 영역 밖 touchend는 포커스를 트리거하지 않는다', () => {
    const focusSpy = vi.spyOn(HTMLInputElement.prototype, 'focus').mockImplementation(() => {});
    const instance = createStableInput(container, {});

    vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
      top: 100, bottom: 200, left: 50, right: 150,
      width: 100, height: 100, x: 50, y: 100,
      toJSON: () => ({}),
    } as DOMRect);

    // changedTouches를 직접 주입 (TouchEvent 생성자 환경 의존성 우회)
    const outsideTouch = new Event('touchend', { bubbles: true });
    Object.defineProperty(outsideTouch, 'changedTouches', {
      value: [{ clientX: 100, clientY: 50 }], // clientY=50 < rect.top=100
    });
    container.dispatchEvent(outsideTouch);

    expect(focusSpy).not.toHaveBeenCalled();
    instance.destroy();
  });

  it('[BUG-01] container 영역 내 touchend는 preventScroll:true로 포커스를 트리거한다', () => {
    const focusSpy = vi.spyOn(HTMLInputElement.prototype, 'focus').mockImplementation(() => {});
    const instance = createStableInput(container, {});

    vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
      top: 100, bottom: 200, left: 50, right: 150,
      width: 100, height: 100, x: 50, y: 100,
      toJSON: () => ({}),
    } as DOMRect);

    const insideTouch = new Event('touchend', { bubbles: true });
    Object.defineProperty(insideTouch, 'changedTouches', {
      value: [{ clientX: 100, clientY: 150 }], // 경계 안
    });
    container.dispatchEvent(insideTouch);

    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
    instance.destroy();
  });

  describe('탭 / 스크롤 제스처 구분', () => {
    function mockRect() {
      vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
        top: 100, bottom: 200, left: 50, right: 150,
        width: 100, height: 100, x: 50, y: 100,
        toJSON: () => ({}),
      } as DOMRect);
    }

    function dispatchTouch(type: 'touchstart' | 'touchend', x: number, y: number) {
      const event = new Event(type, { bubbles: true, cancelable: true });
      const touches = [{ clientX: x, clientY: y }];
      Object.defineProperty(event, type === 'touchstart' ? 'touches' : 'changedTouches', {
        value: touches,
      });
      container.dispatchEvent(event);
      return event;
    }

    it('touchstart 대비 이동 거리가 slop 이내면 탭으로 간주해 포커스한다', () => {
      const focusSpy = vi.spyOn(HTMLInputElement.prototype, 'focus').mockImplementation(() => {});
      const instance = createStableInput(container, {});
      mockRect();

      dispatchTouch('touchstart', 100, 150);
      dispatchTouch('touchend', 104, 155);

      expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
      instance.destroy();
    });

    it('touchstart 대비 이동 거리가 slop을 넘으면 스크롤로 간주해 포커스하지 않는다', () => {
      const focusSpy = vi.spyOn(HTMLInputElement.prototype, 'focus').mockImplementation(() => {});
      const instance = createStableInput(container, {});
      mockRect();

      // 인풋 위에서 시작한 스크롤이 인풋 위에서 끝나는 시나리오
      dispatchTouch('touchstart', 100, 190);
      const end = dispatchTouch('touchend', 100, 120);

      expect(focusSpy).not.toHaveBeenCalled();
      // 스크롤 제스처의 기본 동작(관성 등)도 막지 않아야 한다
      expect(end.defaultPrevented).toBe(false);
      instance.destroy();
    });

    it('스크롤로 무시된 뒤의 새로운 탭은 정상적으로 포커스한다', () => {
      const focusSpy = vi.spyOn(HTMLInputElement.prototype, 'focus').mockImplementation(() => {});
      const instance = createStableInput(container, {});
      mockRect();

      dispatchTouch('touchstart', 100, 190);
      dispatchTouch('touchend', 100, 120);
      expect(focusSpy).not.toHaveBeenCalled();

      dispatchTouch('touchstart', 100, 150);
      dispatchTouch('touchend', 100, 150);
      expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
      instance.destroy();
    });
  });

  describe('suppressLayoutShift / scrollAnchor (visualViewport resize 보정)', () => {
    type MockVisualViewport = EventTarget & { height: number; width: number };

    let mockVV: MockVisualViewport;
    let originalVVDescriptor: PropertyDescriptor | undefined;
    let scrollByStub: ReturnType<typeof vi.fn>;
    let scrollToStub: ReturnType<typeof vi.fn>;
    let originalScrollBy: typeof window.scrollBy;
    let originalScrollTo: typeof window.scrollTo;

    beforeEach(() => {
      // happy-dom은 visualViewport를 제공하지 않으므로 생성 전에 목 주입 —
      // 등록 조건(window.visualViewport truthy)은 createStableInput 호출 시점에 평가된다.
      mockVV = Object.assign(new EventTarget(), { height: 800, width: 400 });
      originalVVDescriptor = Object.getOwnPropertyDescriptor(window, 'visualViewport');
      Object.defineProperty(window, 'visualViewport', { value: mockVV, configurable: true });

      // 스파이가 아닌 스텁으로 대체 — happy-dom 구현의 부작용 차단
      scrollByStub = vi.fn();
      scrollToStub = vi.fn();
      originalScrollBy = window.scrollBy;
      originalScrollTo = window.scrollTo;
      window.scrollBy = scrollByStub as unknown as typeof window.scrollBy;
      window.scrollTo = scrollToStub as unknown as typeof window.scrollTo;
    });

    afterEach(() => {
      window.scrollBy = originalScrollBy;
      window.scrollTo = originalScrollTo;
      if (originalVVDescriptor) {
        Object.defineProperty(window, 'visualViewport', originalVVDescriptor);
      } else {
        // 원래 own property가 없던 환경 — undefined로 재정의해 truthy 잔존을 방지 (noDelete 룰 준수)
        Object.defineProperty(window, 'visualViewport', { value: undefined, configurable: true });
      }
      vi.restoreAllMocks();
    });

    function mockContainerRect(bottom: number) {
      vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
        top: bottom - 100, bottom, left: 0, right: 400,
        width: 400, height: 100, x: 0, y: bottom - 100,
        toJSON: () => ({}),
      } as DOMRect);
    }

    function focusHiddenInput() {
      const hiddenInput = document.body.querySelector('input[style]') as HTMLInputElement;
      hiddenInput.dispatchEvent(new Event('focus')); // isFocused=true 설정 (기존 테스트 패턴)
    }

    // 키보드 등장 재현: visualViewport 높이 축소 후 resize 디스패치
    function shrinkViewport(height: number) {
      mockVV.height = height;
      mockVV.dispatchEvent(new Event('resize'));
    }

    it("S1: anchor 'bottom'(기본) — overflow만큼 scrollBy({top: overflow+8, behavior: 'instant'}) 1회", () => {
      const instance = createStableInput(container, {}); // 옵션 생략 → 기본 anchor 'bottom'
      focusHiddenInput();
      mockContainerRect(700); // rect.bottom=700
      shrinkViewport(500); // vv.height=500 → overflow 200
      expect(scrollByStub).toHaveBeenCalledTimes(1);
      expect(scrollByStub).toHaveBeenCalledWith({ top: 208, behavior: 'instant' }); // 700−500+8
      expect(scrollToStub).not.toHaveBeenCalled();
      instance.destroy();
    });

    it("S2: anchor 'bottom' — overflow가 없으면(컨테이너가 viewport 안) 스크롤하지 않는다", () => {
      const instance = createStableInput(container, {});
      focusHiddenInput();
      mockContainerRect(400); // rect.bottom=400 < vv.height=500 → overflow < 0
      shrinkViewport(500);
      expect(scrollByStub).not.toHaveBeenCalled();
      expect(scrollToStub).not.toHaveBeenCalled();
      instance.destroy();
    });

    it("S3: scrollAnchor 'top' — scrollTo({top: 0, behavior: 'instant'}) 1회, scrollBy 미호출", () => {
      const instance = createStableInput(container, { scrollAnchor: 'top' });
      focusHiddenInput();
      shrinkViewport(500);
      expect(scrollToStub).toHaveBeenCalledTimes(1);
      expect(scrollToStub).toHaveBeenCalledWith({ top: 0, behavior: 'instant' });
      expect(scrollByStub).not.toHaveBeenCalled();
      instance.destroy();
    });

    it("S4: scrollAnchor 'none' — overflow가 있어도 스크롤 보정을 하지 않는다 (게이트 2)", () => {
      const instance = createStableInput(container, { scrollAnchor: 'none' });
      focusHiddenInput();
      mockContainerRect(700); // overflow 존재 조건
      shrinkViewport(500);
      expect(scrollByStub).not.toHaveBeenCalled();
      expect(scrollToStub).not.toHaveBeenCalled();
      instance.destroy();
    });

    it('S5: 비포커스 상태의 visualViewport resize는 무시된다 (게이트 1)', () => {
      const instance = createStableInput(container, {});
      // focus 없이 resize
      mockContainerRect(700);
      shrinkViewport(500);
      expect(scrollByStub).not.toHaveBeenCalled();
      // blur 후에도 동일
      const hiddenInput = document.body.querySelector('input[style]') as HTMLInputElement;
      hiddenInput.dispatchEvent(new Event('focus'));
      hiddenInput.dispatchEvent(new Event('blur'));
      shrinkViewport(400);
      expect(scrollByStub).not.toHaveBeenCalled();
      expect(scrollToStub).not.toHaveBeenCalled();
      instance.destroy();
    });

    it('S6: suppressLayoutShift:false — visualViewport resize 리스너 자체가 등록되지 않는다', () => {
      const addSpy = vi.spyOn(mockVV, 'addEventListener');
      const instance = createStableInput(container, { suppressLayoutShift: false });
      expect(addSpy.mock.calls.some((call) => call[0] === 'resize')).toBe(false);
      focusHiddenInput();
      mockContainerRect(700);
      shrinkViewport(500);
      expect(scrollByStub).not.toHaveBeenCalled();
      expect(scrollToStub).not.toHaveBeenCalled();
      instance.destroy();
    });

    it('S7: destroy 시 visualViewport resize 리스너가 해제된다', () => {
      const instance = createStableInput(container, {});
      focusHiddenInput();
      mockContainerRect(700);
      const removeSpy = vi.spyOn(mockVV, 'removeEventListener');
      instance.destroy();
      expect(removeSpy.mock.calls.some((call) => call[0] === 'resize')).toBe(true);
      shrinkViewport(500); // destroy 후 resize → 보정 없음
      expect(scrollByStub).not.toHaveBeenCalled();
      expect(scrollToStub).not.toHaveBeenCalled();
    });

    it('S8: visualViewport 부재 환경 — 정상 생성되고 focus/destroy가 throw하지 않는다', () => {
      Object.defineProperty(window, 'visualViewport', { value: undefined, configurable: true });
      const instance = createStableInput(container, {});
      expect(() => instance.focus()).not.toThrow();
      // visualViewport가 없어도 포커스 계약은 유지된다 — hidden input이 실제 포커스를 받는다 (B-22)
      const hiddenInput = document.body.querySelector('input[style]') as HTMLInputElement;
      expect(document.activeElement).toBe(hiddenInput);
      // resize 경로 자체가 없으므로 scroll 스텁은 어떤 경우에도 미호출
      expect(scrollByStub).not.toHaveBeenCalled();
      expect(scrollToStub).not.toHaveBeenCalled();
      expect(() => instance.destroy()).not.toThrow();
    });
  });

  describe('[B-25] 옵션 검증 (validateOptions)', () => {
    it('[B-25] S1: 잘못된 scrollAnchor는 WebviewHeadlessError를 던진다', () => {
      expect(() => createStableInput(container, { scrollAnchor: 'middle' as never })).toThrow(
        WebviewHeadlessError,
      );
      expect(() => createStableInput(container, { scrollAnchor: 'middle' as never })).toThrow(
        /scrollAnchor/,
      );
      // 유효값 3종은 throw 없이 정상 생성된다 — 검증 분기 양쪽 커버
      for (const anchor of ['top', 'bottom', 'none'] as const) {
        const instance = createStableInput(container, { scrollAnchor: anchor });
        expect(instance).toBeDefined();
        instance.destroy();
      }
    });

    it('[B-25] S2: container가 HTMLElement가 아니면 WebviewHeadlessError를 던진다', () => {
      expect(() => createStableInput(null as never, {})).toThrow(WebviewHeadlessError);
      expect(() => createStableInput(null as never, {})).toThrow(/container/);
    });
  });

  it('SSR 환경(window undefined)에서 no-op 인스턴스를 반환한다', () => {
    const original = globalThis.window;
    // SSR 시뮬레이션 — typeof window === 'undefined' 분기 진입
    (globalThis as { window?: unknown }).window = undefined;
    const instance = createStableInput(container, {});
    expect(() => instance.focus()).not.toThrow();
    expect(() => instance.setValue('x')).not.toThrow();
    expect(instance.getValue()).toBe('');
    expect(() => instance.destroy()).not.toThrow();
    // destroy 후에도 noop getter 값이 유지된다 (B-22)
    expect(instance.getValue()).toBe('');
    globalThis.window = original;
  });
});
