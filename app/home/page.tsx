'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/components/AuthProvider';
import { getActiveSession } from '@/lib/firestore';
import { signOut } from '@/lib/auth';
import { NetSession } from '@/types';
import { Timestamp } from 'firebase/firestore';

export default function HomePage() {
  const { user, loading, emailVerified } = useAuth();
  const router = useRouter();
  const [bgUrl, setBgUrl] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<NetSession | null | undefined>(undefined);

  useEffect(() => {
    if (!loading && (!user || !emailVerified)) {
      router.push('/');
    }
  }, [user, loading, emailVerified, router]);

  useEffect(() => {
    fetch('/api/login-background')
      .then((res) => {
        if (res.ok) return res.blob();
        return null;
      })
      .then((blob) => {
        if (blob) setBgUrl(URL.createObjectURL(blob));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) return;
    getActiveSession(user.uid).then((session) => {
      setActiveSession(session ?? null);
    });
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  const handleResumeSession = () => {
    if (activeSession?.id) {
      router.push(`/net?session=${activeSession.id}`);
    }
  };

  const handleNewSession = () => {
    router.push('/sessions?new=1');
  };

  const bgStyle = bgUrl
    ? { backgroundImage: `url(${bgUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : {};

  if (loading || !user) return null;

  const activeSessionDate = activeSession?.date instanceof Timestamp
    ? activeSession.date.toDate().toLocaleDateString()
    : activeSession?.date
      ? (activeSession.date as Timestamp).toDate?.()?.toLocaleDateString() ?? ''
      : '';

  return (
    <div className="flex-1 flex items-center justify-center relative" style={bgStyle}>
      {bgUrl && <div className="absolute inset-0 bg-black/40" />}
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4 relative z-10">
        <div className="flex items-center justify-center gap-3 mb-8">
          <Image src="/icon.png" alt="NetLogger icon" width={40} height={40} />
          <h1 className="text-3xl font-bold">AD2HL Net Logger</h1>
        </div>

        <div className="space-y-3">
          <button
            onClick={handleNewSession}
            className="w-full text-left bg-cyan-700 text-white rounded-lg py-3 px-5 hover:bg-cyan-900 transition-colors font-medium"
          >
            Create a new net session
          </button>

          <button
            onClick={handleResumeSession}
            disabled={!activeSession}
            className="w-full text-left rounded-lg py-3 px-5 transition-colors font-medium border disabled:opacity-40 disabled:cursor-not-allowed enabled:hover:bg-slate-50 border-slate-300 text-slate-700"
          >
            <span>Resume most recent net session</span>
            {activeSession && (
              <span className="block text-sm font-normal text-slate-500 mt-0.5">
                {activeSession.netName} &mdash; {activeSessionDate} {activeSession.startTime}
              </span>
            )}
          </button>

          <button
            onClick={() => router.push('/sessions')}
            className="w-full text-left rounded-lg py-3 px-5 hover:bg-slate-50 transition-colors font-medium border border-slate-300 text-slate-700"
          >
            Manage sessions
          </button>

          <button
            onClick={() => router.push('/radiograms')}
            className="w-full text-left rounded-lg py-3 px-5 hover:bg-slate-50 transition-colors font-medium border border-slate-300 text-slate-700"
          >
            Manage radiograms
          </button>

          <button
            onClick={() => router.push('/stations')}
            className="w-full text-left rounded-lg py-3 px-5 hover:bg-slate-50 transition-colors font-medium border border-slate-300 text-slate-700"
          >
            Manage users
          </button>

          <a
            href="/help?page=overview"
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-left rounded-lg py-3 px-5 hover:bg-slate-50 transition-colors font-medium border border-slate-300 text-slate-700"
          >
            Get help
          </a>

          <button
            onClick={handleSignOut}
            className="w-full text-left rounded-lg py-3 px-5 hover:bg-slate-50 transition-colors font-medium text-slate-500 hover:text-slate-700"
          >
            Sign off
          </button>
        </div>
      </div>
    </div>
  );
}
