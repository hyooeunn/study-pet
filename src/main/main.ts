import { app, BrowserWindow, screen, type WebPreferences } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Profile } from '../shared/ipc.js';
import * as platform from './platform.js';
import { registerIpc, stopDrag } from './ipc.js';
import { loadProfile } from './profile.js';

const PET_SIZE = { width: 220, height: 240 };
const SETUP_SIZE = { width: 620, height: 610 };
const SCREEN_MARGIN = 12;
const isDev = process.argv.includes('--dev');
const openDevTools = process.argv.includes('--devtools');

let pet: BrowserWindow | null = null;
let setup: BrowserWindow | null = null;

const webPreferences = (): WebPreferences => ({
  preload: path.join(__dirname, '../preload/preload.js'),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
  backgroundThrottling: false,
});

function harden(win: BrowserWindow) {
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  if (isDev) watchRenderer(win);
}

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

function createPetWindow() {
  // workArea = 작업표시줄(win) / 메뉴바·독(mac)을 뺀 영역
  const { workArea } = screen.getPrimaryDisplay();
  const x = workArea.x + workArea.width - PET_SIZE.width - SCREEN_MARGIN;
  const y = workArea.y + workArea.height - PET_SIZE.height - SCREEN_MARGIN;

  const w = new BrowserWindow({
    ...PET_SIZE,
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
    webPreferences: webPreferences(),
  });
  pet = w;

  platform.applyWindowTweaks(w);
  harden(w);

  // 기본은 클릭 통과. 캐릭터 위에 올라오면 renderer가 꺼 달라고 요청함
  w.setIgnoreMouseEvents(true, { forward: true });
  w.webContents.on('did-finish-load', () => w.setIgnoreMouseEvents(true, { forward: true }));

  w.loadFile(path.join(__dirname, '../renderer/index.html'));

  w.once('ready-to-show', () => {
    w.showInactive();
    // 도킹된 DevTools는 투명 창을 깨뜨리므로 분리 모드로
    if (openDevTools) w.webContents.openDevTools({ mode: 'detach' });
  });

  w.on('closed', () => {
    stopDrag();
    pet = null;
  });
}

// 캐릭터 만들기 / 꾸미기 창 (처음 실행 때, 우클릭 메뉴에서)
function openSetupWindow() {
  if (setup) {
    setup.show();
    setup.focus();
    return;
  }

  const w = new BrowserWindow({
    ...SETUP_SIZE,
    useContentSize: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    title: '내 캐릭터',
    backgroundColor: '#fff7f2',
    autoHideMenuBar: true,
    show: false,
    webPreferences: webPreferences(),
  });
  setup = w;

  harden(w);
  w.setMenuBarVisibility(false);
  w.loadFile(path.join(__dirname, '../renderer/setup.html'));
  w.once('ready-to-show', () => {
    w.show();
    if (openDevTools) w.webContents.openDevTools({ mode: 'detach' });
  });
  w.on('closed', () => {
    setup = null;
  });
}

function onProfileSaved(profile: Profile) {
  if (pet) pet.webContents.send('profile:changed', profile);
  else createPetWindow();
  setup?.close();
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  platform.beforeReady();

  app.whenReady().then(() => {
    platform.onReady();
    registerIpc({ getPet: () => pet, getSetup: () => setup, openSetup: openSetupWindow, onProfileSaved });
    if (loadProfile()) createPetWindow();
    else openSetupWindow();
  });

  app.on('second-instance', () => {
    if (setup) setup.focus();
    else pet?.showInactive();
  });

  // [mac] 보통 맥 앱은 창을 닫아도 앱이 계속 켜져 있지만, 펫은 독 아이콘이 없어서 바로 종료
  // 캐릭터를 만들기 전에 창을 닫아도 여기서 종료됨
  app.on('window-all-closed', () => app.quit());
}
