import type { Appearance } from '../shared/ipc.js';

// 팔레트 첫 번째 = 원본 그림의 색 (아무것도 안 바뀜). 색 추가 = 여기에 한 줄
export const HAIR_COLORS = [
  { color: '#493b30', label: '갈색' },
  { color: '#191414', label: '검정' },
  { color: '#bc9678', label: '밝은 갈색' },
  { color: '#fff1bc', label: '금발' },
] as const;

export const SKIN_COLORS = [
  { color: '#ffeae4', label: '기본' },
  { color: '#ffe2cc', label: '살구' },
  { color: '#f5cfa8', label: '밀색' },
  { color: '#e2ac84', label: '황갈색' },
  { color: '#b98260', label: '갈색' },
  { color: '#8a5a40', label: '진한 갈색' },
] as const;

// 악세사리(머리끈 등) 색. color: null = 그린 색 그대로
export const ACCESSORY_COLORS = [
  { color: null, label: '원래 색' },
  { color: '#e5484d', label: '빨강' },
  { color: '#ffd84d', label: '노랑' },
  { color: '#6cc551', label: '초록' },
  { color: '#5ab2ff', label: '하늘' },
  { color: '#ff8fc0', label: '분홍' },
] as const;

export const DEFAULT_APPEARANCE: Appearance = {
  hairColor: HAIR_COLORS[0].color,
  skinColor: SKIN_COLORS[0].color,
  accessoryColor: null,
};

export const NICKNAME_MAX = 12;
