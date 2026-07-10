#!/usr/bin/env node
/**
 * verify-three-decouple.mjs — B-02 (three 정적 로드 제거) 기계 검증 하네스.
 *
 * 전제: `pnpm build` 완료 상태에서 리포 루트 기준 실행.
 *   node scripts/verify-three-decouple.mjs
 *
 * 검사 항목 (하나라도 실패하면 exit 1 + 실패 목록 출력):
 *   1. CJS 격리 스모크 — three 미설치 환경(임시 디렉토리)에서
 *      - require(index.cjs) 성공 + createStableInput 함수 + createScrollContainer undefined
 *      - require(scroll-container.cjs) 는 three 미해석으로 실패해야 정상
 *   2. ESM 격리 스모크 — 동일 임시 디렉토리에서
 *      - import(index.js) 성공 (전이 청크 포함 three 무참조 런타임 증명)
 *      - import(scroll-container.js) 는 three 미해석으로 실패해야 정상
 *   3. 인리포 subpath 기능 확인 — three 해석 가능한 리포 안에서
 *      require/import 양쪽으로 dist/scroll-container.* 의 createScrollContainer 동작
 *   4. 어댑터 external 보존 — react/vue dist 에 모듈 지정자 "three" 부재,
 *      scroll-container.{js,cjs} 에 '@guksu/wvkit-core/scroll-container' 지정자 존재
 *
 * 문자열 grep 만으로는 tsup ESM 청크 분할의 전이 참조를 놓칠 수 있으므로
 * 격리 런타임 스모크(1~2)가 정본 판정이다 (plan.md 리스크 3).
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
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

/**
 * 자식 node 프로세스로 모듈 로드를 시도한다.
 * @returns {{ code: number, out: string }} code 0 = 로드 + 단언 성공, 1 = 로드 실패, 2+ = 단언 실패
 */
function tryLoad(kind, file, assertion) {
  // assertion: 로드된 모듈 m 에 대해 boolean 을 반환하는 JS 식 문자열 (기본: 무조건 통과)
  const expr = assertion ?? 'true';
  const script =
    kind === 'cjs'
      ? `let m; try { m = require(process.argv[1]); } catch (e) { console.error(String(e && e.message)); process.exit(1); } process.exit((${expr}) ? 0 : 2);`
      : `import('node:url').then(({ pathToFileURL }) => import(pathToFileURL(process.argv[1]).href)).then((m) => { process.exit((${expr}) ? 0 : 2); }, (e) => { console.error(String(e && e.message)); process.exit(1); });`;
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

if (!existsSync(coreDist)) {
  console.error(`core dist 없음: ${coreDist} — 먼저 pnpm build 를 실행하세요.`);
  process.exit(1);
}

// --- 검사 1~2: 격리 스모크 (three 미설치 임시 디렉토리) ---
const tmpBase = process.env.WVKIT_VERIFY_TMPDIR || tmpdir();
const tmp = mkdtempSync(join(tmpBase, 'wvkit-three-decouple-'));
try {
  cpSync(coreDist, tmp, { recursive: true });
  // 실배포 패키지와 동일하게 .js 를 ESM 으로 해석시킨다 (dist 는 type:module 패키지 내부에 존재)
  writeFileSync(join(tmp, 'package.json'), JSON.stringify({ type: 'module' }));

  // 1a. CJS 배럴: three 없이 로드 성공 + non-three 값만 노출
  const cjsBarrel = tryLoad(
    'cjs',
    join(tmp, 'index.cjs'),
    "typeof m.createStableInput === 'function' && m.createScrollContainer === undefined",
  );
  check(
    '1a. 격리 CJS: require(index.cjs) 성공 + createStableInput 함수 + createScrollContainer 부재',
    cjsBarrel.code === 0,
    cjsBarrel.code === 1 ? `로드 실패: ${cjsBarrel.out}` : cjsBarrel.code === 2 ? '단언 실패 (배럴에 three 값 잔존?)' : '',
  );

  // 1b. CJS subpath: three 미해석으로 실패해야 정상 (경계가 subpath 에 있음을 증명)
  const cjsSub = tryLoad('cjs', join(tmp, 'scroll-container.cjs'));
  check(
    '1b. 격리 CJS: require(scroll-container.cjs) 는 three 미해석으로 실패',
    cjsSub.code === 1,
    cjsSub.code === 0 ? 'three 없이 로드됨 — three 가 인라인됐거나 경계가 잘못됨' : '',
  );

  // 2a. ESM 배럴: three 없이 import 성공 (공용 청크 포함 전이 무참조 증명)
  const esmBarrel = tryLoad(
    'esm',
    join(tmp, 'index.js'),
    "typeof m.createStableInput === 'function' && m.createScrollContainer === undefined",
  );
  check(
    '2a. 격리 ESM: import(index.js) 성공 + createStableInput 함수 + createScrollContainer 부재',
    esmBarrel.code === 0,
    esmBarrel.code === 1 ? `로드 실패: ${esmBarrel.out}` : esmBarrel.code === 2 ? '단언 실패 (배럴에 three 값 잔존?)' : '',
  );

  // 2b. ESM subpath: three 미해석으로 실패해야 정상
  const esmSub = tryLoad('esm', join(tmp, 'scroll-container.js'));
  check(
    '2b. 격리 ESM: import(scroll-container.js) 는 three 미해석으로 실패',
    esmSub.code === 1,
    esmSub.code === 0 ? 'three 없이 로드됨 — three 가 인라인됐거나 경계가 잘못됨' : '',
  );
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

// --- 검사 3: 인리포 subpath 기능 확인 (three 해석 가능) ---
const inRepoCjs = tryLoad('cjs', join(coreDist, 'scroll-container.cjs'), "typeof m.createScrollContainer === 'function'");
check(
  '3a. 인리포 CJS: require(dist/scroll-container.cjs) → createScrollContainer 함수',
  inRepoCjs.code === 0,
  inRepoCjs.out || (inRepoCjs.code === 2 ? '단언 실패' : ''),
);
const inRepoEsm = tryLoad('esm', join(coreDist, 'scroll-container.js'), "typeof m.createScrollContainer === 'function'");
check(
  '3b. 인리포 ESM: import(dist/scroll-container.js) → createScrollContainer 함수',
  inRepoEsm.code === 0,
  inRepoEsm.out || (inRepoEsm.code === 2 ? '단언 실패' : ''),
);

// --- 검사 4: 어댑터 external 보존 ---
const THREE_SPECIFIER = /["']three["']|["']three\//; // 모듈 지정자 형태의 three 참조
for (const pkg of ['react', 'vue']) {
  const dist = join(repoRoot, 'packages', pkg, 'dist');
  if (!existsSync(dist)) {
    check(`4. ${pkg} dist 존재`, false, `${dist} 없음 — pnpm build 필요`);
    continue;
  }
  const runtimeFiles = readdirSync(dist).filter(
    (f) => (f.endsWith('.js') || f.endsWith('.cjs')) && !f.endsWith('.d.ts') && !f.endsWith('.d.cts'),
  );
  const withThree = runtimeFiles.filter((f) => THREE_SPECIFIER.test(readFileSync(join(dist, f), 'utf8')));
  check(
    `4a. ${pkg} dist 런타임 산출물에 모듈 지정자 "three" 부재`,
    withThree.length === 0,
    withThree.length ? `발견: ${withThree.join(', ')}` : '',
  );

  for (const f of ['scroll-container.js', 'scroll-container.cjs']) {
    const p = join(dist, f);
    const ok = existsSync(p) && readFileSync(p, 'utf8').includes('@guksu/wvkit-core/scroll-container');
    check(
      `4b. ${pkg}/dist/${f} 에 지정자 '@guksu/wvkit-core/scroll-container' 존재 (코어 인라인 아님)`,
      ok,
      existsSync(p) ? '지정자 부재 — 코어가 인라인됐을 수 있음' : '파일 없음',
    );
  }
}

if (failures.length > 0) {
  console.error(`\n검증 실패 ${failures.length}건:`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('\nthree-decouple 검증 전부 통과');
