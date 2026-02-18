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
- Firebase (Authentication + Firestore)
- Tailwind CSS
- React 18 with client components

## Architecture

### Data Layer

Firebase Firestore with user-scoped subcollections:
- `users/{uid}/stations/{callsign}` - Station memory (nicknames, notes, last-seen)
- `users/{uid}/sessions/{sessionId}` - Net sessions with check-ins, radiograms, checklist items

### Key Libraries (lib/)

- **firestore.ts**: All database CRUD operations for stations, sessions, check-ins
- **radiogram.ts**: Complex callsign compression algorithm for ARRL format reports. Orders output as NC → ANC → Liaisons → Regular stations. Compresses callsigns by prefix (e.g., W1AW, W1XYZ → W1AW, XYZ)
- **auth.ts**: Firebase authentication functions
- **auth-api.ts**: Server-side Firebase ID token verification for API routes (`verifyAuth`)
- **appcheck-api.ts**: Server-side Firebase App Check token verification (`verifyAppCheck`)
- **api-fetch.ts**: Client-side fetch wrapper that attaches App Check tokens to outgoing requests
- **firebase.ts**: Client-side Firebase initialization (app, auth, Firestore, App Check)
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

- **app/net/page.tsx**: Main logging interface orchestrating all functionality
- **components/Checklist.tsx**: Traffic and announcements checklist
- **components/RadiogramForm.tsx**: ARRL standard radiogram entry form
- **components/StationCard.tsx**: Individual station display with editing
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

## TypeScript

- Strict mode enabled
- Path alias `@/*` maps to project root
- Central type definitions in `types/index.ts`
