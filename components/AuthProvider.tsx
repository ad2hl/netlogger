'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';
import { onAuthChange, getUserProfile, signOut } from '@/lib/auth';
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
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  emailVerified: false,
  refreshProfile: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [emailVerified, setEmailVerified] = useState(false);

  const refreshProfile = async () => {
    if (user) {
      const userProfile = await getUserProfile(user.uid);
      setProfile(userProfile);
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
            if (lastSignIn) {
              const elapsed = Date.now() - new Date(lastSignIn).getTime();
              const timeoutMs = SESSION_TIMEOUT_HOURS * 60 * 60 * 1000;
              if (elapsed > timeoutMs) {
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

  return (
    <AuthContext.Provider value={{ user, profile, loading, emailVerified, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
