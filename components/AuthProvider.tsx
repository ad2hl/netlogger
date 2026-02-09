'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';
import { onAuthChange, getUserProfile } from '@/lib/auth';
import { UserProfile } from '@/types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  refreshProfile: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

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
          setUser(authUser);
          if (authUser) {
            const userProfile = await getUserProfile(authUser.uid);
            setProfile(userProfile);
          } else {
            setProfile(null);
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
    <AuthContext.Provider value={{ user, profile, loading, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
