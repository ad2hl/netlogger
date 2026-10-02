# Firebase App Check in NetLogger

## What is App Check?

Firebase App Check is a security layer that verifies API requests originate from the legitimate
NetLogger web app, not from scripts or unauthorized clients. It works by having the browser obtain
a short-lived token from Google's reCAPTCHA Enterprise service and attach it to every API request.
The server verifies the token before processing the request.

## Is App Check Required?

Yes — App Check is required for all core functionality.

App Check is enforced at two levels:

1. **Firebase Console (Firestore)** — Firestore itself rejects all reads and writes that lack a
   valid App Check token. This covers sessions, check-ins, radiograms, and all other direct
   Firestore operations from the browser.
2. **Server-side API routes** — Each Next.js API route (except `/api/health`) calls `verifyAppCheck`
   and returns HTTP 401 if the token is missing or invalid.

| Feature | Enforced by | Effect if App Check is absent |
|---|---|---|
| Sessions, check-ins, radiograms | Firestore (Firebase Console) | Fails — Firestore rejects all reads/writes |
| Net report generation | Firestore (Firebase Console) | Fails — cannot read session data |
| Callsign lookups (Callook/HamDB) | API route | Fails with HTTP 401 |
| Login/signup page banner | API route | Banner not displayed |
| Page header message | API route | Message not displayed |
| About page content | API route | Content not displayed |
| Privacy policy | API route | Content not displayed |

Without a valid App Check token the app cannot read or write any data.

## Local Development with the Debug Provider

During local development you can bypass reCAPTCHA entirely using the Firebase App Check
debug provider. You do **not** need `NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY` in your
local `.env.local`.

### First-time setup (bootstrapping your debug token)

1. Start the dev server with no App Check env vars set (`npm run dev`).
2. Open the browser console. You will see:
   ```
   AppCheck debug token: '<uuid>'. You will need to safelist it in the Firebase console for it to work.
   ```
3. Copy the UUID.
4. In the Firebase Console, go to **App Check → Apps → your app → Manage debug tokens** and
   register the UUID.

That's it. On every subsequent `npm run dev` the same UUID is auto-generated (it is stable
for the browser/origin) and App Check works without any env vars.

> **Do not ship a debug token to production.** Debug mode is only active when
> `NODE_ENV === 'development'` (i.e. `npm run dev`). Production builds (`npm run build`)
> require a real reCAPTCHA site key.

## App Check and the Firebase Free Tier

NetLogger uses the `ReCaptchaEnterpriseProvider`, which requires Google Cloud billing to be enabled
on your Firebase project (i.e., the Blaze pay-as-you-go plan rather than the free Spark plan).
However, reCAPTCHA Enterprise includes **1 million free assessments per month**, so the practical
cost for a self-hosted personal or club instance is $0.

If you prefer not to enable billing, you have two options:

### Option 1: Use reCAPTCHA v3 instead (free, no billing required)

Replace the provider in `lib/firebase.ts`:

```ts
// Replace this import:
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';

// With:
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

// And change the initializeAppCheck call:
appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider(siteKey),
  isTokenAutoRefreshEnabled: true,
});
```

You would also register a reCAPTCHA v3 site key (instead of Enterprise) in the
[Google reCAPTCHA Admin Console](https://www.google.com/recaptcha/admin) and set it as
`NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY` (the variable name can stay the same).
Then enable App Check in Firebase Console using the reCAPTCHA v3 provider.

### Option 2: Remove App Check entirely

If you are running a private instance and are comfortable without this protection layer:

1. In the Firebase Console, go to **App Check → APIs** and disable enforcement for **Cloud Firestore**.
2. Delete the `verifyAppCheck` calls at the top of each file in `app/api/` (except
   `app/api/health/route.ts`, which is already unprotected).

Both steps are required — disabling enforcement only in the API routes will still leave Firestore
rejecting direct client SDK calls.

## Summary for Self-Hosters

- **App Check is required for all functionality**, including core logging. Without it, Firestore
  rejects every read and write.
- Use reCAPTCHA Enterprise (Blaze plan, free up to 1M/month), reCAPTCHA v3 (free, code change
  needed), or remove App Check enforcement entirely (Firebase Console + API route changes).
- **reCAPTCHA Enterprise** is what the hosted instance at netlogger.ad2hl.net uses. It requires
  billing to be enabled but costs nothing within the free quota.
