import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { readFileSync } from 'fs';

let app: App;
let auth: Auth;

export function getAdminApp(): App {
  if (!app) {
    const existingApps = getApps();
    if (existingApps.length > 0) {
      app = existingApps[0];
    } else {
      const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      if (serviceAccountPath) {
        const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
        app = initializeApp({ credential: cert(serviceAccount) });
      } else {
        app = initializeApp();
      }
    }
  }
  return app;
}

export function getAdminAuth(): Auth {
  if (!auth) {
    auth = getAuth(getAdminApp());
  }
  return auth;
}
