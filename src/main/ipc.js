const { app, ipcMain, Menu, screen, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');

const ASSETS_DIR = path.join(app.getAppPath(), 'assets');
const MASK_SIZE = 64;
const layerCache = new Map();

let dragTimer = null;

function stopDrag() {
  clearInterval(dragTimer);
  dragTimer = null;
}

// 이미지 알파값으로 64x64 "클릭 가능 지도"를 만든다 (투명 부분 클릭 통과용)
function buildMask(img) {
  const bitmap = img.resize({ width: MASK_SIZE, height: MASK_SIZE, quality: 'good' }).toBitmap();
  const mask = new Uint8Array(MASK_SIZE * MASK_SIZE);
  for (let i = 0; i < mask.length; i++) {
    mask[i] = bitmap[i * 4 + 3] > 24 ? 1 : 0;
  }
  return mask;
}

function readLayer(rel) {
  if (typeof rel !== 'string') return null;
  if (layerCache.has(rel)) return layerCache.get(rel);

  const full = path.resolve(ASSETS_DIR, rel);
  if (!full.startsWith(ASSETS_DIR + path.sep) || !fs.existsSync(full)) return null;

  const img = nativeImage.createFromBuffer(fs.readFileSync(full));
  if (img.isEmpty()) return null;

  const layer = { path: rel, mask: buildMask(img), size: MASK_SIZE };
  layerCache.set(rel, layer);
  return layer;
}

function toTemplate(items, send) {
  return items.map((item) => {
    if (item.type === 'separator') return { type: 'separator' };
    if (Array.isArray(item.submenu)) {
      return { label: String(item.label), submenu: toTemplate(item.submenu, send) };
    }
    return {
      label: String(item.label),
      enabled: item.enabled !== false,
      type: item.checked === undefined ? 'normal' : 'checkbox',
      checked: !!item.checked,
      click: () => send(item.id),
    };
  });
}

function registerIpc(getWin) {
  // 우리 펫 창에서 온 요청만 받는다
  const ownWin = (event) => {
    const win = getWin();
    return win && !win.isDestroyed() && event.sender === win.webContents ? win : null;
  };

  ipcMain.on('pet:set-ignore-mouse', (e, ignore) => {
    ownWin(e)?.setIgnoreMouseEvents(!!ignore, { forward: true });
  });

  // 드래그: main이 커서 위치를 직접 따라감 → 마우스를 빨리 움직여도 안 놓침
  ipcMain.on('pet:drag-start', (e) => {
    const win = ownWin(e);
    if (!win) return;
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

  ipcMain.on('pet:drag-end', stopDrag);

  ipcMain.on('pet:show-menu', (e, items) => {
    const win = ownWin(e);
    if (!win || !Array.isArray(items)) return;
    const send = (id) => {
      if (!win.isDestroyed()) win.webContents.send('pet:menu-action', id);
    };
    const template = [
      ...toTemplate(items, send),
      { type: 'separator' },
      { label: '펫 끄기', click: () => app.quit() },
    ];
    Menu.buildFromTemplate(template).popup({ window: win });
  });

  ipcMain.handle('pet:load-layer', (e, candidates) => {
    if (!ownWin(e) || !Array.isArray(candidates)) return null;
    for (const rel of candidates) {
      const layer = readLayer(rel);
      if (layer) return layer;
    }
    return null;
  });

  ipcMain.on('pet:quit', (e) => {
    if (ownWin(e)) app.quit();
  });
}

module.exports = { registerIpc, stopDrag };
