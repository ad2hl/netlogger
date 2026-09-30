import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  isDesktop: true,
});
