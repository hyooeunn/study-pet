import { spawn } from 'node:child_process';
import { watch } from 'node:fs';
import path from 'node:path';
import electronPath from 'electron';
import { HTML_DIR, ROOT, build, copyHtml, watchCss, watchTs } from './build.mjs';

build();

const watchers = [watchTs(), watchCss()];
const htmlWatcher = watch(HTML_DIR, (_event, file) => {
  if (file?.endsWith('.html')) copyHtml();
});

// VS Code 등에서 이 값이 1이면 Electron이 앱이 아닌 Node로 실행돼 버림
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const extraArgs = process.argv.slice(2);
const app = spawn(electronPath, ['.', '--dev', ...extraArgs], { cwd: ROOT, stdio: 'inherit', env });

console.log('\n[dev] 화면(renderer) 코드는 저장하면 자동 새로고침, main/preload 코드는 Ctrl+C 후 다시 npm run dev\n');

app.on('exit', () => {
  htmlWatcher.close();
  watchers.forEach((w) => w.kill());
  process.exit(0);
});
