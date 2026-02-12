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
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getFirebaseAuth, getFirebaseDb } from './firebase';
import { UserProfile, DEFAULT_DISPOSITION_METHODS } from '@/types';

const googleProvider = new GoogleAuthProvider();

export async function signInWithGoogle(): Promise<User | null> {
  try {
    const result = await signInWithPopup(getFirebaseAuth(), googleProvider);
    const user = result.user;

    const userDocRef = doc(getFirebaseDb(), 'users', user.uid);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
      const defaultProfile: UserProfile = {
        callsign: '',
        name: user.displayName?.split(' ')[0] || '',
        location: '',
        netManagerCall: '',
        qrzUsername: '',
        qrzPassword: '',
        dispositionMethods: DEFAULT_DISPOSITION_METHODS,
      };
      await setDoc(userDocRef, defaultProfile);
    }

    return user;
  } catch (error) {
    console.error('Error signing in with Google:', error);
    return null;
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
    default:
      return 'An unexpected error occurred. Please try again.';
  }
}

export async function signUpWithEmail(
  email: string,
  password: string
): Promise<{ user?: User; error?: string }> {
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
