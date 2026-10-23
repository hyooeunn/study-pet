import { STATES, DEFAULT_STATE } from './states.config.js';
import { createStopwatch } from './timer.js';

const stopwatch = createStopwatch();
const listeners = new Set();
let autoNextTimer = null;

const state = {
  status: DEFAULT_STATE,
  scale: 1,         // 설정 단계에서 0.8 ~ 2.0
  appearance: null, // 파츠 단계에서 { base, hair, outfit, accessory }
};

export function getState() {
  return { ...state };
}

export function getStudyElapsedMs() {
  return stopwatch.elapsed();
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function update(patch) {
  const prev = getState();
  Object.assign(state, patch);
  const next = getState();
  listeners.forEach((fn) => fn(next, prev));
}

export function setStatus(status) {
  const def = STATES[status];
  if (!def || status === state.status) return;

  clearTimeout(autoNextTimer);

  if (def.timer === 'run') stopwatch.start();
  else if (def.timer === 'pause') stopwatch.pause();
  else if (def.timer === 'reset') stopwatch.reset();

  update({ status });

  if (def.autoNext) {
    autoNextTimer = setTimeout(() => setStatus(def.autoNext.to), def.autoNext.after);
  }
}
