# three peer 하한 실측 매트릭스 (T-03 / B-12)

- 측정일: 2026-07-10, 브랜치 sprint/20260710-trust-fixes
- 방법: core devDependencies의 `three`·`@types/three`를 후보 버전으로 임시 교체
  (`pnpm --filter @guksu/wvkit-core add -D three@<v> @types/three@<v>`) 후
  typecheck / build / test 실행, 전부 exit 0이면 하한 성립.
- 사용 API 표면: `scroll-container.ts`의 `OrthographicCamera`, `Scene`,
  `CSS3DObject`/`CSS3DRenderer`(`three/examples/jsm/renderers/CSS3DRenderer.js`)뿐.
  `camera-control.ts`는 type-only import.

## 실측 결과

| 후보 버전 | 명령 | 결과 |
|-----------|------|------|
| three@0.160.0 + @types/three@0.160.0 | `pnpm --filter @guksu/wvkit-core typecheck` | exit 0 |
| three@0.160.0 + @types/three@0.160.0 | `pnpm --filter @guksu/wvkit-core build` | exit 0 |
| three@0.160.0 + @types/three@0.160.0 | `pnpm --filter @guksu/wvkit-core test` | exit 0 |

첫 후보 `0.160.0`(감사 제안)에서 3개 명령 모두 exit 0 → 상향 시도 불필요, 하한으로 즉시 채택.

## 원복 재확인 (현행 three@^0.184.0)

| 명령 | 결과 |
|------|------|
| `pnpm --filter @guksu/wvkit-core typecheck` | exit 0 |
| `pnpm --filter @guksu/wvkit-core test` | exit 0 |
| `pnpm --filter @guksu/wvkit-core build` | exit 0 |

## 결정

- `packages/core/package.json` `peerDependencies.three`: `"^0.184.0"` → `">=0.160.0"`
- `peerDependenciesMeta.three.optional: true` 유지
- devDependencies는 현행 최신(`three@^0.184.0`, `@types/three@^0.184.0`)으로 원복 완료
