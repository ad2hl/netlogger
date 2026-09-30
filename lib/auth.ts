import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  updatePassword as firebaseUpdatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  User,
  AuthError,
} from 'firebase/auth';
import { getToken } from 'firebase/app-check';
import { doc, getDoc, setDoc, disableNetwork, enableNetwork } from 'firebase/firestore';
import { getFirebaseAuth, getFirebaseDb, getFirebaseAppCheck } from './firebase';
import { markActivity, clearActivity } from './session-activity';
import { UserProfile, DEFAULT_DISPOSITION_METHODS } from '@/types';

const googleProvider = new GoogleAuthProvider();

// ---------------------------------------------------------------------------
// Issue #214 diagnostics — TEMPORARY.
//
// The permission-denied on first Google sign-in has now survived three fixes,
// because every recovery step in withAuthRetry swallowed its own failure. This
// instrumentation makes each step report what actually happened so one more
// failed login identifies the broken layer conclusively.
//
// Raw token material is never logged — only presence, length, and expiry — so
// console output is safe to paste into the issue. Remove this block and its
// call sites (grep for "#214") once the root cause is confirmed.
// ---------------------------------------------------------------------------
const DIAG = '[signin-diag #214]';

export function diag(step: string, detail?: unknown): void {
  if (detail === undefined) {
    console.info(`${DIAG} ${step}`);
  } else {
    console.info(`${DIAG} ${step}`, detail);
  }
}

function describeError(error: unknown): Record<string, unknown> {
  const e = error as { code?: string; name?: string; message?: string } | null;
  return { code: e?.code, name: e?.name, message: e?.message };
}

/** Short, non-identifying prefix so two uids can be compared without logging either. */
function shortUid(uid: string | undefined | null): string | null {
  return uid ? `${uid.slice(0, 6)}…` : null;
}

/**
 * Reports presence/shape/expiry of a token without exposing it. Firebase ID
 * tokens and App Check tokens are both JWTs; App Check *debug* tokens are bare
 * UUIDs, which show up here as `decodable: false` — itself a useful signal.
 */
function describeToken(token: string | undefined | null): Record<string, unknown> {
  if (!token) return { present: false };
  const info: Record<string, unknown> = { present: true, length: token.length };
  try {
    const [, payloadPart] = token.split('.');
    if (!payloadPart) return { ...info, decodable: false };
    const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const payload = JSON.parse(atob(padded)) as Record<string, unknown>;
    info.decodable = true;
    info.aud = payload.aud;
    info.sub = typeof payload.sub === 'string' ? shortUid(payload.sub) : undefined;
    if (typeof payload.exp === 'number') {
      info.expiresAt = new Date(payload.exp * 1000).toISOString();
      info.expiresInSeconds = Math.round(payload.exp - Date.now() / 1000);
      info.alreadyExpired = payload.exp * 1000 <= Date.now();
    }
  } catch {
    info.decodable = false;
  }
  return info;
}

function describeAppCheckState(): Record<string, unknown> {
  return {
    initialized: !!getFirebaseAppCheck(),
    siteKeyConfigured: !!process.env.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY,
  };
}

// After the browser has been idle for a long stretch (e.g. laptop asleep for hours),
// the first Firestore call after Google sign-in can fail with permission-denied even
// though a fresh Auth ID token and a fresh App Check token are both available --
// confirmed in the wild that forcing either (or both) of those alone does not fix it.
// That points at a different layer: Firestore keeps a persistent network stream that
// can be holding stale credentials from before this token refresh, and won't pick up
// the new ones until it reconnects. Force that reconnect (disableNetwork then
// enableNetwork) in addition to refreshing both tokens, then retry once.
async function withAuthRetry<T>(operation: () => Promise<T>, label: string): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if ((error as { code?: string })?.code !== 'permission-denied') {
      diag(`${label}: failed with a non-permission error`, describeError(error)); // #214
      throw error;
    }

    console.warn('Firestore call got permission-denied; refreshing tokens and forcing a Firestore reconnect before retrying', error);
    diag(`${label}: permission-denied on first attempt`, describeError(error)); // #214

    const auth = getFirebaseAuth();
    diag('recovery: auth state', { hasCurrentUser: !!auth.currentUser, uid: shortUid(auth.currentUser?.uid) }); // #214

    try {
      const idToken = await auth.currentUser?.getIdToken(true);
      diag('recovery: forced ID token refresh OK', describeToken(idToken)); // #214
    } catch (refreshError) {
      // Fall through and retry anyway — the original error will surface if this doesn't help.
      diag('recovery: forced ID token refresh FAILED', describeError(refreshError)); // #214
    }

    const appCheck = getFirebaseAppCheck();
    if (appCheck) {
      try {
        const appCheckToken = await getToken(appCheck, true);
        diag('recovery: forced App Check refresh OK', describeToken(appCheckToken?.token)); // #214
      } catch (appCheckError) {
        // Fall through and retry anyway — the original error will surface if this doesn't help.
        diag('recovery: forced App Check refresh FAILED', describeError(appCheckError)); // #214
      }
    } else {
      // With Firestore App Check enforcement on, this alone explains the denial.
      diag('recovery: App Check NOT INITIALIZED — no token will be attached', describeAppCheckState()); // #214
    }

    try {
      const db = getFirebaseDb();
      await disableNetwork(db);
      await enableNetwork(db);
      diag('recovery: Firestore network reconnect OK'); // #214
    } catch (networkError) {
      // Fall through and retry anyway — the original error will surface if this doesn't help.
      diag('recovery: Firestore network reconnect FAILED', describeError(networkError)); // #214
    }

    try {
      const retried = await operation();
      diag(`${label}: retry SUCCEEDED`); // #214
      return retried;
    } catch (retryError) {
      diag(`${label}: retry FAILED`, describeError(retryError)); // #214
      throw retryError;
    }
  }
}

export async function signInWithGoogle(): Promise<{ user: User | null; error?: string }> {
  let popupUser: User | null = null;
  try {
    diag('start', describeAppCheckState()); // #214

    // Start the idle clock before opening the popup. AuthProvider's onAuthStateChanged
    // listener fires while signInWithPopup is still settling, and must not judge this
    // brand-new sign-in against a timestamp from the operator's previous visit.
    markActivity();

    const result = await signInWithPopup(getFirebaseAuth(), googleProvider);
    const user = result.user;
    popupUser = user;
    diag('popup resolved — Google OAuth succeeded', { uid: shortUid(user.uid) }); // #214

    // The pre-warm in firebase.ts is fire-and-forget; the popup can close before
    // the reCAPTCHA token fetch finishes. Awaiting here ensures the App Check
    // token is ready before the first Firestore call.
    const appCheck = getFirebaseAppCheck();
    if (appCheck) {
      try {
        const appCheckToken = await getToken(appCheck, false);
        diag('pre-read App Check token OK', describeToken(appCheckToken?.token)); // #214
      } catch (appCheckError) {
        // Continue — Firestore will try to attach its own token
        diag('pre-read App Check token FAILED', describeError(appCheckError)); // #214
      }
    } else {
      diag('pre-read App Check NOT INITIALIZED', describeAppCheckState()); // #214
    }

    // A currentUser/popup uid mismatch would fail the `request.auth.uid == userId`
    // rule outright, so confirm they agree before blaming the token layer. // #214
    const authForDiag = getFirebaseAuth();
    diag('pre-read auth state', {
      hasCurrentUser: !!authForDiag.currentUser,
      currentUid: shortUid(authForDiag.currentUser?.uid),
      popupUid: shortUid(user.uid),
      uidsMatch: authForDiag.currentUser?.uid === user.uid,
    });
    try {
      diag('pre-read ID token', describeToken(await authForDiag.currentUser?.getIdToken(false))); // #214
    } catch (idTokenError) {
      diag('pre-read ID token FAILED', describeError(idTokenError)); // #214
    }

    const userDocRef = doc(getFirebaseDb(), 'users', user.uid);
    const userDoc = await withAuthRetry(() => getDoc(userDocRef), 'getDoc users/{uid}');

    if (!userDoc.exists()) {
      if (process.env.NEXT_PUBLIC_DISABLE_SIGNUP === 'true') {
        await firebaseSignOut(getFirebaseAuth());
        return { user: null, error: 'Account creation is disabled. Contact an administrator.' };
      }
      const defaultProfile: UserProfile = {
        callsign: '',
        name: user.displayName?.split(' ')[0] || '',
        location: '',
        netManagerCall: '',
        lookupService: 'callook',
        dispositionMethods: DEFAULT_DISPOSITION_METHODS,
      };
      await withAuthRetry(() => setDoc(userDocRef, defaultProfile), 'setDoc users/{uid}');
    }

    diag('SUCCESS'); // #214
    return { user };
  } catch (error) {
    console.error('Error signing in with Google:', error);
    diag('FAILED', describeError(error)); // #214

    // The popup succeeded even though the Firestore call didn't, so Firebase Auth
    // is still holding a signed-in user while the UI reports failure. Clear it so
    // the next attempt is a genuine fresh sign-in rather than a no-op that only
    // appears to work because the session was already established.
    if (popupUser) {
      try {
        await firebaseSignOut(getFirebaseAuth());
        diag('signed out after failure'); // #214
      } catch (signOutError) {
        diag('sign out after failure FAILED', describeError(signOutError)); // #214
      }
    }

    const code = (error as { code?: string })?.code;
    return {
      user: null,
      error:
        code === 'permission-denied'
          ? 'Signed in with Google, but the database rejected the request (permission denied). Please try again.'
          : 'Google sign-in failed. Please try again.',
    };
  }
}

export async function signOut(): Promise<void> {
  try {
    await firebaseSignOut(getFirebaseAuth());
    clearActivity();
  } catch (error) {
    console.error('Error signing out:', error);
  }
}

function getAuthErrorMessage(error: AuthError): string {
  switch (error.code) {
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/invalid-credential':
      return 'Invalid email or password.';
    case 'auth/user-not-found':
      return 'No account found with this email.';
    case 'auth/wrong-password':
      return 'Invalid email or password.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    case 'auth/operation-not-allowed':
      return 'Email/password sign-in is not enabled. Please contact an administrator.';
    case 'auth/admin-restricted-operation':
      return 'Account creation is not currently allowed. Please contact an administrator.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your connection and try again.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
}

export async function signUpWithEmail(
  email: string,
  password: string
): Promise<{ user?: User; error?: string }> {
  if (process.env.NEXT_PUBLIC_DISABLE_SIGNUP === 'true') {
    return { error: 'Account creation is disabled. Contact an administrator.' };
  }
  try {
    markActivity();
    const result = await createUserWithEmailAndPassword(
      getFirebaseAuth(),
      email,
      password
    );
    const user = result.user;

    await sendEmailVerification(user);

    const userDocRef = doc(getFirebaseDb(), 'users', user.uid);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
      const defaultProfile: UserProfile = {
        callsign: '',
        name: '',
        location: '',
        netManagerCall: '',
        lookupService: 'callook',
        dispositionMethods: DEFAULT_DISPOSITION_METHODS,
      };
      await setDoc(userDocRef, defaultProfile);
    }

    return { user };
  } catch (error) {
    console.error('signUpWithEmail error:', error);
    return { error: getAuthErrorMessage(error as AuthError) };
  }
}

export async function signInWithEmail(
  email: string,
  password: string
): Promise<{ user?: User; error?: string }> {
  try {
    markActivity();
    const result = await signInWithEmailAndPassword(
      getFirebaseAuth(),
      email,
      password
    );
    return { user: result.user };
  } catch (error) {
    return { error: getAuthErrorMessage(error as AuthError) };
  }
}

export async function sendPasswordReset(email: string): Promise<{ success: boolean; error?: string }> {
  try {
    await sendPasswordResetEmail(getFirebaseAuth(), email);
    return { success: true };
  } catch (error) {
    return { success: false, error: getAuthErrorMessage(error as AuthError) };
  }
}

export async function resendVerificationEmail(user: User): Promise<{ success: boolean; error?: string }> {
  try {
    await sendEmailVerification(user);
    return { success: true };
  } catch (error) {
    return { success: false, error: getAuthErrorMessage(error as AuthError) };
  }
}

export async function changePassword(
  user: User,
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const credential = EmailAuthProvider.credential(user.email!, currentPassword);
    await reauthenticateWithCredential(user, credential);
    await firebaseUpdatePassword(user, newPassword);
    return { success: true };
  } catch (error) {
    return { success: false, error: getAuthErrorMessage(error as AuthError) };
  }
}

export function onAuthChange(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(getFirebaseAuth(), callback);
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  // AuthProvider calls this from onAuthStateChanged, which fires at essentially
  // the same moment signInWithGoogle reads the same document. Logging both makes
  // that interleaving (and withAuthRetry's instance-wide disableNetwork landing
  // on top of it) visible in the timeline. // #214
  diag('getUserProfile: start', { uid: shortUid(uid) }); // #214
  try {
    const userDocRef = doc(getFirebaseDb(), 'users', uid);
    const userDoc = await getDoc(userDocRef);
    diag('getUserProfile: OK', { exists: userDoc.exists() }); // #214
    if (userDoc.exists()) {
      return userDoc.data() as UserProfile;
    }
    return null;
  } catch (error) {
    console.error('Error getting user profile:', error);
    diag('getUserProfile: FAILED', describeError(error)); // #214
    return null;
  }
}

export async function updateUserProfile(
  uid: string,
  profile: Partial<UserProfile>
): Promise<boolean> {
  try {
    const userDocRef = doc(getFirebaseDb(), 'users', uid);
    await setDoc(userDocRef, profile, { merge: true });
    return true;
  } catch (error) {
    console.error('Error updating user profile:', error);
    return false;
  }
}
