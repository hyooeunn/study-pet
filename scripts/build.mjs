import { execFileSync, spawn } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// 패키지의 package.json "bin"에서 실행 파일 경로를 찾는다
function binOf(pkg, name) {
  const dir = path.join(ROOT, 'node_modules', pkg);
  const { bin } = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8'));
  return path.join(dir, typeof bin === 'string' ? bin : bin[name]);
}

const TSC = binOf('typescript', 'tsc');
const TAILWIND = binOf('@tailwindcss/cli', 'tailwindcss');
const CSS_ARGS = ['-i', 'src/renderer/styles.css', '-o', 'out/renderer/styles.css'];

// 셸 없이 node로 직접 실행 → Windows에서도 Ctrl+C 한 번에 깔끔히 종료
export function spawnNode(script, args) {
  return spawn(process.execPath, [script, ...args], { cwd: ROOT, stdio: 'inherit' });
}

export function copyHtml() {
  mkdirSync(path.join(ROOT, 'out/renderer'), { recursive: true });
  cpSync(path.join(ROOT, 'src/renderer/index.html'), path.join(ROOT, 'out/renderer/index.html'));
}

export function watchTs() {
  return spawnNode(TSC, ['-b', '--watch', '--preserveWatchOutput']);
}

export function watchCss() {
  return spawnNode(TAILWIND, [...CSS_ARGS, '--watch=always']);
}

export function build() {
  rmSync(path.join(ROOT, 'out'), { recursive: true, force: true });
  const run = (script, args) => execFileSync(process.execPath, [script, ...args], { cwd: ROOT, stdio: 'inherit' });
  run(TSC, ['-b']);
  run(TAILWIND, [...CSS_ARGS, '--minify']);
  copyHtml();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  build();
}
