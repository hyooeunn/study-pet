const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petAPI', {
  platform: process.platform,
  setIgnoreMouse: (ignore) => ipcRenderer.send('pet:set-ignore-mouse', ignore),
  dragStart: () => ipcRenderer.send('pet:drag-start'),
  dragEnd: () => ipcRenderer.send('pet:drag-end'),
  showMenu: (items) => ipcRenderer.send('pet:show-menu', items),
  loadLayer: (candidates) => ipcRenderer.invoke('pet:load-layer', candidates),
  quit: () => ipcRenderer.send('pet:quit'),
  onMenuAction: (callback) => {
    const handler = (_event, id) => callback(id);
    ipcRenderer.on('pet:menu-action', handler);
    return () => ipcRenderer.removeListener('pet:menu-action', handler);
  },
});
