import { screen, type BrowserWindow } from 'electron';
import type { WalkInfo } from '../shared/ipc.js';

const SPEED = 50; // px/s
const TICK = 16;
const REST_MS: [number, number] = [2500, 7000];
const STEP_PX: [number, number] = [60, 360];

const rand = ([min, max]: [number, number]) => min + Math.random() * (max - min);

// 펫이 혼자 화면을 좌우로 걸어 다니게 한다.
// allowed: renderer가 정함 (상태가 돌아다녀도 되는지 + 마우스가 안 올라가 있는지)
// holds: main이 정함 (드래그 중, 메뉴 열림 등)
export function createWanderer(getWin: () => BrowserWindow | null, onWalk: (info: WalkInfo | null) => void) {
  let allowed = false;
  const holds = new Set<string>();
  let restTimer: NodeJS.Timeout | null = null;
  let walkTimer: NodeJS.Timeout | null = null;

  const active = () => allowed && holds.size === 0;

  function stopWalking() {
    if (!walkTimer) return;
    clearInterval(walkTimer);
    walkTimer = null;
    onWalk(null);
  }

  function cancelRest() {
    if (restTimer) clearTimeout(restTimer);
    restTimer = null;
  }

  function scheduleRest() {
    if (restTimer || walkTimer || !active()) return;
    restTimer = setTimeout(() => {
      restTimer = null;
      walk();
    }, rand(REST_MS));
  }

  function walk() {
    const win = getWin();
    if (!win || win.isDestroyed() || !active()) return;

    const start = win.getBounds();
    // 창이 있는 모니터의 작업 영역 안에서만 움직임 (멀티 모니터 대응)
    const area = screen.getDisplayMatching(start).workArea;
    const minX = area.x;
    const maxX = area.x + area.width - start.width;
    if (maxX <= minX) return;

    let target = start.x;
    for (let i = 0; i < 5 && Math.abs(target - start.x) < STEP_PX[0]; i++) {
      const dir = Math.random() < 0.5 ? -1 : 1;
      target = Math.min(maxX, Math.max(minX, start.x + dir * rand(STEP_PX)));
    }
    if (Math.abs(target - start.x) < STEP_PX[0]) return scheduleRest();

    const dir = target > start.x ? 1 : -1;
    let x = start.x;
    let last = Date.now();
    onWalk({ dir });

    walkTimer = setInterval(() => {
      if (win.isDestroyed()) return stopWalking();
      const now = Date.now();
      x += (dir * SPEED * (now - last)) / 1000;
      last = now;

      const arrived = dir > 0 ? x >= target : x <= target;
      if (arrived) x = target;
      // [win] 크기를 고정한 setBounds (배율 다른 모니터에서 창이 커지는 버그 방지)
      win.setBounds({ x: Math.round(x), y: win.getBounds().y, width: start.width, height: start.height });

      if (arrived) {
        stopWalking();
        scheduleRest();
      }
    }, TICK);
  }

  function refresh() {
    if (active()) {
      scheduleRest();
    } else {
      cancelRest();
      stopWalking();
    }
  }

  return {
    setAllowed(value: boolean) {
      allowed = value;
      refresh();
    },
    hold(reason: string, on: boolean) {
      if (on) holds.add(reason);
      else holds.delete(reason);
      refresh();
    },
  };
}
