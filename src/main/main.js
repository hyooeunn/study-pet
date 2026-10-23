const { app, BrowserWindow, screen } = require('electron');
const path = require('path');
const platform = require('./platform');
const { registerIpc, stopDrag } = require('./ipc');

const WINDOW_SIZE = { width: 220, height: 240 };
const SCREEN_MARGIN = 12;
const openDevTools = process.argv.includes('--devtools');

let win = null;

function createWindow() {
  // workArea = 작업표시줄(win) / 메뉴바·독(mac)을 뺀 영역
  const { workArea } = screen.getPrimaryDisplay();
  const x = workArea.x + workArea.width - WINDOW_SIZE.width - SCREEN_MARGIN;
  const y = workArea.y + workArea.height - WINDOW_SIZE.height - SCREEN_MARGIN;

  win = new BrowserWindow({
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

  platform.applyWindowTweaks(win);

  // 기본은 클릭 통과. 캐릭터 위에 올라오면 renderer가 꺼 달라고 요청함
  win.setIgnoreMouseEvents(true, { forward: true });

  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  win.loadFile(path.join(__dirname, '../renderer/index.html'));

  win.once('ready-to-show', () => {
    win.showInactive();
    // 도킹된 DevTools는 투명 창을 깨뜨리므로 분리 모드로
    if (openDevTools) win.webContents.openDevTools({ mode: 'detach' });
  });

  win.on('closed', () => {
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
    if (win) win.showInactive();
  });

  // [mac] 보통 맥 앱은 창을 닫아도 앱이 계속 켜져 있지만, 펫은 독 아이콘이 없어서 바로 종료
  app.on('window-all-closed', () => app.quit());
}
