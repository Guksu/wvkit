---
"@guksu/wvkit-core": minor
"@guksu/wvkit-react": minor
"@guksu/wvkit-vue": minor
---

Trust fixes: export `WebviewHeadlessError` as a runtime value from all three barrels (core + react/vue re-export) so consumers can identify library errors via `instanceof`; relax `three` peer range from `^0.184.0` to `>=0.160.0` (floor verified by typecheck/build/test matrix); fix stale `@wvkit/core` external in react/vue tsup configs to `@guksu/wvkit-core`.
