import { app, Menu, type BrowserWindow } from 'electron';

export const isMac = process.platform === 'darwin';
export const isWin = process.platform === 'win32';

export function beforeReady() {
  // 투명 창이 검게 나올 때 비상용: npm run start:nogpu
  if (process.argv.includes('--no-gpu')) app.disableHardwareAcceleration();

  // [win] 알림·작업 관리자에서 앱을 구분하는 ID (package.json의 appId와 같게)
  if (isWin) app.setAppUserModelId('com.studypet.app');
}

export function onReady() {
  // [mac] 독 아이콘 숨기기
  if (isMac) app.dock?.hide();
  // [mac] 앱 메뉴가 없으면 입력칸에서 Cmd+C/V/Z가 안 먹어서 편집 메뉴만 등록 (화면엔 안 보임)
  if (isMac) Menu.setApplicationMenu(Menu.buildFromTemplate([{ role: 'editMenu' }]));
}

export function applyWindowTweaks(win: BrowserWindow) {
  if (isMac) {
    // [mac] 다른 앱의 전체화면 위, 모든 데스크톱(Space)에 표시
    win.setAlwaysOnTop(true, 'floating');
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    // 위 호출 때문에 독 아이콘이 다시 나타나는 경우가 있어서 한 번 더 숨김
    app.dock?.hide();
  } else {
    // [win] 기본 alwaysOnTop으로 충분
    win.setAlwaysOnTop(true);
  }
}
