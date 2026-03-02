'use client';

import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { db } from '@/lib/db/index';
import { UserProfile } from '@/types';
import { AuthContext } from '@/components/AuthProvider';

// A minimal User-like object that satisfies the AuthContextType without Firebase.
// Cast as unknown then User to avoid importing the full Firebase User interface.
const LOCAL_USER = {
  uid: 'local-user',
  email: null,
  displayName: null,
  photoURL: null,
  emailVerified: true,
  providerData: [],
  metadata: {},
  getIdToken: async () => 'desktop-token',
  reload: async () => {},
} as unknown as User;

export function DesktopAuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = async () => {
    const userProfile = await db.getUserProfile('local-user');
    setProfile(userProfile);
  };

  useEffect(() => {
    db.getUserProfile('local-user').then((p) => {
      setProfile(p);
      setLoading(false);
    });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user: LOCAL_USER,
        profile,
        loading,
        emailVerified: true,
        photoURL: null,
        refreshProfile,
        refreshUser: async () => {},
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
