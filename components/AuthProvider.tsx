'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';
import { onAuthChange, getUserProfile, signOut, diag } from '@/lib/auth';
import { getLastActivity, markActivity } from '@/lib/session-activity';
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
            // Expire the session on observed inactivity rather than on
            // metadata.lastSignInTime. During a popup sign-in Firebase hands this
            // listener a user object whose lastSignInTime still describes the
            // operator's *previous* login, so timing against it signed the user
            // out in the middle of the sign-in that had just authenticated them
            // and left Firestore rejecting reads with request.auth == null.
            const lastActivity = getLastActivity();
            const timeoutMs = SESSION_TIMEOUT_HOURS * 60 * 60 * 1000;
            diag('AuthProvider: onAuthChange fired', {
              lastActivity: lastActivity ? new Date(lastActivity).toISOString() : null,
              idleHours: lastActivity
                ? +((Date.now() - lastActivity) / 3_600_000).toFixed(2)
                : null,
              timeoutHours: SESSION_TIMEOUT_HOURS,
            }); // #214
            if (lastActivity === null) {
              // Nothing recorded yet — a first sign-in, an operator upgrading from
              // a build that predates activity tracking, or cleared storage. Start
              // the clock instead of treating the session as infinitely old.
              markActivity();
            } else if (Date.now() - lastActivity > timeoutMs) {
              diag('AuthProvider: SESSION TIMEOUT — signing out'); // #214
              await signOut();
              setUser(null);
              setProfile(null);
              setEmailVerified(false);
              return;
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

  // Keep the idle clock fresh while the operator is using the app, so a long net
  // never expires the session out from under them. Writes are throttled because
  // these events fire constantly.
  useEffect(() => {
    if (!user) return;

    const THROTTLE_MS = 60_000;
    let lastWrite = 0;
    const record = () => {
      const now = Date.now();
      if (now - lastWrite < THROTTLE_MS) return;
      lastWrite = now;
      markActivity(now);
    };
    const recordIfVisible = () => {
      if (document.visibilityState === 'visible') record();
    };

    record();

    const events = ['pointerdown', 'keydown', 'focus'] as const;
    events.forEach((event) => window.addEventListener(event, record));
    document.addEventListener('visibilitychange', recordIfVisible);

    return () => {
      events.forEach((event) => window.removeEventListener(event, record));
      document.removeEventListener('visibilitychange', recordIfVisible);
    };
  }, [user]);

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
