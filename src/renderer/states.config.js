// 상태 추가 = 여기에 한 줄 추가 + assets/states/{id}.png 넣기
// timer: 'run'(돌리기) | 'pause'(멈추기) | 'reset'(0으로)
// autoNext: 일정 시간 뒤 자동으로 다른 상태로
export const STATES = {
  idle:   { label: '기본',     timer: 'reset', showTimer: false },
  study:  { label: '공부 중',   timer: 'run',   showTimer: true },
  rest:   { label: '휴식',     timer: 'pause', showTimer: true },
  sleepy: { label: '졸림',     timer: 'pause', showTimer: true },
  happy:  { label: '목표 달성', timer: 'run',   showTimer: true, autoNext: { to: 'study', after: 4000 } },
};

export const DEFAULT_STATE = 'idle';
