import { STATES } from './states.config.js';
import * as store from './state.js';
import { formatTime } from './timer.js';
import { createCharacter } from './character.js';
import { setupDrag } from './drag.js';
import { setupClickThrough } from './clickThrough.js';

const api = window.petAPI;
const root = document.getElementById('pet');
const stage = document.getElementById('stage');
const timerEl = document.getElementById('timer');
const closeBtn = document.getElementById('close-btn');

const character = createCharacter(stage, { size: 150 });
const drag = setupDrag(character.el);
setupClickThrough({ root, character, isDragging: drag.isDragging });

function buildMenu(status) {
  return [
    { id: 'study', label: status === 'rest' ? '공부 다시 시작' : '공부 시작', enabled: status !== 'study' },
    { id: 'rest', label: '휴식', enabled: status !== 'rest' && status !== 'idle' },
    { id: 'idle', label: '공부 종료', enabled: status !== 'idle' },
    { type: 'separator' },
    {
      label: '상태 테스트',
      submenu: Object.entries(STATES).map(([id, def]) => ({
        id,
        label: def.label,
        checked: id === status,
      })),
    },
  ];
}

function renderTimer() {
  const def = STATES[store.getState().status];
  timerEl.classList.toggle('is-hidden', !def.showTimer);
  timerEl.classList.toggle('paused', def.timer !== 'run');
  if (def.showTimer) timerEl.textContent = formatTime(store.getStudyElapsedMs());
}

store.subscribe((next, prev) => {
  if (next.status !== prev.status) character.setStatus(next.status);
  renderTimer();
});

character.el.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  api.showMenu(buildMenu(store.getState().status));
});

api.onMenuAction((id) => store.setStatus(id));
closeBtn.addEventListener('click', () => api.quit());

character.setStatus(store.getState().status);
renderTimer();
setInterval(renderTimer, 500);
