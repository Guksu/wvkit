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
      thresholds: {
        '**/camera-control.ts': { branches: 55, functions: 90 },
        '**/pull-to-refresh.ts': { branches: 80, functions: 85 },
        '**/stable-input.ts': { branches: 85, functions: 75 },
      },
    },
  },
});
