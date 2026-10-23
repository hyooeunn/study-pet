import { app, BrowserWindow, screen } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as platform from './platform.js';
import { registerIpc, stopDrag } from './ipc.js';

const WINDOW_SIZE = { width: 220, height: 240 };
const SCREEN_MARGIN = 12;
const isDev = process.argv.includes('--dev');
const openDevTools = process.argv.includes('--devtools');

let win: BrowserWindow | null = null;

// 개발 모드: 화면 파일이 다시 컴파일되면 자동 새로고침
function watchRenderer(target: BrowserWindow) {
  let timer: NodeJS.Timeout | undefined;
  const watcher = fs.watch(path.join(__dirname, '../renderer'), { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (!target.isDestroyed()) target.webContents.reloadIgnoringCache();
    }, 200);
  });
  target.on('closed', () => watcher.close());
}

function createWindow() {
  // workArea = 작업표시줄(win) / 메뉴바·독(mac)을 뺀 영역
  const { workArea } = screen.getPrimaryDisplay();
  const x = workArea.x + workArea.width - WINDOW_SIZE.width - SCREEN_MARGIN;
  const y = workArea.y + workArea.height - WINDOW_SIZE.height - SCREEN_MARGIN;

  const w = new BrowserWindow({
    ...WINDOW_SIZE,
    x,
    y,
    transparent: true,
    frame: false,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });
  win = w;

  platform.applyWindowTweaks(w);

  // 기본은 클릭 통과. 캐릭터 위에 올라오면 renderer가 꺼 달라고 요청함
  w.setIgnoreMouseEvents(true, { forward: true });
  w.webContents.on('did-finish-load', () => w.setIgnoreMouseEvents(true, { forward: true }));

  w.webContents.on('will-navigate', (e) => e.preventDefault());
  w.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  w.loadFile(path.join(__dirname, '../renderer/index.html'));

  w.once('ready-to-show', () => {
    w.showInactive();
    // 도킹된 DevTools는 투명 창을 깨뜨리므로 분리 모드로
    if (openDevTools) w.webContents.openDevTools({ mode: 'detach' });
  });

  if (isDev) watchRenderer(w);

  w.on('closed', () => {
    stopDrag();
    win = null;
  });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  platform.beforeReady();

  app.whenReady().then(() => {
    platform.onReady();
    registerIpc(() => win);
    createWindow();
  });

  app.on('second-instance', () => {
    win?.showInactive();
  });

  // [mac] 보통 맥 앱은 창을 닫아도 앱이 계속 켜져 있지만, 펫은 독 아이콘이 없어서 바로 종료
  app.on('window-all-closed', () => app.quit());
}
