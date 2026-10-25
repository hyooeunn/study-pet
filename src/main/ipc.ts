import {
  app,
  ipcMain,
  Menu,
  nativeImage,
  screen,
  type BrowserWindow,
  type IpcMainEvent,
  type IpcMainInvokeEvent,
  type MenuItemConstructorOptions,
} from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ItemDef, LayerData, MenuItemSpec, MotionFrame, PetRig, Profile, RigData } from '../shared/ipc.js';
import { loadProfile, sanitizeProfile, saveProfile } from './profile.js';
import { createWanderer } from './wander.js';
import { startIdleWatch } from './idle.js';

const ASSETS_DIR = path.join(app.getAppPath(), 'assets');
const MASK_SIZE = 64;
const DEFAULT_FPS = 8;
const layerCache = new Map<string, LayerData>();

let dragTimer: NodeJS.Timeout | null = null;

export function stopDrag() {
  if (dragTimer) clearInterval(dragTimer);
  dragTimer = null;
}

// 이미지 알파값으로 64x64 "클릭 가능 지도"를 만든다 (투명 부분 클릭 통과용)
function buildMask(img: Electron.NativeImage): Uint8Array {
  const bitmap = img.resize({ width: MASK_SIZE, height: MASK_SIZE, quality: 'good' }).toBitmap();
  const mask = new Uint8Array(MASK_SIZE * MASK_SIZE);
  for (let i = 0; i < mask.length; i++) {
    mask[i] = bitmap[i * 4 + 3] > 24 ? 1 : 0;
  }
  return mask;
}

function readMask(full: string): Uint8Array | null {
  try {
    const img = nativeImage.createFromBuffer(fs.readFileSync(full));
    return img.isEmpty() ? null : buildMask(img);
  } catch {
    return null;
  }
}

function resolveAsset(rel: unknown): string | null {
  if (typeof rel !== 'string') return null;
  const full = path.resolve(ASSETS_DIR, rel);
  return full.startsWith(ASSETS_DIR + path.sep) ? full : null;
}

// 폴더 = 모션. 안의 PNG를 이름 순(1, 2, 10 …)으로 재생, motion.json으로 fps/loop 설정
function readMotion(rel: string, full: string): LayerData | null {
  const files = fs
    .readdirSync(full)
    .filter((f) => f.toLowerCase().endsWith('.png'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const frames: MotionFrame[] = [];
  for (const file of files) {
    const mask = readMask(path.join(full, file));
    if (mask) frames.push({ path: `${rel}/${file}`, mask });
  }
  if (frames.length === 0) return null;

  let meta: { fps?: unknown; loop?: unknown } = {};
  try {
    meta = JSON.parse(fs.readFileSync(path.join(full, 'motion.json'), 'utf8'));
  } catch {}

  return { frames, fps: Number(meta.fps) || DEFAULT_FPS, loop: meta.loop !== false, size: MASK_SIZE };
}

function readLayer(rel: string): LayerData | null {
  const cached = layerCache.get(rel);
  if (cached) return cached;

  const full = resolveAsset(rel);
  if (!full || !fs.existsSync(full)) return null;

  let layer: LayerData | null = null;
  if (fs.statSync(full).isDirectory()) {
    layer = readMotion(rel, full);
  } else {
    const mask = readMask(full);
    if (mask) layer = { frames: [{ path: rel, mask }], fps: 0, loop: false, size: MASK_SIZE };
  }

  if (layer) layerCache.set(rel, layer);
  return layer;
}

function readJson<T>(rel: string): T | null {
  const full = resolveAsset(rel);
  if (!full) return null;
  try {
    return JSON.parse(fs.readFileSync(full, 'utf8')) as T;
  } catch {
    return null;
  }
}

// assets/pet/rig.json이 있으면 파츠 조립 모드. 매번 새로 읽어서 json 수정이 새로고침만으로 반영됨
function readRig(): PetRig | null {
  const rig = readJson<RigData>('pet/rig.json');
  if (!rig?.pivots || !rig.params || !rig.crop) return null;
  const json = readJson<{ items?: ItemDef[]; hairStyles?: Record<string, ItemDef[]> }>('pet/items.json');
  return { rig, items: json?.items ?? [], hairStyles: json?.hairStyles ?? {} };
}

function toTemplate(items: MenuItemSpec[], send: (id: string) => void): MenuItemConstructorOptions[] {
  return items.map((item): MenuItemConstructorOptions => {
    switch (item.kind) {
      case 'separator':
        return { type: 'separator' };
      case 'submenu':
        return { label: String(item.label), submenu: toTemplate(item.submenu, send) };
      default:
        return {
          label: String(item.label),
          enabled: item.enabled !== false,
          type: item.checked === undefined ? 'normal' : 'checkbox',
          checked: !!item.checked,
          click: () => send(String(item.id)),
        };
    }
  });
}

interface IpcOptions {
  getPet: () => BrowserWindow | null;
  getSetup: () => BrowserWindow | null;
  openSetup: () => void;
  onProfileSaved: (profile: Profile) => void;
}

export function registerIpc({ getPet: getWin, getSetup, openSetup, onProfileSaved }: IpcOptions) {
  const isLive = (win: BrowserWindow | null, event: IpcMainEvent | IpcMainInvokeEvent) =>
    !!win && !win.isDestroyed() && event.sender === win.webContents;

  // 펫 창에서 온 요청만 받는다
  const ownWin = (event: IpcMainEvent | IpcMainInvokeEvent) => {
    const win = getWin();
    return isLive(win, event) ? win : null;
  };
  // 그림·프로필은 캐릭터 만들기 창에서도 쓴다
  const fromOurs = (event: IpcMainEvent | IpcMainInvokeEvent) => isLive(getWin(), event) || isLive(getSetup(), event);

  const wanderer = createWanderer(getWin, (info) => {
    const win = getWin();
    if (win && !win.isDestroyed()) win.webContents.send('pet:walk', info);
  });

  startIdleWatch(getWin);

  ipcMain.on('pet:set-ignore-mouse', (e, ignore: unknown) => {
    ownWin(e)?.setIgnoreMouseEvents(!!ignore, { forward: true });
  });

  ipcMain.on('pet:wander-allowed', (e, allowed: unknown) => {
    if (ownWin(e)) wanderer.setAllowed(!!allowed);
  });

  // 드래그: main이 커서 위치를 직접 따라감 → 마우스를 빨리 움직여도 안 놓침
  ipcMain.on('pet:drag-start', (e) => {
    const win = ownWin(e);
    if (!win) return;
    wanderer.hold('drag', true);
    stopDrag();
    const bounds = win.getBounds();
    const cursor = screen.getCursorScreenPoint();
    const offset = { x: cursor.x - bounds.x, y: cursor.y - bounds.y };

    dragTimer = setInterval(() => {
      if (win.isDestroyed()) return stopDrag();
      const p = screen.getCursorScreenPoint();
      // [win] setPosition 대신 setBounds로 크기를 고정해야 배율 다른 모니터에서 창이 안 커짐
      win.setBounds({
        x: p.x - offset.x,
        y: p.y - offset.y,
        width: bounds.width,
        height: bounds.height,
      });
    }, 16);
  });

  ipcMain.on('pet:drag-end', () => {
    stopDrag();
    wanderer.hold('drag', false);
  });

  ipcMain.on('pet:show-menu', (e, items: unknown) => {
    const win = ownWin(e);
    if (!win || !Array.isArray(items)) return;
    const send = (id: string) => {
      if (!win.isDestroyed()) win.webContents.send('pet:menu-action', id);
    };
    const template: MenuItemConstructorOptions[] = [
      ...toTemplate(items as MenuItemSpec[], send),
      { type: 'separator' },
      { label: '캐릭터 꾸미기', click: openSetup },
      { label: '펫 끄기', click: () => app.quit() },
    ];
    wanderer.hold('menu', true);
    Menu.buildFromTemplate(template).popup({ window: win, callback: () => wanderer.hold('menu', false) });
  });

  ipcMain.handle('pet:load-layer', (e, candidates: unknown) => {
    if (!fromOurs(e) || !Array.isArray(candidates)) return null;
    for (const rel of candidates) {
      if (typeof rel !== 'string') continue;
      const layer = readLayer(rel);
      if (layer) return layer;
    }
    return null;
  });

  ipcMain.handle('pet:load-rig', (e) => (fromOurs(e) ? readRig() : null));

  // 캐릭터 만들기 창: 글꼴·화면 배율이 달라도 안 잘리게 내용 높이에 맞춤 (화면보다 크면 화면 높이까지)
  ipcMain.on('setup:fit', (e, neededCss: unknown, viewportCss: unknown) => {
    const win = getSetup();
    if (!win || !isLive(win, e) || typeof neededCss !== 'number' || typeof viewportCss !== 'number' || viewportCss <= 0) return;
    // CSS 픽셀 → 창 크기 단위 (화면 확대를 쓰면 1이 아님)
    const scale = win.getContentSize()[1] / viewportCss;
    const area = screen.getDisplayMatching(win.getBounds()).workArea;
    const frame = win.getSize()[1] - win.getContentSize()[1];
    const height = Math.round(Math.min(Math.max(Math.ceil(neededCss * scale), 400), area.height - frame - 24));
    win.setContentSize(win.getContentSize()[0], height);
    win.center();
    if (!win.isVisible()) win.show();
  });

  ipcMain.handle('profile:get', (e) => (fromOurs(e) ? loadProfile() : null));

  ipcMain.handle('profile:save', (e, input: unknown) => {
    if (!isLive(getSetup(), e)) return false;
    const profile = sanitizeProfile(input);
    if (!profile) return false;
    saveProfile(profile);
    onProfileSaved(profile);
    return true;
  });
}
