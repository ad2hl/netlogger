# NetLogger

A web-based amateur radio net logging application for net control operators.

## Features

- **Station Check-ins**: Log stations with callsign and optional tags
- **Tag System**:
  - `/NC` - Net Control
  - `/ANC` - Alternate Net Control
  - `/T` - Has traffic (highlighted)
  - `/A` - Has announcement (highlighted)
  - `/M` - Mobile
  - `/P` - Portable
  - `/S` or `/IO` - Secure/In-and-out (highlighted)
  - `/XXX` - Liaison to XXX net
- **QRZ.com Integration**: Automatic callsign lookups for operator names
- **Station Memory**: Remembers nicknames, notes, and last-seen dates across sessions
- **Traffic Checklist**: Track traffic and announcements per station with check-off items
- **Radiogram Management**: Create, edit, and store ARRL-format radiograms
- **Radiogram Printing**: Fill and print the official ARRL radiogram PDF form directly from the app
- **Net Report**: Generates a formatted radiogram report with callsign compression
- **Session History**: Browse and review past net sessions in a sortable table
- **Radiogram History**: Cross-session radiogram and net report list, sortable by date, net name, type, and disposition
- **Firebase Backend**: Persistent storage with Google authentication and App Check security

## Availability

The latest stable version of NetLogger is available to all amateur radio operators at **https://netlogger.ad2hl.net**.

You do **not** need the source code to use NetLogger. You need it only if you want to modify it and/or deploy it
on your own server (which you are welcome to do, as long as you observe the terms of the license agreement).
Instructions for installing from source are below.

If you need help with NetLogger, you can email support /a≥t/ ad2hl ° net. (Unusual punctuation added in attempt
to thwart email scrapers.) If you find a bug in NetLogger, or have an idea for an enhancement, please open a GitHub
issue.

## Setup

### Prerequisites

- Node.js 18.17+
- A Firebase project with Authentication, Firestore, and App Check enabled
- (Optional) QRZ.com XML subscription for callsign lookups

### Firebase Configuration

1. Create a project at [Firebase Console](https://console.firebase.google.com)
2. Enable **Authentication** with Google sign-in provider
3. Enable **Firestore Database**
4. Enable **App Check** with reCAPTCHA Enterprise and register your site key
5. Add Firestore security rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;

      match /stations/{stationId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }

      match /sessions/{sessionId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

6. Get your web app config from Project Settings

### Installation

```bash
git clone https://github.com/rd914/netlogger.git
cd netlogger
npm install
```

### Environment Variables

Copy the example file and fill in your Firebase config:

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY=your-recaptcha-site-key
```

For local development, register a debug token in Firebase Console → App Check → Manage debug tokens, then add:

```
NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN=your-debug-token
```

For server-side API routes on non-Google-Cloud hosts, provide a service account:

```
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

### Running

```bash
npm run dev
```

Open http://localhost:3000

## Usage

1. Sign in with Google — you are taken directly to any active session, or prompted to start a new one
2. Go to **Settings** to configure:
   - Your callsign, name, and location
   - Net manager callsign (report addressee)
   - Receiving station name (printed in the RECEIVED AT section of radiogram forms)
   - QRZ.com credentials (optional)
   - Custom sent/received disposition methods (optional)
3. Start a new net session with name, date, and start time
4. Check in stations by typing a callsign with tags (e.g., `W1AW/NC/T`)
5. Click station names, locations, or notes to edit them inline
6. Use the traffic checklist to track announcements and traffic per station
7. Create radiograms as needed — the Check field shows a green ✓ or red ✗ indicating whether the entered count matches the actual word count; use **Print** to fill and open the official ARRL radiogram PDF
8. Click **End Session**, then **Show Report** to view and copy the generated radiogram report
9. Browse past sessions and radiograms from the **Sessions** and **Radiograms** pages

## Docker Deployment

The app uses `output: 'standalone'` for Docker. Because Next.js inlines `NEXT_PUBLIC_*` variables at build time, they must be passed as build arguments:

```bash
docker-compose --env-file .env up --build
```

The `docker-compose.yml` maps all `NEXT_PUBLIC_*` variables from `.env` as build args. Runtime variables (e.g., `GOOGLE_APPLICATION_CREDENTIALS`) are passed via `env_file`.

## Tech Stack

- [Next.js 14](https://nextjs.org/) (App Router)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Firebase](https://firebase.google.com/) (Auth + Firestore + App Check)
- [pdf-lib](https://pdf-lib.js.org/) (ARRL radiogram PDF filling)

## License

GPLv3
