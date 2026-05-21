/**
 * PullToRefresh 상태 머신.
 *
 * 전이도:
 * ```
 * idle      → (touchstart, scrollTop===0, enabled) → pulling
 * pulling   → (distance ≥ threshold)              → armed
 * pulling   → (release, distance < threshold)     → resetting → idle
 * armed     → (release)                            → refreshing
 * refreshing→ (onRefresh resolved/returned)       → resetting → idle
 * refreshing→ (onRefresh rejected/threw)          → console.error + resetting → idle
 * ```
 */
export type PullToRefreshState = 'idle' | 'pulling' | 'armed' | 'refreshing' | 'resetting';

export interface PullToRefreshOptions {
  /** 새로고침 수행 콜백. Promise 반환 시 동안 `refreshing` 유지, void 즉시 `resetting`. */
  onRefresh: () => Promise<void> | void;
  /** 새로고침 트리거 거리(px). 기본값 `60`. */
  threshold?: number;
  /** 최대 당김 거리(px). 기본값 `120`. */
  maxDistance?: number;
  /** 저항 계수 (`0` ≤ x ≤ `1`). 기본값 `0.5`. */
  resistance?: number;
  /** 활성화 여부. 기본값 `true`. */
  enabled?: boolean;
  /**
   * native PTR 차단용 `overscroll-behavior: contain` 자동 적용 opt-out. 기본값 `false`.
   * (false → 자동 적용. 사용자가 직접 제어하고 싶을 때만 `true`로.)
   */
  disableOverscrollContain?: boolean;
  /** 상태 전이 발생 시 호출. 중복 호출 방지. */
  onStateChange?: (state: PullToRefreshState) => void;
  /** 당김 거리 변경 시 호출. `progress = distance / threshold` (0~). */
  onPull?: (distance: number, progress: number) => void;
}

export interface PullToRefreshInstance {
  /** 리스너/RAF 정리 + `overscroll-behavior` 원래 값 복원. 멱등성 보장. */
  destroy(): void;
  /** 현재 상태 머신 값 반환. */
  getState(): PullToRefreshState;
  /**
   * 외부에서 강제로 새로고침 실행. `refreshing` 진입 → `onRefresh` 호출 → `resetting` → `idle`.
   * 진행 중이면 동시 호출 차단.
   */
  trigger(): Promise<void>;
  /** 활성/비활성 토글. `false`이면 새 pull 트리거 차단 (진행 중인 작업은 계속). */
  setEnabled(enabled: boolean): void;
}
