import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  isDesktop: true,
  lookupQrz: (callsign: string, username: string, password: string) =>
    ipcRenderer.invoke('qrz-lookup', callsign, username, password),
});
