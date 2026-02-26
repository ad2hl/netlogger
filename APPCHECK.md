# Firebase App Check in NetLogger

## What is App Check?

Firebase App Check is a security layer that verifies API requests originate from the legitimate
NetLogger web app, not from scripts or unauthorized clients. It works by having the browser obtain
a short-lived token from Google's reCAPTCHA Enterprise service and attach it to every API request.
The server verifies the token before processing the request.

## Is App Check Required?

It depends on which features you use.

NetLogger's core logging functionality — sessions, check-ins, radiograms, net reports — operates
through direct Firestore calls from the browser and does not involve App Check at all. App Check
only applies to the server-side API routes.

| Feature | Protected by App Check? | Effect if App Check is absent |
|---|---|---|
| Sessions, check-ins, radiograms | No — direct Firestore | Works normally |
| Net report generation | No — client-side | Works normally |
| QRZ callsign lookups | Yes | Fails with HTTP 401 |
| Login/signup page banner | Yes | Banner not displayed |
| Page header message | Yes | Message not displayed |
| About page content | Yes | Content not displayed |
| Privacy policy | Yes | Content not displayed |
| QRZ credential encryption | Yes | Fails with HTTP 401 |

The only functionally significant impact of running without App Check is that **QRZ callsign lookups
will not work**. The banner and content routes serve optional customization text; their failure is
cosmetic.

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

If you are running a private instance and are comfortable without this protection layer, you can
remove App Check enforcement from the API routes by deleting the `verifyAppCheck` calls at the top
of each file in `app/api/` (except `app/api/health/route.ts`, which is already unprotected).

## Summary for Self-Hosters

- **Core logging works on the free Spark plan** with no App Check configuration.
- **QRZ lookups require App Check.** Use reCAPTCHA Enterprise (Blaze plan, free up to 1M/month),
  reCAPTCHA v3 (free, code change needed), or remove App Check enforcement if you don't need QRZ.
- **reCAPTCHA Enterprise** is what the hosted instance at netlogger.ad2hl.net uses. It requires
  billing to be enabled but costs nothing within the free quota.
