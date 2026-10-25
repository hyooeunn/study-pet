import type { Appearance } from '../shared/ipc.js';

// 머리색 추가 = assets/pet/items/hair/ponytail/{id}/ 폴더 + 여기에 한 줄
// swatch = 캐릭터 만들기 화면의 동그라미 색 (그림의 칠한 색과 맞춤)
export const HAIR_COLORS = [
  { id: 'brown', label: '갈색', swatch: '#493b30' },
  { id: 'black', label: '검정', swatch: '#191414' },
  { id: 'lightbrown', label: '밝은 갈색', swatch: '#bc9678' },
  { id: 'blonde', label: '금발', swatch: '#fff1bc' },
] as const;

export const DEFAULT_APPEARANCE: Appearance = { hairColor: 'brown' };

export const NICKNAME_MAX = 12;
