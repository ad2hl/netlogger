'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signOut } from '@/lib/auth';

interface ProfileMenuProps {
  photoURL: string | null;
}

export default function ProfileMenu({ photoURL }: ProfileMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const handleSignOut = async () => {
    setOpen(false);
    await signOut();
    router.push('/');
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center"
        aria-label="Account menu"
      >
        <img
          src={photoURL || '/profile-head.png'}
          alt="Account"
          className="w-7 h-7 rounded-full object-cover border border-slate-200"
          referrerPolicy="no-referrer"
          onError={(e) => { e.currentTarget.src = '/profile-head.png'; }}
        />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-36 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50">
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Settings
          </Link>
          <button
            onClick={handleSignOut}
            className="flex w-full items-center px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
