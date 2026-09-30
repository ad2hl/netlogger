# AD2HL Net Logger — Desktop App

AD2HL Net Logger is available as a standalone desktop application built with
[Electron](https://www.electronjs.org/). It runs the full Next.js application
locally inside a native window — no browser required, no internet connection
required, no Firebase account, and no Google sign-in.

## How It Differs from the Web App

| Feature | Web app | Desktop app |
|---|---|---|
| Authentication | Google sign-in (Firebase) | None — single local user |
| Data storage | Firestore (cloud) | IndexedDB on your machine |
| App Check | Required | Not used |
| Session timeout | 8 hours (configurable) | Never |
| Multi-device sync | Yes | No |

Everything else — session logging, radiograms, net reports, PDF printing,
callsign compression, callsign lookups, the Stations page — works the same as
the web version.

## Data Storage

The desktop app stores all data locally using
[Dexie.js](https://dexie.org/) (an IndexedDB wrapper). There is no cloud
backup and no sync. The database is named `netlogger-desktop`.

### Data Location

Electron stores the IndexedDB files in its user-data directory, inside a
`Default` subdirectory:

| Platform | Path |
|---|---|
| **macOS** | `~/Library/Application Support/AD2HL Net Logger/Default/` |
| **Windows** | `%APPDATA%\AD2HL Net Logger\Default\` |
| **Linux** | `~/.config/AD2HL Net Logger/Default/` |

The IndexedDB files are managed by Chromium's storage layer and are not
human-readable. To back up your data, copy the entire user-data directory to
a safe location.

### What Is Stored

- Station memory (callsigns, names, nicknames, locations, notes, last-seen dates)
- Net sessions (check-ins, checklist items, session metadata)
- Radiograms
- Your settings profile (callsign, name, lookup service preference, disposition methods, etc.)

## Building

### Prerequisites

- **Node.js 18.17 or later** — <https://nodejs.org/>
- **npm** (bundled with Node.js)
- The repository cloned and dependencies installed:

```bash
git clone https://github.com/rd914/netlogger.git
cd netlogger
npm install
```

### Environment Setup

The desktop build uses its own environment file that omits all Firebase
credentials. Copy the example file before building:

```bash
cp .env.desktop.example .env.local
```

The file contains only one meaningful setting:

```
NEXT_PUBLIC_DESKTOP_MODE=true
```

Do not mix this `.env.local` with the one used for the web app — they are
mutually exclusive.

### Build Command

```bash
npm run electron:build
```

This runs three steps in sequence:

1. **Next.js build** with `NEXT_PUBLIC_DESKTOP_MODE=true` — produces a
   standalone server bundle in `.next/standalone/`
2. **Electron main-process compile** — compiles `electron/main.ts` and
   `electron/preload.ts` to `electron/dist/`
3. **electron-builder** — packages everything into a platform installer in
   `dist/`

### Output Files

| Platform | File |
|---|---|
| macOS (Apple Silicon) | `dist/AD2HL Net Logger-<version>-arm64.dmg` |
| macOS (Intel) | `dist/AD2HL Net Logger-<version>-x64.dmg` |
| Windows | `dist/AD2HL Net Logger Setup <version>.exe` |
| Linux | `dist/AD2HL Net Logger-<version>.AppImage` |

### Cross-Platform Builds

electron-builder produces an installer for the platform it is running on.
You cannot build a Windows `.exe` on a Mac or vice versa without additional
tooling.

| Target platform | Build machine needed |
|---|---|
| macOS `.dmg` | macOS |
| Windows `.exe` (NSIS) | Windows |
| Linux `.AppImage` | Linux |

For CI/CD, the standard approach is to run the build job on a native runner
for each target platform (e.g., separate GitHub Actions jobs for
`macos-latest`, `windows-latest`, and `ubuntu-latest`).

### macOS Code Signing

Unsigned macOS apps trigger a Gatekeeper warning on first launch. To
distribute without this warning, sign and notarize the app with an Apple
Developer ID certificate. See the
[electron-builder macOS signing docs](https://www.electron.build/code-signing)
for details. For personal use on your own machine, you can bypass the warning
by right-clicking the `.app` and choosing **Open** on first launch.

## Development

To run the desktop app in development mode (with hot-reload for the
renderer, and DevTools open automatically):

1. Compile the Electron main process once (repeat if `electron/main.ts` or
   `electron/preload.ts` change):

   ```bash
   npm run electron:compile
   ```

2. Start the dev server and Electron together:

   ```bash
   npm run electron:dev
   ```

   This runs `next dev` and waits for it to be ready before launching
   Electron. The renderer DevTools open automatically in dev mode.

> Make sure `.env.local` contains `NEXT_PUBLIC_DESKTOP_MODE=true` before
> running either command. Using the web-app `.env.local` (with Firebase
> credentials) in desktop mode will cause a build-time mismatch — the app
> will still work but the Firebase credentials are unused and bundled
> unnecessarily.
