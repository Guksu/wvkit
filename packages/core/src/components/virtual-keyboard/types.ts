export interface VirtualKeyboardState {
  isOpen: boolean;
  keyboardHeight: number;
}

export interface VirtualKeyboardOptions {
  onChange?: (state: VirtualKeyboardState) => void;
  /** 키보드 감지 최소 높이 변화 (px). 기본값 100 */
  threshold?: number;
}

export interface VirtualKeyboardInstance {
  readonly isOpen: boolean;
  readonly keyboardHeight: number;
  destroy(): void;
}
