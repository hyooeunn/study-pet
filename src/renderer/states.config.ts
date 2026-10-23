export interface StateDef {
  label: string;
  timer: 'run' | 'pause' | 'reset';
  showTimer: boolean;
  motion: string;      // 모션 폴더가 없을 때 쓰는 Tailwind 애니메이션 클래스
  color: string;       // 임시 캐릭터(동그라미) 색
  emoji: string;       // 임시 캐릭터 배지
  autoNext?: { to: string; after: number };
}

// 상태 추가 = 여기에 한 줄 추가 + assets/states/{id}.png 또는 {id}/ 폴더 넣기
const defs = {
  idle:   { label: '기본',     timer: 'reset', showTimer: false, motion: 'animate-pet-breathe', color: 'from-amber-50 to-amber-300',   emoji: '' },
  study:  { label: '공부 중',   timer: 'run',   showTimer: true,  motion: 'animate-pet-nod',     color: 'from-sky-50 to-sky-400',       emoji: '✏️' },
  rest:   { label: '휴식',     timer: 'pause', showTimer: true,  motion: 'animate-pet-sway',    color: 'from-green-50 to-green-300',   emoji: '☕' },
  sleepy: { label: '졸림',     timer: 'pause', showTimer: true,  motion: 'animate-pet-doze',    color: 'from-violet-50 to-violet-300', emoji: '💤' },
  happy:  { label: '목표 달성', timer: 'run',   showTimer: true,  motion: 'animate-pet-hop',     color: 'from-pink-50 to-pink-300',     emoji: '🎉', autoNext: { to: 'study', after: 4000 } },
} satisfies Record<string, StateDef>;

export type StatusId = keyof typeof defs;
export const STATES: Record<StatusId, StateDef> = defs;
export const DEFAULT_STATE: StatusId = 'idle';

export function isStatus(id: string): id is StatusId {
  return Object.hasOwn(STATES, id);
}
