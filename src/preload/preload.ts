import { contextBridge, ipcRenderer } from 'electron';
import type { PetAPI, WalkInfo } from '../shared/ipc.js';

// sandbox preload는 다른 로컬 파일을 require할 수 없어서 타입만 import (import type)
const api: PetAPI = {
  platform: process.platform,
  setIgnoreMouse: (ignore) => ipcRenderer.send('pet:set-ignore-mouse', ignore),
  dragStart: () => ipcRenderer.send('pet:drag-start'),
  dragEnd: () => ipcRenderer.send('pet:drag-end'),
  showMenu: (items) => ipcRenderer.send('pet:show-menu', items),
  loadLayer: (candidates) => ipcRenderer.invoke('pet:load-layer', candidates),
  loadRig: () => ipcRenderer.invoke('pet:load-rig'),
  onMenuAction: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, id: string) => callback(id);
    ipcRenderer.on('pet:menu-action', handler);
    return () => ipcRenderer.removeListener('pet:menu-action', handler);
  },
  setWanderAllowed: (allowed) => ipcRenderer.send('pet:wander-allowed', allowed),
  onWalk: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, info: WalkInfo | null) => callback(info);
    ipcRenderer.on('pet:walk', handler);
    return () => ipcRenderer.removeListener('pet:walk', handler);
  },
  onSystemIdle: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, seconds: number) => callback(seconds);
    ipcRenderer.on('pet:system-idle', handler);
    return () => ipcRenderer.removeListener('pet:system-idle', handler);
  },
};

contextBridge.exposeInMainWorld('petAPI', api);
