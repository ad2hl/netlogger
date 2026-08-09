'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';
import { onAuthChange, getUserProfile, signOut, diag } from '@/lib/auth';
import { UserProfile } from '@/types';

const SESSION_TIMEOUT_HOURS = parseInt(
  process.env.NEXT_PUBLIC_SESSION_TIMEOUT_HOURS || '8',
  10
);

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  emailVerified: boolean;
  photoURL: string | null;
  refreshProfile: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  emailVerified: false,
  photoURL: null,
  refreshProfile: async () => {},
  refreshUser: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [emailVerified, setEmailVerified] = useState(false);
  const [cachedPhotoURL, setCachedPhotoURL] = useState<string | null>(null);

  const refreshProfile = async () => {
    if (user) {
      const userProfile = await getUserProfile(user.uid);
      setProfile(userProfile);
    }
  };

  const refreshUser = async () => {
    if (user) {
      await user.reload();
      const isPasswordProvider = user.providerData.some(
        (p) => p.providerId === 'password'
      );
      setEmailVerified(isPasswordProvider ? user.emailVerified : true);
    }
  };

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    try {
      unsubscribe = onAuthChange(async (authUser) => {
        try {
          if (authUser) {
            // Check session timeout
            const lastSignIn = authUser.metadata.lastSignInTime;
            // On page load Firebase replays the *persisted* session here, so
            // lastSignInTime can be hours stale even when the user is signing in
            // right now. If that trips the timeout, the signOut below lands in
            // the middle of the in-flight Google sign-in and nulls request.auth,
            // which Firestore rules reject as permission-denied. // #214
            diag('AuthProvider: onAuthChange fired', {
              lastSignIn,
              elapsedHours: lastSignIn
                ? +((Date.now() - new Date(lastSignIn).getTime()) / 3_600_000).toFixed(2)
                : null,
              timeoutHours: SESSION_TIMEOUT_HOURS,
            });
            if (lastSignIn) {
              const elapsed = Date.now() - new Date(lastSignIn).getTime();
              const timeoutMs = SESSION_TIMEOUT_HOURS * 60 * 60 * 1000;
              if (elapsed > timeoutMs) {
                diag('AuthProvider: SESSION TIMEOUT — signing out'); // #214
                await signOut();
                setUser(null);
                setProfile(null);
                setEmailVerified(false);
                return;
              }
            }

            setUser(authUser);

            // Determine email verification status
            const isPasswordProvider = authUser.providerData.some(
              (p) => p.providerId === 'password'
            );
            setEmailVerified(
              isPasswordProvider ? authUser.emailVerified : true
            );

            const userProfile = await getUserProfile(authUser.uid);
            setProfile(userProfile);
          } else {
            setUser(null);
            setProfile(null);
            setEmailVerified(false);
          }
        } finally {
          setLoading(false);
        }
      });

      // Safety net: authStateReady() resolves when the initial auth state
      // is determined, ensuring loading clears even if the listener misfires
      getFirebaseAuth()?.authStateReady?.()
        .then(() => setLoading(false))
        .catch(() => setLoading(false));
    } catch (error) {
      console.error('Failed to initialize auth:', error);
      setLoading(false);
    }

    return () => unsubscribe?.();
  }, []);

  // Fetch and cache user photo as a blob URL to avoid repeated requests to Google
  useEffect(() => {
    const remoteURL = user?.photoURL
      || user?.providerData?.find((p) => p.providerId === 'google.com')?.photoURL
      || null;

    if (!remoteURL) {
      setCachedPhotoURL(null);
      return;
    }

    let revoked = false;
    fetch(remoteURL, { referrerPolicy: 'no-referrer' })
      .then((res) => {
        if (res.ok) return res.blob();
        return null;
      })
      .then((blob) => {
        if (blob && !revoked) {
          setCachedPhotoURL(URL.createObjectURL(blob));
        }
      })
      .catch(() => {});

    return () => {
      revoked = true;
    };
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, profile, loading, emailVerified, photoURL: cachedPhotoURL, refreshProfile, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}
