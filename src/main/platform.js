const { app } = require('electron');

const isMac = process.platform === 'darwin';
const isWin = process.platform === 'win32';

function beforeReady() {
  // 투명 창이 검게 나올 때 비상용: npm run start:nogpu
  if (process.argv.includes('--no-gpu')) app.disableHardwareAcceleration();

  // [win] 알림·작업 관리자에서 앱을 구분하는 ID (package.json의 appId와 같게)
  if (isWin) app.setAppUserModelId('com.studypet.app');
}

function onReady() {
  // [mac] 독 아이콘 숨기기
  if (isMac && app.dock) app.dock.hide();
}

function applyWindowTweaks(win) {
  if (isMac) {
    // [mac] 다른 앱의 전체화면 위, 모든 데스크톱(Space)에 표시
    win.setAlwaysOnTop(true, 'floating');
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    // 위 호출 때문에 독 아이콘이 다시 나타나는 경우가 있어서 한 번 더 숨김
    if (app.dock) app.dock.hide();
  } else {
    // [win] 기본 alwaysOnTop으로 충분
    win.setAlwaysOnTop(true);
  }
}

module.exports = { isMac, isWin, beforeReady, onReady, applyWindowTweaks };
