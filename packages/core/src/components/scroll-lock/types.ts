export interface ScrollLockOptions {
  onLock?: () => void;
  onUnlock?: () => void;
  /**
   * 잠금 중에도 터치 스크롤을 허용할 영역 (CSS 선택자 또는 엘리먼트).
   * 해당 영역 안에서 발생한 touchmove는 preventDefault하지 않는다 —
   * 모달/바텀시트 내부 스크롤 영역을 살리는 용도.
   */
  allowScrollWithin?: string | HTMLElement;
}

export interface ScrollLockInstance {
  lock(): void;
  unlock(): void;
  readonly isLocked: boolean;
  destroy(): void;
}
