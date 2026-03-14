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

- Next.js 14 (App Router) with TypeScript
- Firebase (Authentication + Firestore + App Check)
- Tailwind CSS
- React 18 with client components
- pdf-lib (ARRL radiogram PDF form filling)

## Architecture

### Data Layer

Firebase Firestore with user-scoped subcollections:
- `users/{uid}/stations/{callsign}` - Station memory (nicknames, notes, last-seen)
- `users/{uid}/sessions/{sessionId}` - Net sessions with check-ins, radiograms, checklist items

### Key Libraries (lib/)

- **firestore.ts**: All database CRUD operations for stations, sessions, check-ins
- **radiogram.ts**: Complex callsign compression algorithm for ARRL format reports. Orders output as NC → ANC → Liaisons → Regular stations. Compresses callsigns by prefix (e.g., W1AW, W1XYZ → W1AW, XYZ)
- **radiogramPrint.ts**: Fills the official ARRL radiogram PDF form (`public/radiogram-form.pdf`) with radiogram data using pdf-lib and opens the result in a new browser tab. Font sizes: 11pt for message words, 10pt for address/phone, 9pt for preamble/signature/disposition. Simple 1:1 address line mapping (line 1 → Name/Call, line 2 → Address, line 3 → City/State/ZIP).
- **auth.ts**: Firebase authentication functions
- **auth-api.ts**: Server-side Firebase ID token verification for API routes (`verifyAuth`)
- **appcheck-api.ts**: Server-side Firebase App Check token verification (`verifyAppCheck`)
- **api-fetch.ts**: Client-side fetch wrapper that attaches App Check tokens to outgoing requests
- **firebase.ts**: Client-side Firebase initialization (app, auth, Firestore, App Check). App Check is only initialized when `NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY` is set.
- **firebase-admin.ts**: Firebase Admin SDK initialization (uses `GOOGLE_APPLICATION_CREDENTIALS`); exports `getAdminApp()` and `getAdminAuth()`
- **qrz.ts**: QRZ.com XML API client for operator lookups
- **content.ts**: Markdown content loader with local override (`content/local/` → `content/default/` fallback)

### Tag System

Station tags drive UI display and report formatting:
- **Status tags** (single letter): `/T` (Traffic), `/A` (Announcement), `/S` (Secure), `/IO` (In-and-out), `/M` (Mobile), `/P` (Portable)
- **Role tags**: `/NC` (Net Control), `/ANC` (Alternate NC)
- **Liaison tags** (multi-letter): e.g., `/OC`, `/HVN` - used for net liaisons

The `isStatusTag()` and `getTagLabel()` utilities in `types/index.ts` differentiate tag types.

### API Routes

All API routes (except `/api/health`) are protected by Firebase App Check. Authenticated routes additionally verify Firebase ID tokens. Client code must use `apiFetch()` from `lib/api-fetch.ts` instead of `fetch()` for all API calls so the App Check token is attached.

- **app/api/qrz/route.ts**: QRZ.com callsign lookups (App Check + auth)
- **app/api/credentials/route.ts**: Password encryption (App Check + auth)
- **app/api/login-banner/route.ts**: Serves markdown banner for login/signup pages (App Check only)
- **app/api/login-background/route.ts**: Serves login background image (App Check only)
- **app/api/header-message/route.ts**: Serves markdown message for page headers (App Check only)
- **app/api/about/route.ts**: Serves about page content (App Check only)
- **app/api/privacy-policy/route.ts**: Serves full privacy policy (App Check only)
- **app/api/privacy-policy-summary/route.ts**: Serves privacy policy summary (App Check only)
- **app/api/health/route.ts**: Health check endpoint (no protection — used by monitoring)

### Main Components

- **app/net/page.tsx**: Main logging interface orchestrating all functionality; renders a three-column grid with CheckInForm+CheckInList on the left and SessionSummary+Checklist+RadiogramList on the right
- **app/sessions/page.tsx**: Session history list with New Session button in the main content area (not the header); accepts `?new=1` to auto-open the modal on load
- **app/radiograms/page.tsx**: Cross-session radiogram history, sortable by date, net name, type, and disposition
- **app/settings/page.tsx**: User profile settings including `receivingStationName` (printed in the RECEIVED AT section of radiogram PDFs, distinct from the operator's first name used for signatures)
- **components/SessionSummary.tsx**: Displays session metadata (Net Name, Date, Start/End, NC/ANC, station/traffic counts) with an inline Edit modal
- **components/CheckInForm.tsx**: Single-line check-in input; supports callsign search (`?` prefix), tag parsing, and QRZ lookups; includes the Walt Whitman easter egg for callsign P0ET
- **components/CheckInList.tsx**: Scrollable list of checked-in stations; auto-scrolls to bottom on new check-in
- **components/Checklist.tsx**: Traffic and announcements checklist
- **components/RadiogramList.tsx**: List of radiograms with inline RadiogramForm for creating and editing; passes `userProfile` through for print support
- **components/RadiogramForm.tsx**: ARRL standard radiogram entry form. Includes: `addressPhone` field beneath the addressee textarea; green ✓ / red ✗ indicator next to the Check field (compares entered value against actual word count); Print button that calls `printRadiogram()`; `userProfile` prop for RECEIVED AT data
- **components/ReadOnlyRadiogram.tsx**: Read-only radiogram viewer with Print button
- **components/StationCard.tsx**: Individual station row with inline editing for callsign, name, location, and note
- **components/AuthProvider.tsx**: Firebase auth context with Google profile photo caching
- **components/HeaderBanner.tsx**: Inline markdown banner in page headers

### Scripts

- **scripts/import_stations.py**: Import station callsigns/nicknames from CSV into Firestore
- **scripts/update_lastseen.py**: Backfill station `lastSeen` from historical session data

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

Optional for local development:
```
NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN    # Register in Firebase Console → App Check → Manage debug tokens
```

QRZ credentials are stored per-user in Firestore, not in environment variables.

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

- **`Radiogram`**: includes `addressPhone?: string` (addressee phone number) in addition to the standard ARRL preamble/address/text/signature fields
- **`UserProfile`**: includes `receivingStationName?: string` (for RECEIVED AT on printed radiograms, separate from `name` used for signatures)

## TypeScript

- Strict mode enabled
- Path alias `@/*` maps to project root
- Central type definitions in `types/index.ts`

## ESLint

`npm run lint` currently fails due to an incompatibility between ESLint 9.x (installed) and Next.js 14's `next lint` command, which passes options removed in ESLint 9. This is a pre-existing issue unrelated to application code. Use `npx tsc --noEmit` for type checking and `npm run build` to validate the codebase.

## ChunkLoadError Handling

`next.config.js` sets webpack `chunkLoadTimeout` to 300 000 ms (5 minutes) to give the dev server time to compile on first request after a restart. `app/layout.tsx` includes an inline script that auto-reloads the page on any `ChunkLoadError` (covers both the dev restart case and stale chunk hashes after a production deploy).
