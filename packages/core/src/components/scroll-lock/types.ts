export interface ScrollLockOptions {
  onLock?: () => void;
  onUnlock?: () => void;
}

export interface ScrollLockInstance {
  lock(): void;
  unlock(): void;
  readonly isLocked: boolean;
  destroy(): void;
}
