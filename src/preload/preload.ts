import { contextBridge, ipcRenderer } from 'electron';
import type { PetAPI } from '../shared/ipc.js';

// sandbox preload는 다른 로컬 파일을 require할 수 없어서 타입만 import (import type)
const api: PetAPI = {
  platform: process.platform,
  setIgnoreMouse: (ignore) => ipcRenderer.send('pet:set-ignore-mouse', ignore),
  dragStart: () => ipcRenderer.send('pet:drag-start'),
  dragEnd: () => ipcRenderer.send('pet:drag-end'),
  showMenu: (items) => ipcRenderer.send('pet:show-menu', items),
  loadLayer: (candidates) => ipcRenderer.invoke('pet:load-layer', candidates),
  quit: () => ipcRenderer.send('pet:quit'),
  onMenuAction: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, id: string) => callback(id);
    ipcRenderer.on('pet:menu-action', handler);
    return () => ipcRenderer.removeListener('pet:menu-action', handler);
  },
};

contextBridge.exposeInMainWorld('petAPI', api);
