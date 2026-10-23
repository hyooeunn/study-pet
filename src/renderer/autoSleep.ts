import { AUTO_SLEEP } from './states.config.js';
import * as store from './state.js';

export function setupAutoSleep() {
  // 자동으로 잠든 경우에만 자동으로 깨운다 (메뉴에서 직접 고른 졸림은 유지)
  let autoSlept = false;

  store.subscribe((next) => {
    if (next.status !== AUTO_SLEEP.to) autoSlept = false;
  });

  window.petAPI.onSystemIdle((idleSeconds) => {
    const { status } = store.getState();
    if (status === AUTO_SLEEP.from && idleSeconds >= AUTO_SLEEP.afterSec) {
      store.setStatus(AUTO_SLEEP.to);
      autoSlept = true;
    } else if (status === AUTO_SLEEP.to && autoSlept && idleSeconds < AUTO_SLEEP.wakeWithinSec) {
      store.setStatus(AUTO_SLEEP.from);
    }
  });
}
