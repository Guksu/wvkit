export interface StableInputOptions {
  type?: string;
  placeholder?: string;
  inputMode?: string;
  autocomplete?: string;
  onFocus?: () => void;
  onBlur?: () => void;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
  /** 키보드 등장 시 레이아웃 이동 억제 여부. 기본값 true */
  suppressLayoutShift?: boolean;
  /** 키보드 등장 시 컨테이너 스크롤 앵커. 기본값 'bottom' */
  scrollAnchor?: 'top' | 'bottom' | 'none';
}

export interface StableInputInstance {
  focus(): void;
  blur(): void;
  setValue(value: string): void;
  getValue(): string;
  destroy(): void;
}
