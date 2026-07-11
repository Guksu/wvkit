import { describe, it, expect, vi, afterEach } from 'vitest';
import { createVirtualKeyboard } from '../virtual-keyboard';

function mockVisualViewport(width: number, height: number) {
  // 소스는 visualViewport.width/height를 모두 읽는다 — width 부재 시 window.innerWidth 폴백에
  // 빠져 회전 휴리스틱(:34)이 검증 불가하므로 width를 반드시 포함한다. mutable로 두고
  // makeFire()로 감싸 회전/키보드 시나리오를 재현한다.
  const vp = {
    width,
    height,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  Object.defineProperty(window, 'visualViewport', {
    value: vp,
    writable: true,
    configurable: true,
  });
  return vp;
}

/** vp.addEventListener로 등록된 'resize' 핸들러를 capture해 (width, height) 갱신 + 발화 헬퍼로 감싼다. */
function makeFire(vp: ReturnType<typeof mockVisualViewport>) {
  const call = vp.addEventListener.mock.calls.find((c) => c[0] === 'resize');
  const handler = call?.[1] as EventListener | undefined;
  if (!handler) throw new Error('resize handler not registered on visualViewport');
  return (width: number, height: number) => {
    vp.width = width;
    vp.height = height;
    handler(new Event('resize'));
  };
}

function clearVisualViewport() {
  Object.defineProperty(window, 'visualViewport', {
    value: null,
    writable: true,
    configurable: true,
  });
}

describe('createVirtualKeyboard', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    clearVisualViewport();
  });

  it('에러 없이 초기화된다', () => {
    const instance = createVirtualKeyboard();
    expect(instance).toBeDefined();
    instance.destroy();
  });

  it('초기 상태에서 isOpen은 false, keyboardHeight는 0이다', () => {
    const instance = createVirtualKeyboard();
    expect(instance.isOpen).toBe(false);
    expect(instance.keyboardHeight).toBe(0);
    instance.destroy();
  });

  it('visualViewport가 있으면 resize 이벤트를 구독한다', () => {
    const vp = mockVisualViewport(390, 800);
    const instance = createVirtualKeyboard();
    expect(vp.addEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
    instance.destroy();
  });

  it('destroy 호출 시 visualViewport 리스너가 제거된다', () => {
    const vp = mockVisualViewport(390, 800);
    const instance = createVirtualKeyboard();
    instance.destroy();
    expect(vp.removeEventListener).toHaveBeenCalled();
  });

  it('visualViewport 없으면 window resize 폴백을 사용한다', () => {
    clearVisualViewport();
    const addSpy = vi.spyOn(window, 'addEventListener');
    const instance = createVirtualKeyboard();
    expect(addSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    instance.destroy();
  });

  it('뷰포트 높이가 threshold 이상 감소하면 onChange가 호출된다', () => {
    clearVisualViewport();
    const onChange = vi.fn();
    const baseHeight = window.innerHeight;
    const instance = createVirtualKeyboard({ onChange });

    Object.defineProperty(window, 'innerHeight', { value: baseHeight - 300, writable: true, configurable: true });
    window.dispatchEvent(new Event('resize'));

    expect(onChange).toHaveBeenCalledWith({ isOpen: true, keyboardHeight: 300 });
    instance.destroy();
    Object.defineProperty(window, 'innerHeight', { value: baseHeight, writable: true, configurable: true });
  });

  it('threshold 미만 변화에는 onChange가 호출되지 않는다', () => {
    clearVisualViewport();
    const onChange = vi.fn();
    const baseHeight = window.innerHeight;
    const instance = createVirtualKeyboard({ onChange, threshold: 150 });

    Object.defineProperty(window, 'innerHeight', { value: baseHeight - 50, writable: true, configurable: true });
    window.dispatchEvent(new Event('resize'));

    expect(onChange).not.toHaveBeenCalled();
    instance.destroy();
    Object.defineProperty(window, 'innerHeight', { value: baseHeight, writable: true, configurable: true });
  });

  it('동일한 상태에서는 onChange가 중복 호출되지 않는다', () => {
    clearVisualViewport();
    const onChange = vi.fn();
    const instance = createVirtualKeyboard({ onChange });
    window.dispatchEvent(new Event('resize'));
    window.dispatchEvent(new Event('resize'));
    expect(onChange).not.toHaveBeenCalled();
    instance.destroy();
  });

  it('키보드가 열린 상태에서 생성돼도 키보드가 닫히면 기준 높이가 회복된다', () => {
    clearVisualViewport();
    const onChange = vi.fn();
    const fullHeight = 800;
    const setInnerHeight = (value: number) =>
      Object.defineProperty(window, 'innerHeight', { value, writable: true, configurable: true });

    // 키보드가 이미 열린(축소된) 뷰포트에서 인스턴스 생성 — baseHeight 오염 시나리오
    setInnerHeight(fullHeight - 300);
    const instance = createVirtualKeyboard({ onChange });

    // 키보드 닫힘: 뷰포트가 기준보다 커짐 → 기준 높이가 전체 높이로 갱신돼야 함
    setInnerHeight(fullHeight);
    window.dispatchEvent(new Event('resize'));
    expect(onChange).not.toHaveBeenCalled();
    expect(instance.isOpen).toBe(false);

    // 이후 키보드가 다시 열리면 정상적으로 감지돼야 함 (수정 전에는 delta=0으로 감지 불능)
    setInnerHeight(fullHeight - 300);
    window.dispatchEvent(new Event('resize'));
    expect(onChange).toHaveBeenCalledWith({ isOpen: true, keyboardHeight: 300 });

    instance.destroy();
    setInnerHeight(fullHeight);
  });

  it('rotate — 회전(너비·높이 스왑) 중 높이 감소를 키보드로 오검출하지 않는다', () => {
    const onChange = vi.fn();
    const vp = mockVisualViewport(390, 844);
    const instance = createVirtualKeyboard({ onChange });
    const fire = makeFire(vp);

    // portrait 390×844 → landscape 844×390: delta 454 > threshold(100)이지만
    // 너비가 변했으므로 회전으로 판정 → baseHeight 재설정(:34-37), 키보드 아님
    fire(844, 390);

    expect(instance.isOpen).toBe(false);
    expect(instance.keyboardHeight).toBe(0);
    // 상태 무변화 → 조기 리턴(:49)으로 onChange 미호출
    expect(onChange).not.toHaveBeenCalled();
    instance.destroy();
  });

  it('rotate — 회전 후 새 baseHeight 기준으로 키보드를 정상 검출한다', () => {
    const onChange = vi.fn();
    const vp = mockVisualViewport(390, 844);
    const instance = createVirtualKeyboard({ onChange });
    const fire = makeFire(vp);

    fire(844, 390); // 회전 — 새 기준 844×390
    fire(844, 90); // 너비 유지, 높이 300 감소 = 키보드

    expect(instance.isOpen).toBe(true);
    // 새 기준 390 대비 300 — 옛 기준 844 대비 754가 아님
    expect(instance.keyboardHeight).toBe(300);
    expect(onChange).toHaveBeenCalledWith({ isOpen: true, keyboardHeight: 300 });
    instance.destroy();
  });

  it('rotate — 키보드 열린 채 회전하면 닫힘으로 리셋 통지한다', () => {
    const onChange = vi.fn();
    const vp = mockVisualViewport(390, 844);
    const instance = createVirtualKeyboard({ onChange });
    const fire = makeFire(vp);

    // 키보드 열림: 844 → 500 (delta 344 > threshold)
    fire(390, 500);
    expect(instance.isOpen).toBe(true);
    expect(instance.keyboardHeight).toBe(344);

    // 열린 채 회전 → 기준 재설정 → 닫힘 상태로 리셋 통지
    fire(844, 390);
    expect(onChange).toHaveBeenLastCalledWith({ isOpen: false, keyboardHeight: 0 });
    expect(instance.isOpen).toBe(false);
    expect(instance.keyboardHeight).toBe(0);
    instance.destroy();
  });

  it('SSR 환경(window undefined)에서 no-op 인스턴스를 반환한다', () => {
    const original = globalThis.window;
    // SSR 시뮬레이션 — typeof window === 'undefined' 분기 진입
    (globalThis as { window?: unknown }).window = undefined;
    const instance = createVirtualKeyboard();
    expect(instance.isOpen).toBe(false);
    expect(instance.keyboardHeight).toBe(0);
    expect(() => instance.destroy()).not.toThrow();
    // destroy 후에도 getter 값이 유지된다 (B-22)
    expect(instance.isOpen).toBe(false);
    expect(instance.keyboardHeight).toBe(0);
    globalThis.window = original;
  });
});
