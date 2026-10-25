import { STATES, DEFAULT_STATE, isStatus, type StatusId } from './states.config.js';
import { createStopwatch } from './timer.js';

export interface PetState {
  status: StatusId;
  scale: number; // 설정 단계에서 0.8 ~ 2.0
}

type Listener = (next: PetState, prev: PetState) => void;

const stopwatch = createStopwatch();
const listeners = new Set<Listener>();
let autoNextTimer: ReturnType<typeof setTimeout> | undefined;

const state: PetState = {
  status: DEFAULT_STATE,
  scale: 1,
};

export function getState(): PetState {
  return { ...state };
}

export function getStudyElapsedMs() {
  return stopwatch.elapsed();
}

export function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function update(patch: Partial<PetState>) {
  const prev = getState();
  Object.assign(state, patch);
  const next = getState();
  listeners.forEach((fn) => fn(next, prev));
}

export function setStatus(status: string) {
  if (!isStatus(status) || status === state.status) return;
  const def = STATES[status];

  clearTimeout(autoNextTimer);

  if (def.timer === 'run') stopwatch.start();
  else if (def.timer === 'pause') stopwatch.pause();
  else stopwatch.reset();

  update({ status });

  const { autoNext } = def;
  if (autoNext) {
    autoNextTimer = setTimeout(() => setStatus(autoNext.to), autoNext.after);
  }
}
