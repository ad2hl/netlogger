'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signOut } from '@/lib/auth';
import { useAuth } from '@/components/AuthProvider';

interface NavMenuProps {
  helpPage?: string;
}

export default function NavMenu({ helpPage }: NavMenuProps) {
  const router = useRouter();
  const { user, profile } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  const linkClass = 'text-cyan-700 hover:text-cyan-900 text-sm';

  return (
    <>
      {user?.email && (
        <span className="text-sm text-slate-500">
          {user.email}{profile?.callsign ? ` (${profile.callsign})` : ''}
        </span>
      )}
      <Link href="/sessions" className={linkClass}>Sessions</Link>
      <Link href="/radiograms" className={linkClass}>Radiograms</Link>
      <Link href="/stations" className={linkClass}>Stations</Link>
      {helpPage && (
        <a
          href={`/help?page=${helpPage}`}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
        >
          Help
        </a>
      )}
      <Link href="/settings" className={linkClass}>Settings</Link>
      <button onClick={handleSignOut} className={linkClass}>
        Sign Out
      </button>
    </>
  );
}
