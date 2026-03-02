"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('electron', {
    isDesktop: true,
    lookupQrz: (callsign, username, password) => electron_1.ipcRenderer.invoke('qrz-lookup', callsign, username, password),
});
