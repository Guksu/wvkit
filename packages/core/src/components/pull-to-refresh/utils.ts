/**
 * PullToRefresh 순수 함수 모음 — `pull-to-refresh.ts` 내부 사용 + 단위 테스트 직접 검증용.
 * (외부 공개 API는 아니므로 패키지 entrypoint에서 export하지 않음)
 */

/**
 * 저항 수식: rawDelta가 클수록 점진적으로 감쇠. `[0, maxDistance]` 로 클램프.
 *
 *   damped = rawDelta * (1 / (1 + resistance * rawDelta / maxDistance))
 *
 * - `rawDelta <= 0`: 위로 당김 / 미동작 → 0 반환 (PTR은 아래로 당기는 동작만 처리)
 * - `resistance = 0`: 감쇠 없음 (선형) — 다만 maxDistance에서 hard clamp
 * - `resistance = 1`: 강한 감쇠
 */
export function applyResistance(
  rawDelta: number,
  maxDistance: number,
  resistance: number,
): number {
  if (rawDelta <= 0) return 0;
  const damped = rawDelta * (1 / (1 + (resistance * rawDelta) / maxDistance));
  return Math.min(damped, maxDistance);
}

/**
 * easeOutCubic — reset 트윈에서 사용. `t ∈ [0, 1]` → 끝에서 감속하는 곡선.
 */
export function easeOutCubic(t: number): number {
  const u = 1 - t;
  return 1 - u * u * u;
}
