import { powerMonitor, type BrowserWindow } from 'electron';

const POLL_MS = 2000;

// 시스템 전체 키보드·마우스 무입력 시간(초)을 주기적으로 renderer에 알려 줌 (Win/mac 공통)
export function startIdleWatch(getWin: () => BrowserWindow | null) {
  setInterval(() => {
    const win = getWin();
    if (win && !win.isDestroyed()) win.webContents.send('pet:system-idle', powerMonitor.getSystemIdleTime());
  }, POLL_MS);
}
