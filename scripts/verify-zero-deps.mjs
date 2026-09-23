#!/usr/bin/env node
/**
 * verify-zero-deps.mjs — "런타임 의존성 0" 기계 검증 하네스.
 *
 * 전제: `pnpm build` 완료 상태에서 리포 루트 기준 실행.
 *   node scripts/verify-zero-deps.mjs
 *
 * 검사 항목 (하나라도 실패하면 exit 1 + 실패 목록 출력):
 *   1. 격리 스모크 — node_modules 가 전혀 없는 임시 디렉토리에 core dist 만 복사해
 *      CJS require / ESM import 로 배럴(index)과 subpath(scroll-container) 양쪽이 로드되고
 *      createStableInput / createScrollContainer 가 함수인지 확인. (0.4까지는 subpath 가 three 를
 *      요구해 실패하는 것이 정상이었다 — 0.5부터는 성공해야 한다.)
 *   2. core dist 런타임 산출물의 모듈 지정자가 전부 상대 경로(./)뿐인지 — 외부 패키지 참조 0.
 *   3. 어댑터(react/vue) dist 의 비상대 지정자가 peer(@guksu/wvkit-core*, react·react/*, vue·vue/*)뿐인지,
 *      scroll-container.{js,cjs} 가 '@guksu/wvkit-core/scroll-container' 를 참조하는지(코어 인라인 아님).
 *
 * 문자열 grep 만으로는 tsup ESM 청크 분할의 전이 참조를 놓칠 수 있으므로 격리 런타임 스모크(1)가 정본 판정이다.
 */
import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const coreDist = join(repoRoot, 'packages/core/dist');

const failures = [];
function check(name, ok, detail = '') {
  if (ok) {
    console.log(`  ok  ${name}`);
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

/** 자식 node 프로세스로 모듈 로드를 시도한다. code 0 = 로드 + 단언 성공, 1 = 로드 실패, 2 = 단언 실패 */
function tryLoad(kind, file, assertion = 'true') {
  const script =
    kind === 'cjs'
      ? `let m; try { m = require(process.argv[1]); } catch (e) { console.error(String(e && e.message)); process.exit(1); } process.exit((${assertion}) ? 0 : 2);`
      : `import('node:url').then(({ pathToFileURL }) => import(pathToFileURL(process.argv[1]).href)).then((m) => { process.exit((${assertion}) ? 0 : 2); }, (e) => { console.error(String(e && e.message)); process.exit(1); });`;
  try {
    const out = execFileSync(process.execPath, ['-e', script, file], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}`.trim() };
  }
}

/** 런타임 산출물에서 비상대 모듈 지정자 목록을 뽑는다 (import/export ... from, require()). */
function externalSpecifiers(source) {
  const specs = new Set();
  const re = /(?:from\s*|import\s*\(?\s*|require\s*\(\s*)["']([^"']+)["']/g;
  let m = re.exec(source);
  while (m) {
    const spec = m[1];
    if (!spec.startsWith('.') && !spec.startsWith('node:')) specs.add(spec);
    m = re.exec(source);
  }
  return [...specs];
}

function runtimeFiles(dist) {
  return readdirSync(dist).filter(
    (f) =>
      (f.endsWith('.js') || f.endsWith('.cjs')) && !f.endsWith('.d.ts') && !f.endsWith('.d.cts'),
  );
}

if (!existsSync(coreDist)) {
  console.error(`core dist 없음: ${coreDist} — 먼저 pnpm build 를 실행하세요.`);
  process.exit(1);
}

// --- 검사 1: 격리 스모크 (의존성이 전혀 없는 임시 디렉토리) ---
const tmp = mkdtempSync(join(process.env.WVKIT_VERIFY_TMPDIR || tmpdir(), 'wvkit-zero-deps-'));
try {
  cpSync(coreDist, tmp, { recursive: true });
  writeFileSync(join(tmp, 'package.json'), JSON.stringify({ type: 'module' }));
  const barrelAssert =
    "typeof m.createStableInput === 'function' && m.createScrollContainer === undefined";
  const subAssert = "typeof m.createScrollContainer === 'function'";
  for (const [kind, file, assertion, label] of [
    [
      'cjs',
      'index.cjs',
      barrelAssert,
      '1a. 격리 CJS: require(index.cjs) → createStableInput 함수, createScrollContainer 부재(배럴 경계 유지)',
    ],
    [
      'cjs',
      'scroll-container.cjs',
      subAssert,
      '1b. 격리 CJS: require(scroll-container.cjs) → 의존성 없이 로드 + createScrollContainer 함수',
    ],
    [
      'esm',
      'index.js',
      barrelAssert,
      '1c. 격리 ESM: import(index.js) → createStableInput 함수, createScrollContainer 부재',
    ],
    [
      'esm',
      'scroll-container.js',
      subAssert,
      '1d. 격리 ESM: import(scroll-container.js) → 의존성 없이 로드 + createScrollContainer 함수',
    ],
  ]) {
    const r = tryLoad(kind, join(tmp, file), assertion);
    check(
      label,
      r.code === 0,
      r.code === 1 ? `로드 실패: ${r.out}` : r.code === 2 ? '단언 실패' : '',
    );
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

// --- 검사 2: core dist 외부 지정자 0 ---
for (const f of runtimeFiles(coreDist)) {
  const ext = externalSpecifiers(readFileSync(join(coreDist, f), 'utf8'));
  check(
    `2. core/dist/${f} 비상대 모듈 지정자 없음`,
    ext.length === 0,
    ext.length ? `발견: ${ext.join(', ')}` : '',
  );
}

// --- 검사 3: 어댑터는 peer 만 참조 + 코어 인라인 아님 ---
const PEERS = { react: ['react'], vue: ['vue'] };
for (const pkg of ['react', 'vue']) {
  const dist = join(repoRoot, 'packages', pkg, 'dist');
  if (!existsSync(dist)) {
    check(`3. ${pkg} dist 존재`, false, `${dist} 없음 — pnpm build 필요`);
    continue;
  }
  for (const f of runtimeFiles(dist)) {
    const ext = externalSpecifiers(readFileSync(join(dist, f), 'utf8'));
    const isPeer = (spec) =>
      spec.startsWith('@guksu/wvkit-core') ||
      PEERS[pkg].some((peer) => spec === peer || spec.startsWith(`${peer}/`));
    const bad = ext.filter((spec) => !isPeer(spec));
    check(
      `3a. ${pkg}/dist/${f} 비상대 지정자는 peer(@guksu/wvkit-core*, ${PEERS[pkg].join(', ')})뿐`,
      bad.length === 0,
      bad.length ? `발견: ${bad.join(', ')}` : '',
    );
  }
  for (const f of ['scroll-container.js', 'scroll-container.cjs']) {
    const p = join(dist, f);
    const ok =
      existsSync(p) && readFileSync(p, 'utf8').includes('@guksu/wvkit-core/scroll-container');
    check(
      `3b. ${pkg}/dist/${f} 가 '@guksu/wvkit-core/scroll-container' 를 참조 (코어 인라인 아님)`,
      ok,
      existsSync(p) ? '지정자 부재' : '파일 없음',
    );
  }
}

if (failures.length > 0) {
  console.error(`\n검증 실패 ${failures.length}건:`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('\nzero-deps 검증 전부 통과');
