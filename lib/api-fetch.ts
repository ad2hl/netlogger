import { getToken } from 'firebase/app-check';
import { getFirebaseAppCheck } from './firebase';

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);

  const appCheck = getFirebaseAppCheck();
  if (appCheck) {
    try {
      const tokenResult = await getToken(appCheck, false);
      headers.set('X-Firebase-AppCheck', tokenResult.token);
    } catch (error) {
      console.error('Failed to get App Check token:', error);
    }
  }

  return fetch(input, { ...init, headers });
}
