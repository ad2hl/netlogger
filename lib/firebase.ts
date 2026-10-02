import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { initializeAppCheck, getToken, AppCheck, ReCaptchaEnterpriseProvider, CustomProvider } from 'firebase/app-check';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let appCheck: AppCheck;
function ensureInitialized() {
  if (typeof window === 'undefined') return;

  if (!app || !auth || !db) {
    app = !getApps().length
      ? initializeApp(firebaseConfig)
      : getApps()[0];

    auth = getAuth(app);
    db = getFirestore(app);

    if (process.env.NODE_ENV === 'development') {
      self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }

    const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY;
    if (siteKey) {
      appCheck = initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(siteKey),
        isTokenAutoRefreshEnabled: true,
      });
      // Pre-warm the token immediately. Firebase only fetches the first token on demand,
      // so without this, the first Firestore call after a fast Google sign-in can race
      // against the token fetch and fail. Errors are ignored — the SDK will retry.
      getToken(appCheck, false).catch(() => {});
    } else if (debugValue) {
      // No reCAPTCHA site key, but debug mode is active. Initialize App Check with a
      // CustomProvider — the FIREBASE_APPCHECK_DEBUG_TOKEN set above intercepts all token
      // requests before the provider is invoked, so the provider never actually runs.
      appCheck = initializeAppCheck(app, {
        provider: new CustomProvider({
          getToken: () => Promise.resolve({
            token: typeof debugValue === 'string' ? debugValue : '',
            expireTimeMillis: Date.now() + 3600 * 1000,
          }),
        }),
        isTokenAutoRefreshEnabled: true,
      });
    } else {
      console.warn('App Check: NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY is not set. API requests will not include App Check tokens.');
    }
  }
}

export function getFirebaseAuth(): Auth {
  ensureInitialized();
  return auth;
}

export function getFirebaseDb(): Firestore {
  ensureInitialized();
  return db;
}

export function getFirebaseAppCheck(): AppCheck | undefined {
  ensureInitialized();
  return appCheck;
}
