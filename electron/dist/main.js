"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("path"));
const http = __importStar(require("http"));
const child_process_1 = require("child_process");
const isDev = process.env.NODE_ENV === 'development' || process.env.ELECTRON_DEV === '1';
let mainWindow = null;
let serverProcess = null;
// Find a free port starting from the given one
async function findFreePort(startPort) {
    return new Promise((resolve, reject) => {
        const server = http.createServer();
        server.listen(startPort, () => {
            const addr = server.address();
            const port = typeof addr === 'object' && addr ? addr.port : startPort;
            server.close(() => resolve(port));
        });
        server.on('error', () => {
            findFreePort(startPort + 1).then(resolve).catch(reject);
        });
    });
}
// Poll until the server responds on the health endpoint
async function waitForServer(port, maxMs = 60000) {
    const start = Date.now();
    return new Promise((resolve, reject) => {
        const check = () => {
            const req = http.get(`http://localhost:${port}/api/health`, (res) => {
                if (res.statusCode === 200) {
                    resolve();
                }
                else {
                    retry();
                }
            });
            req.on('error', retry);
            req.end();
        };
        const retry = () => {
            if (Date.now() - start > maxMs) {
                reject(new Error('Server did not start in time'));
                return;
            }
            setTimeout(check, 500);
        };
        check();
    });
}
async function startNextServer(port) {
    const serverScript = path.join(__dirname, '..', '.next', 'standalone', 'server.js');
    serverProcess = (0, child_process_1.spawn)(process.execPath, [serverScript], {
        env: {
            ...process.env,
            PORT: String(port),
            HOSTNAME: '127.0.0.1',
            NODE_ENV: 'production',
            NEXT_PUBLIC_DESKTOP_MODE: 'true',
        },
        stdio: 'inherit',
    });
    serverProcess.on('error', (err) => {
        console.error('Failed to start Next.js server:', err);
    });
}
async function createWindow(url) {
    mainWindow = new electron_1.BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 960,
        minHeight: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
        title: 'AD2HL Net Logger',
    });
    await mainWindow.loadURL(url);
    if (isDev) {
        mainWindow.webContents.openDevTools();
    }
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
// QRZ lookup IPC handler — runs in main process to avoid CORS
electron_1.ipcMain.handle('qrz-lookup', async (_event, callsign, username, password) => {
    try {
        const QRZ_API_URL = 'https://xmldata.qrz.com/xml/current/';
        const fetchXml = (url) => {
            return new Promise((resolve, reject) => {
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const mod = require('https');
                mod.get(url, (res) => {
                    let data = '';
                    res.on('data', (chunk) => { data += chunk; });
                    res.on('end', () => resolve(data));
                }).on('error', reject);
            });
        };
        const parseXMLValue = (xml, tag) => {
            const regex = new RegExp(`<${tag}>([^<]*)</${tag}>`);
            const match = xml.match(regex);
            return match ? match[1] : '';
        };
        // Get QRZ session
        const sessionParams = new URLSearchParams({ username, password, agent: 'NetLogger/1.0' });
        const sessionXml = await fetchXml(`${QRZ_API_URL}?${sessionParams.toString()}`);
        const sessionError = parseXMLValue(sessionXml, 'Error');
        if (sessionError) {
            return { error: sessionError };
        }
        const sessionKey = parseXMLValue(sessionXml, 'Key');
        if (!sessionKey) {
            return { error: 'No session key returned from QRZ' };
        }
        // Look up callsign
        const lookupParams = new URLSearchParams({ s: sessionKey, callsign: callsign.toUpperCase() });
        const lookupXml = await fetchXml(`${QRZ_API_URL}?${lookupParams.toString()}`);
        const lookupError = parseXMLValue(lookupXml, 'Error');
        if (lookupError) {
            return { callsign: callsign.toUpperCase(), error: lookupError };
        }
        return {
            callsign: parseXMLValue(lookupXml, 'call') || callsign.toUpperCase(),
            firstName: parseXMLValue(lookupXml, 'fname'),
            lastName: parseXMLValue(lookupXml, 'name'),
            nickname: parseXMLValue(lookupXml, 'nickname'),
            city: parseXMLValue(lookupXml, 'addr2'),
            state: parseXMLValue(lookupXml, 'state'),
            country: parseXMLValue(lookupXml, 'country'),
        };
    }
    catch (err) {
        console.error('QRZ IPC error:', err);
        return { error: String(err) };
    }
});
electron_1.app.on('ready', async () => {
    try {
        if (isDev) {
            // In dev mode, Next.js dev server is already running on 3000
            const port = parseInt(process.env.NEXT_DEV_PORT || '3000', 10);
            await waitForServer(port, 60000);
            await createWindow(`http://localhost:${port}`);
        }
        else {
            // In production, spawn the standalone Next.js server
            const port = await findFreePort(3000);
            await startNextServer(port);
            await waitForServer(port, 60000);
            await createWindow(`http://localhost:${port}`);
        }
    }
    catch (err) {
        console.error('Failed to start:', err);
        electron_1.app.quit();
    }
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
electron_1.app.on('activate', async () => {
    if (mainWindow === null) {
        const port = isDev
            ? parseInt(process.env.NEXT_DEV_PORT || '3000', 10)
            : await findFreePort(3001);
        await createWindow(`http://localhost:${port}`);
    }
});
electron_1.app.on('will-quit', () => {
    if (serverProcess) {
        serverProcess.kill();
        serverProcess = null;
    }
});
