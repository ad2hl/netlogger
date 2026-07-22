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
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getFirebaseAuth, getFirebaseDb, getFirebaseAppCheck } from './firebase';
import { UserProfile, DEFAULT_DISPOSITION_METHODS } from '@/types';

const googleProvider = new GoogleAuthProvider();

// After the browser has been idle for a long stretch (e.g. laptop asleep for hours),
// the token Firestore attaches to its first request can be rejected by the server as
// stale even though it looked valid client-side -- forcing a fresh App Check token
// alone did not fix this (confirmed in the wild: the retry below fired and still got
// permission-denied), so this also forces a fresh Firebase Auth ID token, since
// Firestore's credentials layer pulls from the User object's own (non-forced, cached)
// token. Retrying once recovers automatically instead of requiring a second manual
// sign-in click.
async function withAuthRetry<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if ((error as { code?: string })?.code !== 'permission-denied') throw error;

    console.warn('Firestore call got permission-denied; retrying with forced Auth ID token and App Check token refreshes', error);

    try {
      await getFirebaseAuth().currentUser?.getIdToken(true);
    } catch {
      // Fall through and retry anyway — the original error will surface if this doesn't help.
    }

    const appCheck = getFirebaseAppCheck();
    if (appCheck) {
      try {
        await getToken(appCheck, true);
      } catch {
        // Fall through and retry anyway — the original error will surface if this doesn't help.
      }
    }
    return await operation();
  }
}

export async function signInWithGoogle(): Promise<{ user: User | null; error?: string }> {
  try {
    const result = await signInWithPopup(getFirebaseAuth(), googleProvider);
    const user = result.user;

    // The pre-warm in firebase.ts is fire-and-forget; the popup can close before
    // the reCAPTCHA token fetch finishes. Awaiting here ensures the App Check
    // token is ready before the first Firestore call.
    const appCheck = getFirebaseAppCheck();
    if (appCheck) {
      try {
        await getToken(appCheck, false);
      } catch {
        // Continue — Firestore will try to attach its own token
      }
    }

    const userDocRef = doc(getFirebaseDb(), 'users', user.uid);
    const userDoc = await withAuthRetry(() => getDoc(userDocRef));

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
        qrzUsername: '',
        qrzPassword: '',
        dispositionMethods: DEFAULT_DISPOSITION_METHODS,
      };
      await withAuthRetry(() => setDoc(userDocRef, defaultProfile));
    }

    return { user };
  } catch (error) {
    console.error('Error signing in with Google:', error);
    return { user: null };
  }
}

export async function signOut(): Promise<void> {
  try {
    await firebaseSignOut(getFirebaseAuth());
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
        qrzUsername: '',
        qrzPassword: '',
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
  try {
    const userDocRef = doc(getFirebaseDb(), 'users', uid);
    const userDoc = await getDoc(userDocRef);
    if (userDoc.exists()) {
      return userDoc.data() as UserProfile;
    }
    return null;
  } catch (error) {
    console.error('Error getting user profile:', error);
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
