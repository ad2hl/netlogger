import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as http from 'http';
import { spawn, ChildProcess } from 'child_process';

const isDev = process.env.NODE_ENV === 'development' || process.env.ELECTRON_DEV === '1';

let mainWindow: BrowserWindow | null = null;
let serverProcess: ChildProcess | null = null;

// Find a free port starting from the given one
async function findFreePort(startPort: number): Promise<number> {
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
async function waitForServer(port: number, maxMs: number = 60000): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get(`http://localhost:${port}/api/health`, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else {
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

async function startNextServer(port: number): Promise<void> {
  const serverScript = path.join(__dirname, '..', '.next', 'standalone', 'server.js');

  serverProcess = spawn(process.execPath, [serverScript], {
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

async function createWindow(url: string): Promise<void> {
  mainWindow = new BrowserWindow({
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
ipcMain.handle('qrz-lookup', async (_event, callsign: string, username: string, password: string) => {
  try {
    const QRZ_API_URL = 'https://xmldata.qrz.com/xml/current/';

    const fetchXml = (url: string): Promise<string> => {
      return new Promise((resolve, reject) => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const mod = require('https');
        mod.get(url, (res: http.IncomingMessage) => {
          let data = '';
          res.on('data', (chunk: string) => { data += chunk; });
          res.on('end', () => resolve(data));
        }).on('error', reject);
      });
    };

    const parseXMLValue = (xml: string, tag: string): string => {
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
  } catch (err) {
    console.error('QRZ IPC error:', err);
    return { error: String(err) };
  }
});

app.on('ready', async () => {
  try {
    if (isDev) {
      // In dev mode, Next.js dev server is already running on 3000
      const port = parseInt(process.env.NEXT_DEV_PORT || '3000', 10);
      await waitForServer(port, 60000);
      await createWindow(`http://localhost:${port}`);
    } else {
      // In production, spawn the standalone Next.js server
      const port = await findFreePort(3000);
      await startNextServer(port);
      await waitForServer(port, 60000);
      await createWindow(`http://localhost:${port}`);
    }
  } catch (err) {
    console.error('Failed to start:', err);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', async () => {
  if (mainWindow === null) {
    const port = isDev
      ? parseInt(process.env.NEXT_DEV_PORT || '3000', 10)
      : await findFreePort(3001);
    await createWindow(`http://localhost:${port}`);
  }
});

app.on('will-quit', () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});
