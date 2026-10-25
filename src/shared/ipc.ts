// main · preload · renderer가 같이 쓰는 타입 (타입만 있어서 실행 코드는 없음)

export interface MotionFrame {
  path: string;
  mask: Uint8Array;
}

export interface LayerData {
  frames: MotionFrame[];
  fps: number;
  loop: boolean;
  size: number;
}

export type MenuItemSpec =
  | { kind: 'separator' }
  | { kind: 'item'; id: string; label: string; enabled?: boolean; checked?: boolean }
  | { kind: 'submenu'; label: string; submenu: MenuItemSpec[] };

// ---------- 내 캐릭터 프로필 (처음 실행 때 만들기, userData/profile.json에 저장) ----------

export interface Appearance {
  hairStyle: string; // items.json hairStyles의 이름 (ponytail, long ...)
  hairColor: string; // '#rrggbb'. items.json에서 tint: 'hair'인 그림을 이 색으로 칠함
  skinColor: string; // '#rrggbb'. 파츠의 피부 픽셀을 이 색으로 바꿈
  accessoryColor: string | null; // '#rrggbb' 또는 null(그린 색 그대로). 머리끈 같은 악세사리 색
}

export interface Profile {
  nickname: string;
  appearance: Appearance;
}

// ---------- 파츠 조립 캐릭터 (assets/pet/rig.json, items.json) ----------

export type Vec2 = [number, number];
export type RigPartId = 'head' | 'face' | 'torso' | 'arm_l' | 'arm_r' | 'leg_l' | 'leg_r';
export type ItemSlot = 'hair_back' | 'bottom' | 'top' | 'hair_front';

export interface RigData {
  canvas: Vec2;
  pivots: Record<'roll' | 'neck' | 'shoulderL' | 'shoulderR' | 'hipL' | 'hipR', Vec2>;
  params: {
    frames: number;
    fps: number;
    footTravelPx: number;
    footLiftPx: number;
    rollDeg: number;
    leanDeg: number;
    bobPx: number;
    armBaseDeg: number;
    armSwingDeg: number;
    legLenPx: number;
    faceShiftPx: number;
    headCounterRoll: number;
    legSwayFollow: number;
  };
  crop: { x: number; y: number; size: number };
}

export interface ItemDef {
  id: string;
  image: string; // assets/pet/ 기준 경로
  slot: ItemSlot;
  attachTo: RigPartId;
  tint?: 'hair'; // 내 캐릭터의 머리색으로 칠함 (원본은 갈색으로 그림)
  accent?: 'accessory'; // 그림 속 채도 높은 부분(머리끈·리본 등)을 악세사리 색으로 칠함
  sway?: { pivot: Vec2; deg: number; lag?: number }; // 걸을 때 흔들림 (포니테일 등)
}

export interface PetRig {
  rig: RigData;
  items: ItemDef[];                     // 항상 입는 아이템
  hairStyles: Record<string, ItemDef[]>; // 고를 수 있는 머리 모양
}

export interface WalkInfo {
  dir: 1 | -1; // 1 = 오른쪽, -1 = 왼쪽
}

export interface PetAPI {
  platform: string;
  setIgnoreMouse(ignore: boolean): void;
  dragStart(): void;
  dragEnd(): void;
  showMenu(items: MenuItemSpec[]): void;
  loadLayer(candidates: string[]): Promise<LayerData | null>;
  loadRig(): Promise<PetRig | null>;
  getProfile(): Promise<Profile | null>;
  saveProfile(profile: Profile): Promise<boolean>;
  onProfileChanged(callback: (profile: Profile) => void): () => void;
  onMenuAction(callback: (id: string) => void): () => void;
  setWanderAllowed(allowed: boolean): void;
  onWalk(callback: (info: WalkInfo | null) => void): () => void;
  onSystemIdle(callback: (idleSeconds: number) => void): () => void;
}
