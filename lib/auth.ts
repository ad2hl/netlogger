import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getFirebaseAuth, getFirebaseDb } from './firebase';
import { UserProfile } from '@/types';

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
