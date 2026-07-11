import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      // 회귀 위험이 높은 3개 핫스팟만 glob per-file 하한으로 잠근다.
      // 실측 스냅샷보다 약간 낮게 설정해 현재 상태를 즉시 통과시키되,
      // 커버리지가 하한 아래로 떨어지면 CI를 빨간불로 만든다.
      // threshold는 --coverage로 실행될 때만 평가된다(ci.yml Coverage gate 스텝).
      // Sprint 2(core-behavior-tests) 램프: 실측 − 2~3%p.
      // 실측(2026-07-10): camera-control branches 84.26 / functions 94.73,
      //                   stable-input branches 92.59 / functions 85.71.
      // stable-input functions는 플로어(≥85)가 실측−2~3%p보다 높아 플로어로 고정.
      // Sprint 5(touch-contracts) 램프: pull-to-refresh 실측 branches 90.07 / functions 100 → −2%p 내림.
      // Sprint 8(residual-test-gaps) 램프: camera-control 트윈 테스트(T-01) 추가 후
      // 실측 branches 84.04 / functions 100 → −2%p 내림.
      thresholds: {
        '**/camera-control.ts': { branches: 82, functions: 98 },
        '**/pull-to-refresh.ts': { branches: 88, functions: 98 },
        '**/stable-input.ts': { branches: 90, functions: 85 },
      },
    },
  },
});
