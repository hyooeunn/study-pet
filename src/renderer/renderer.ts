import type { MenuItemSpec } from '../shared/ipc.js';
import { STATES, type StatusId } from './states.config.js';
import * as store from './state.js';
import { formatTime } from './timer.js';
import { createCharacter } from './character.js';
import { setupDrag } from './drag.js';
import { setupClickThrough } from './clickThrough.js';
import { setupAutoSleep } from './autoSleep.js';

const api = window.petAPI;
const $ = (id: string) => document.getElementById(id)!;
const stage = $('stage');
const timerEl = $('timer');

const character = createCharacter(stage, { size: 150 });
const drag = setupDrag(character.el);

// 돌아다녀도 되는 상태 + 마우스가 안 올라가 있을 때만 걷기 (드래그·메뉴는 main이 따로 멈춤)
let hovering = false;
function syncWander() {
  api.setWanderAllowed(STATES[store.getState().status].wander && !hovering);
}

setupClickThrough({
  character,
  isDragging: drag.isDragging,
  onHoverChange: (on) => {
    hovering = on;
    syncWander();
  },
});

api.onWalk((info) => character.setActivity(info ? 'walk' : null, info?.dir));
setupAutoSleep();

function buildMenu(status: StatusId): MenuItemSpec[] {
  return [
    {
      kind: 'item',
      id: 'study',
      label: status === 'rest' || status === 'sleepy' ? '공부 다시 시작' : '공부 시작',
      enabled: status !== 'study',
    },
    { kind: 'item', id: 'rest', label: '휴식', enabled: status !== 'rest' && status !== 'idle' },
    { kind: 'item', id: 'idle', label: '공부 종료', enabled: status !== 'idle' },
    { kind: 'separator' },
    {
      kind: 'submenu',
      label: '상태 테스트',
      submenu: Object.entries(STATES).map(([id, def]) => ({
        kind: 'item' as const,
        id,
        label: def.label,
        checked: id === status,
      })),
    },
  ];
}

function renderTimer() {
  const def = STATES[store.getState().status];
  timerEl.classList.toggle('invisible', !def.showTimer);
  timerEl.classList.toggle('opacity-60', def.timer !== 'run');
  if (def.showTimer) timerEl.textContent = formatTime(store.getStudyElapsedMs());
}

store.subscribe((next, prev) => {
  if (next.status !== prev.status) {
    character.setStatus(next.status);
    syncWander();
  }
  renderTimer();
});

character.el.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  api.showMenu(buildMenu(store.getState().status));
});

api.onMenuAction((id) => store.setStatus(id));

character.setStatus(store.getState().status);
renderTimer();
syncWander();
setInterval(renderTimer, 500);
