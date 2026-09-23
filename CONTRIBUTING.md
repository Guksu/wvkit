# Contributing to wvkit

Thanks for your interest in contributing! wvkit is a pnpm + Turborepo monorepo publishing three packages: `@guksu/wvkit-core`, `@guksu/wvkit-react`, and `@guksu/wvkit-vue`.

## Setup

Requirements: Node.js 22+ and [pnpm](https://pnpm.io/) 9+. (The library itself runs on Node 18+; the bundle size gate `pnpm size` uses `size-limit` 14, which needs Node 22.)

```bash
git clone https://github.com/Guksu/wvkit.git
cd wvkit
pnpm install
```

## Build

```bash
# Build all packages
pnpm build

# Build a single package (use the real package name)
pnpm --filter @guksu/wvkit-core build

# Watch mode during development
pnpm dev
```

## Test

```bash
# Unit tests (Vitest) — all packages, includes core coverage thresholds
pnpm test

# Single package
pnpm --filter @guksu/wvkit-react test

# E2E (Playwright) — first run needs browsers installed
pnpm exec playwright install chromium webkit
pnpm test:e2e

# E2E single project (debugging) / HTML report of the last run
pnpm test:e2e:chromium
pnpm test:e2e:report
```

For on-device WebView testing (iOS Simulator / Android Emulator) and the full testing guide, see [TESTING.md](TESTING.md).

## Lint & Type Check

```bash
pnpm lint       # Biome
pnpm typecheck  # TypeScript strict mode
```

All three of `pnpm test`, `pnpm lint`, and `pnpm typecheck` must pass before a PR can be merged.

## Package Gates

CI also runs two checks against the built `dist` (run `pnpm build` first):

```bash
pnpm size          # size-limit: each entry bundled with esbuild + compressed must stay under .size-limit.json
pnpm verify:deps   # zero runtime deps: dist loads in a directory with no node_modules; adapters reference only peers
```

Raise a limit in `.size-limit.json` only when the PR explains why the growth is worth it.

## Changeset Workflow (Releases)

Releases are PR-based via [Changesets](https://github.com/changesets/changesets):

1. If your change affects the runtime behavior of any published package (`@guksu/wvkit-core`, `@guksu/wvkit-react`, `@guksu/wvkit-vue`), run `pnpm changeset` and commit the generated file **in the same PR**. Test-, docs-, or CI-only changes do not need a changeset.
2. When the PR is merged to `main`, the Changesets bot opens (or updates) a **Release PR** that bumps versions and updates changelogs.
3. Merging the Release PR publishes the packages to npm automatically via GitHub Actions.

Versioning notes:

- Packages are versioned independently (semver).
- Before 1.0, breaking changes are allowed as `minor` bumps but must be called out in the changeset summary.

## Code Conventions

- **SSR safety**: never touch `window`/`document` at module load time — only inside guards, `useEffect`, or `onMounted`.
- **`destroy()` completeness**: every `create*` factory returns `destroy()` which removes all listeners, RAFs, timers, observers, and any DOM it created.
- **Named exports only** — no default exports.
- **No inline styles** except the documented allow-list (hidden input positioning, CSS3DRenderer transforms, virtualization toggles, `overscroll-behavior` opt-out).
- **Options are immutable** — treat `options` as readonly.

New components should follow the layout and checklist in `.claude/skills/add-component/SKILL.md` (core → react → vue, tests, EN + KO docs).

## Pull Requests

- Keep PRs focused — one concern per PR.
- Add or update tests for every behavior change (meaningful assertions, not just `not.toThrow()`).
- Fill in the PR template checklist (tests, lint, typecheck, changeset).
- Link the related issue if one exists.
