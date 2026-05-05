'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signOut } from '@/lib/auth';

export default function ProfileMenu() {
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  return (
    <>
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
