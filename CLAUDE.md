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
- **auth-api.ts**: Server-side Firebase ID token verification for API routes
- **firebase-admin.ts**: Firebase Admin SDK initialization (uses `GOOGLE_APPLICATION_CREDENTIALS`)
- **qrz.ts**: QRZ.com XML API client for operator lookups
- **content.ts**: Markdown content loader with local override (`content/local/` → `content/default/` fallback)

### Tag System

Station tags drive UI display and report formatting:
- **Status tags** (single letter): `/T` (Traffic), `/A` (Announcement), `/S` (Secure), `/IO` (In-and-out), `/M` (Mobile), `/P` (Portable)
- **Role tags**: `/NC` (Net Control), `/ANC` (Alternate NC)
- **Liaison tags** (multi-letter): e.g., `/OC`, `/HVN` - used for net liaisons

The `isStatusTag()` and `getTagLabel()` utilities in `types/index.ts` differentiate tag types.

### API Routes

- **app/api/qrz/route.ts**: QRZ.com callsign lookups (authenticated via Firebase ID token)
- **app/api/credentials/route.ts**: Password encryption (authenticated via Firebase ID token)
- **app/api/login-banner/route.ts**: Serves markdown banner for login/signup pages
- **app/api/header-message/route.ts**: Serves markdown message for page headers

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
```

QRZ credentials are stored per-user in Firestore, not in environment variables.

### Server-Side Authentication

API routes are protected by Firebase Admin SDK token verification. The client sends `Authorization: Bearer <token>` headers. On non-Google-Cloud hosts (e.g., AWS EC2), set:
```
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

## Color Scheme

UI uses cyan-700 for primary actions, sky shades for backgrounds/hover states, and amber-700 for radiogram-related buttons (New Radiogram, Create Radiogram).

## TypeScript

- Strict mode enabled
- Path alias `@/*` maps to project root
- Central type definitions in `types/index.ts`
