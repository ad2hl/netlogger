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
- **Radiogram Management**: Create and store ARRL-format radiograms during the net
- **Net Report**: Generates formatted radiogram report with callsign compression
- **Session History**: Browse and review past net sessions
- **Firebase Backend**: Persistent storage with Google authentication

## Setup

### Prerequisites

- Node.js 18.17+
- A Firebase project with Authentication and Firestore enabled
- (Optional) QRZ.com XML subscription for callsign lookups

### Firebase Configuration

1. Create a project at [Firebase Console](https://console.firebase.google.com)
2. Enable **Authentication** with Google sign-in provider
3. Enable **Firestore Database**
4. Add Firestore security rules:

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

5. Get your web app config from Project Settings

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
```

### Running

```bash
npm run dev
```

Open http://localhost:3000

## Usage

1. Sign in with Google — you are taken directly to any active session, or prompted to start a new one
2. Go to **Settings** to configure:
   - Your callsign
   - Your name (for report signature)
   - Your location
   - Net manager callsign (report addressee)
   - QRZ.com credentials (optional)
3. Start a new net session with name, date, and start time
4. Check in stations by typing a callsign with tags (e.g., `W1AW/NC/T`)
5. Click station names, locations, or notes to edit them inline
6. Use the traffic checklist to track announcements and traffic per station
7. Create radiograms as needed during the net
8. Click **End Session**, then **Show Report** to view and copy the generated radiogram report
9. Browse past sessions and radiograms from the **Sessions** and **Radiograms** pages

## Tech Stack

- [Next.js 14](https://nextjs.org/) (App Router)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Firebase](https://firebase.google.com/) (Auth + Firestore)

## License

MIT
