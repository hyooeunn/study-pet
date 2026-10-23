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

export interface PetAPI {
  platform: string;
  setIgnoreMouse(ignore: boolean): void;
  dragStart(): void;
  dragEnd(): void;
  showMenu(items: MenuItemSpec[]): void;
  loadLayer(candidates: string[]): Promise<LayerData | null>;
  quit(): void;
  onMenuAction(callback: (id: string) => void): () => void;
}
