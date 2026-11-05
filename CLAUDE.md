# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NetLogger is a web-based amateur radio net logging application for net control operators. It tracks station check-ins, manages traffic, and generates ARRL-format radiogram reports with callsign compression.

## Development Commands

```bash
npm run dev      # Start development server at http://localhost:3000
npm run build    # Build for production
npm run lint     # Run ESLint
npm start        # Start production server
```

## Tech Stack

- Next.js 15 (App Router) with TypeScript
- Firebase (Authentication + Firestore + App Check)
- Tailwind CSS
- React 18 with client components
- pdf-lib (ARRL radiogram PDF form filling)

## Architecture

### Data Layer

Firebase Firestore with user-scoped subcollections:
- `users/{uid}/stations/{callsign}` - Station memory (nicknames, notes, last-seen)
- `users/{uid}/sessions/{sessionId}` - Net sessions with check-ins, checklist items, and `radiogramIds[]`
- `users/{uid}/radiograms/{radiogramId}` - Individual radiograms (independent of sessions)

Radiograms are first-class documents, not embedded arrays. A radiogram created during a session carries a `sessionId` back-reference and its ID is listed in the session's `radiogramIds[]` array (bidirectional). Radiograms created from the /radiograms page have no `sessionId`. Deleting a session never cascades to radiograms.

On first read after the schema migration, `getSession`/`getAllSessions`/`getRecentSessions` detect old sessions that still have an embedded `radiograms[]` array and atomically migrate them to the new collection (lazy migration via `writeBatch`).

### Key Libraries (lib/)

- **firestore.ts**: Thin wrapper that re-exports the database CRUD operations for stations, sessions, check-ins, radiograms and the profile from `lib/db/`
- **db/**: `interface.ts` defines `NetLoggerDB`, implemented by `firebase-impl.ts` (Firestore, web) and `dexie-impl.ts` (IndexedDB via Dexie, desktop app; see `DESKTOP.md`). `index.ts` picks one at build time from `NEXT_PUBLIC_DESKTOP_MODE`. Besides the normal CRUD methods it has import-only methods (`replaceUserProfile`, `importStation`, `importRadiogram`, `deleteAllData`) used by `dataTransfer.ts`
- **radiogram.ts**: Complex callsign compression algorithm for ARRL format reports. Orders output as NC → ANC → Liaisons → Regular stations. Compresses callsigns by prefix (e.g., W1AW, W1XYZ → W1AW, XYZ)
- **radiogramPrint.ts**: Fills the official ARRL radiogram PDF form (`public/radiogram-form.pdf`) with radiogram data using pdf-lib and opens the result in a new browser tab. Font sizes: 11pt for message words, 10pt for address, 9pt for preamble/signature/disposition. Simple 1:1 address line mapping (line 1 → Name/Call, line 2 → Address, line 3 → City/State/ZIP, line 4 → unlabeled extra line, typically phone or email; the underlying PDF field is still named "Recipient Phone" but the TELEPHONE NUMBER legend was removed from the form).
- **auth.ts**: Firebase authentication functions
- **auth-api.ts**: Server-side Firebase ID token verification for API routes (`verifyAuth`)
- **appcheck-api.ts**: Server-side Firebase App Check token verification (`verifyAppCheck`)
- **api-fetch.ts**: Client-side fetch wrapper that attaches App Check tokens to outgoing requests
- **firebase.ts**: Client-side Firebase initialization (app, auth, Firestore, App Check). App Check is only initialized when `NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY` is set.
- **firebase-admin.ts**: Firebase Admin SDK initialization (uses `GOOGLE_APPLICATION_CREDENTIALS`); exports `getAdminApp()` and `getAdminAuth()`
- **callsignLookup.ts**: Client for the free, no-auth Callook.info and HamDB.org callsign lookup services (`lookupCallsign(service, callsign)`), normalized into a common `CallsignLookupResult` shape
- **time.ts**: All dates/times are stored in UTC (issue #292); the user's Settings choice (`UserProfile.timeZone`, `'local'` default or `'utc'`) only affects entry and display. Helpers convert between stored and displayed forms at the UI edge: `sessionToDisplay`/`sessionToStored` (session `date` is a Timestamp at midnight UTC of the UTC start date; `startTime`/`endTime` are UTC `"HH:MM"`), `radiogramTimesToDisplay`/`radiogramTimesToStored` (Received/Sent date+time), plus `nowParts`, `formatTimeString` (`"1024Z"` in UTC mode) and `formatPrintTime` (printed times get a trailing `Z` in UTC mode). Radiogram objects passed between components and to the print functions are always in stored (UTC) form; only form state holds displayed values. The preamble Time Filed/Date are message content and are never converted. `lib/useUtc.ts` exposes the setting as a hook.
- **dataTransfer.ts**: Whole-database export/import as a pretty-printed JSON text file (issue #331), used to copy data between the web and desktop versions. `exportDatabase(uid)` writes `{ format: 'netlogger-export', version, exportedAt, source, settings, stations, sessions, radiograms }` with every Timestamp/Date as an ISO string. `parseExportFile` validates; by default `importDatabase(uid, file)` never deletes: settings are replaced (`replaceUserProfile`), sessions and radiograms are always added with fresh IDs (duplicates become second copies) and their bidirectional links re-pointed at the new IDs, and stations are added or merged (the file's non-null fields win, the later `lastSeen` is kept). With `{ replaceExisting: true }` (the "Delete all existing data first" checkbox, for restoring a backup) it first calls `deleteAllData`, which removes every station, session and radiogram but not the settings profile, and aborts the import if that fails. Writes go through the `NetLoggerDB` methods `replaceUserProfile`/`importStation`/`importRadiogram`, which preserve timestamps instead of stamping "now". UI: `components/DataTransfer.tsx` on the Settings page.
- **content.ts**: Content loader with local override (`content/local/` → `content/default/` fallback). `readContent(filename)` for plain text/markdown. `readContentWithType(basename)` tries `.html` then `.md` and returns `{ content, type }` — used by all content API routes so operators can supply HTML instead of Markdown.

### Tag System

Station tags drive UI display and report formatting:
- **Status tags** (single letter): `/T` (Traffic), `/A` (Announcement), `/S` (Secure), `/IO` (In-and-out), `/M` (Mobile), `/P` (Portable)
- **Role tags**: `/NC` (Net Control), `/ANC` (Alternate NC)
- **Liaison tags** (multi-letter): e.g., `/OC`, `/HVN` - used for net liaisons

The `isStatusTag()` and `getTagLabel()` utilities in `types/index.ts` differentiate tag types.

### API Routes

All API routes (except `/api/health`) are protected by Firebase App Check. Authenticated routes additionally verify Firebase ID tokens. Client code must use `apiFetch()` from `lib/api-fetch.ts` instead of `fetch()` for all API calls so the App Check token is attached.

- **app/api/lookup/route.ts**: Operator name/location lookups via Callook.info or HamDB.org, selected by the `service` query param (App Check only, no auth or credentials needed)
- **app/api/callook/route.ts**: callook.info license grant-date lookups for newly licensed ham detection (App Check only)
- **app/api/login-banner/route.ts**: Serves markdown banner for login/signup pages (App Check only)
- **app/api/login-background/route.ts**: Serves login background image (App Check only)
- **app/api/header-message/route.ts**: Serves markdown message for page headers (App Check only)
- **app/api/about/route.ts**: Serves about page content (App Check only)
- **app/api/privacy-policy/route.ts**: Serves full privacy policy (App Check only)
- **app/api/privacy-policy-summary/route.ts**: Serves privacy policy summary (App Check only)
- **app/api/help/route.ts**: Serves per-page help content (no App Check — public). `app/help/page.tsx` renders it with `<ContentRenderer toc />`, which turns on `remark-gfm` (tables) and `remark-toc` + `rehype-slug` for Markdown: a table of contents is generated under any heading named "Contents" or "Table of Contents" (issue #321). Other `ContentRenderer` uses render plain Markdown without these plugins.
- **app/api/footer-credit/route.ts**: Serves optional footer credit text (no App Check — public)
- **app/api/local-content/route.ts**: Generic local content file reader (App Check only)
- **app/api/health/route.ts**: Health check endpoint (no protection — used by monitoring)

### Main Components

- **app/net/page.tsx**: Main logging interface orchestrating all functionality; renders a three-column grid with CheckInForm+CheckInList on the left and SessionSummary+Checklist on the right. There is no Radiograms panel (issue #325) — operators open the /radiograms page in another tab. Renaming the net still propagates the new name to the session's radiograms (`sessionNetName`) via `getRadiogramsBySession`.
- **app/sessions/page.tsx**: Session history list with New Session button in the main content area (not the header); accepts `?new=1` to auto-open the modal on load
- **app/radiograms/page.tsx**: Cross-session radiogram history, sortable by date, net name, type, and disposition. Fetches radiograms directly from the `users/{uid}/radiograms` collection via `getAllRadiograms`; also fetches sessions (for net reports only). "New Radiogram" creates a standalone radiogram with no session association.
- **app/stations/page.tsx**: Station memory list with sortable columns (callsign, name, nickname, location, note, last seen, check-in count). "Add Station" button opens a modal to manually create a station (all fields except lastSeen; duplicate callsigns are rejected). Row hover reveals Edit and Delete buttons.
- **app/settings/page.tsx**: User profile settings including `receivingStationName` (printed in the RECEIVED AT section of radiogram PDFs, distinct from the operator's first name used for signatures); ends with the Export & Import Data section (`components/DataTransfer.tsx`)
- **components/SessionSummary.tsx**: Displays session metadata (Net Name, Date, Start/End, NC/ANC, station/traffic counts) with an inline Edit modal
- **components/TimeInput.tsx**: Time entry field — the native time picker in local mode; a 24-hour `HHMM` text field followed by "Z" (no AM/PM) in UTC mode. Value is always `"HH:MM"`.
- **components/CheckInForm.tsx**: Single-line check-in input; supports callsign search (trailing `?`, e.g. `AW?`; issue #333), tag parsing, and callsign lookups; includes the Walt Whitman easter egg for callsign P0ET
- **components/CheckInList.tsx**: Scrollable list of checked-in stations; auto-scrolls to bottom on new check-in
- **components/Checklist.tsx**: Traffic and announcements checklist. Traffic entries can be edited inline (✎ on hover). Each entry counts as `getTrafficItemCount(item)` messages (types/index.ts) — the first number in the destination not adjacent to a letter or `/` (`WM2C 2`, `3 WM2C`, `WM2C (4)`; not `W1AW/8`), else 1 — and the session's Traffic Rptd/Clrd counts are adjusted by that amount on add, check/uncheck, edit and delete (issue #299)
- **components/RadiogramForm.tsx**: ARRL standard radiogram entry form. Includes: green ✓ / red ✗ indicator next to the Check field (compares entered value against actual word count); Print button that calls `printRadiogram()`; "Fill Date" / "Fill Time & Date" buttons after the preamble Date fill it (`OCT 23`, via `formatPreambleDate`) and optionally Time Filed (`HHMM`, `Z` suffix in UTC mode) from the current time in the Settings zone (issue #313); `userProfile` prop for RECEIVED AT data. There is no separate phone field — a phone number or email is entered as an additional Addressee line (issue #258); legacy `addressPhone` values are folded into the address when a radiogram is opened for editing. Pasting multi-token text into a Text word-group field splits it on whitespace/tabs, dropping each token into its own word group starting at the paste target and growing the grid as needed (issue #287). On an existing book, "Split into Messages" saves the book, then creates one standalone radiogram per book entry (same session association); the book itself is kept (issue #301). Import (DTN paste) checks the parsed radiogram with `findInvalidRadiogramChars` (lib/radiogram.ts) — anything other than A–Z, 0–9, `/` and whitespace, the same rule typed input enforces — and, if any are found, shows an Invalid Characters modal listing them with Go Back / Import As-Is / Remove and Import (`stripInvalidRadiogramChars`) (issue #314)
- **components/ReadOnlyRadiogram.tsx**: Read-only radiogram viewer with Print button
- **components/StationCard.tsx**: Individual station row with inline editing for callsign, name, location, and note
- **components/AuthProvider.tsx**: Firebase auth context with Google profile photo caching
- **components/HeaderBanner.tsx**: Inline markdown banner in page headers

### Scripts

- **scripts/import_stations.py**: Import station callsigns/nicknames from CSV into Firestore
- **scripts/update_lastseen.py**: Backfill station `lastSeen` from historical session data
- **scripts/migrate_to_utc.py**: One-shot conversion of a user's Firestore session and radiogram dates/times from local time to UTC (issue #292); `<uid> --tz <IANA zone> [--dry-run]`. Times already ending in `Z` are left alone. Idempotent and safe to re-run: sessions whose `date` is midnight UTC and radiograms with `timesUtc: true` are skipped, and each document's conversion and marker are written together. Run it soon after deploying, before pre-migration records are edited in the app

## Firebase Configuration

Required environment variables in `.env.local` (see `.env.local.example`):
```
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY
```

In `NODE_ENV === 'development'`, App Check debug mode is **auto-enabled** — the SDK logs an auto-generated UUID to the browser console on first run. Copy that UUID, register it in Firebase Console → App Check → Manage debug tokens, and subsequent runs work without any env var. See `APPCHECK.md` for full details.

App Check is enforced at two levels: **Firestore** (via Firebase Console enforcement) rejects all direct client SDK reads and writes without a valid token, and all **server-side API routes** (except `/api/health`) call `verifyAppCheck` and return HTTP 401 without a valid token. If `NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY` is absent, App Check is not initialized and the app will be non-functional. See `APPCHECK.md` for details on running without App Check.

### Server-Side Authentication & App Check

API routes are protected by two layers:
1. **App Check** (`verifyAppCheck`): Verifies the request originates from the legitimate web app via `X-Firebase-AppCheck` header
2. **Auth** (`verifyAuth`): Verifies the user's Firebase ID token via `Authorization: Bearer <token>` header

On non-Google-Cloud hosts, set:
```
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

### Docker Deployment

The app uses `output: 'standalone'` in `next.config.js` for Docker builds. **Important**: All `NEXT_PUBLIC_*` variables must be passed as build args (not runtime env vars) because Next.js inlines them into the client bundle at build time. The Dockerfile declares these as `ARG` entries, and `docker-compose.yml` maps them from `.env`.

Runtime env vars (like `GOOGLE_APPLICATION_CREDENTIALS`) are passed via `env_file` in docker-compose. Secrets are mounted from `/etc/netlogger/secrets` and content overrides from `./content/local`.

## Color Scheme

UI uses cyan-700 for primary actions, sky shades for backgrounds/hover states, and amber-700 for radiogram-related buttons (New Radiogram, Create Radiogram).

## Key Types (types/index.ts)

- **`Station`**: includes `grantDate?: string | null` (ISO date from callook.info; `null` = checked but no date found; `undefined` = not yet checked). Used by `isNewHam()` to flag stations licensed within the past month.
- **`Radiogram`**: includes `addressPhone?: string` (legacy — phone is now an address line; kept so old documents still display/print), `sessionId?: string` (set when created during a session; absent for standalone radiograms), `sessionNetName?: string` (denormalized net name for display without a session join), and `timesUtc?: boolean` (Received/Sent times are known to be UTC; set by `addRadiogram`/`splitBookRadiogram` in the Firebase backend and by `scripts/migrate_to_utc.py`)
- **`NetSession`**: uses `radiogramIds: string[]` (list of associated radiogram document IDs) instead of an embedded `radiograms: Radiogram[]` array
- **`UserProfile`**: includes `receivingStationName?: string` (for RECEIVED AT on printed radiograms, separate from `name` used for signatures) `lookupService?: LookupService` (`'callook'` | `'hamdb'`; defaults to `'callook'` for new users when unset), and `timeZone?: TimeZoneMode` (`'local'` | `'utc'`; defaults to `'local'`)

## TypeScript

- Strict mode enabled
- Path alias `@/*` maps to project root
- Central type definitions in `types/index.ts`

## ESLint

`npm run lint` runs `eslint .` directly (not the deprecated `next lint`) with the flat config in `eslint.config.mjs`, which extends `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`. Names prefixed with `_` and rest-sibling destructuring are exempt from `no-unused-vars`. The React hooks rules include `set-state-in-effect`: to reset state when a prop changes, compare against the previous value during render (see `RadiogramForm`, `Checklist`) rather than calling `setState` in an effect.

## ChunkLoadError Handling

`next.config.js` sets webpack `chunkLoadTimeout` to 300 000 ms (5 minutes) to give the dev server time to compile on first request after a restart. `app/layout.tsx` includes an inline script that auto-reloads the page on any `ChunkLoadError` (covers both the dev restart case and stale chunk hashes after a production deploy).
