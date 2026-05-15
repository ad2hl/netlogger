'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signOut } from '@/lib/auth';
import { useAuth } from '@/components/AuthProvider';

export default function ProfileMenu() {
  const router = useRouter();
  const { user, profile } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  return (
    <>
      {user?.email && (
        <span className="text-sm text-slate-500">
          {user.email}{profile?.callsign ? ` (${profile.callsign})` : ''}
        </span>
      )}
      <Link href="/settings" className="text-cyan-700 hover:text-cyan-900 text-sm">Settings</Link>
      <button
        onClick={handleSignOut}
        className="text-cyan-700 hover:text-cyan-900 text-sm"
      >
        Sign Out
      </button>
    </>
  );
}
