'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/components/AuthProvider';
import { getActiveSession, createSession, updateSession } from '@/lib/firestore';
import { signOut } from '@/lib/auth';
import { apiFetch } from '@/lib/api-fetch';
import ContentRenderer from '@/components/ContentRenderer';
import { NetSession } from '@/types';
import { useUtc } from '@/lib/useUtc';
import { nowParts, sessionToDisplay, sessionToStored, formatDateString, formatTimeString } from '@/lib/time';
import TimeInput from '@/components/TimeInput';

const linkClass = 'block w-full text-left rounded-lg py-3 px-5 hover:bg-slate-50 transition-colors font-medium border border-slate-300 text-slate-700';

export default function HomePage() {
  const { user, loading, emailVerified } = useAuth();
  const router = useRouter();
  const utc = useUtc();
  const [bgUrl, setBgUrl] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<NetSession | null | undefined>(undefined);
  const [showNewSessionModal, setShowNewSessionModal] = useState(false);
  const [showActiveWarning, setShowActiveWarning] = useState(false);
  const [showFirstUseNotice, setShowFirstUseNotice] = useState(false);
  const [welcomeContent, setWelcomeContent] = useState<{ content: string; type: 'html' | 'md' } | null>(null);
  const [newNetName, setNewNetName] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newStartTime, setNewStartTime] = useState('');

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
    const key = `netlogger:firstUseNotice:${user.uid}`;
    if (!localStorage.getItem(key)) {
      apiFetch('/api/welcome')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.content) {
            setWelcomeContent({ content: data.content, type: data.type ?? 'md' });
            setShowFirstUseNotice(true);
          }
        })
        .catch(() => {});
    }
  }, [user]);

  useEffect(() => {
    if (!showNewSessionModal) return;
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowNewSessionModal(false); };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showNewSessionModal]);

  useEffect(() => {
    if (!showActiveWarning) return;
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowActiveWarning(false); };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showActiveWarning]);

  const dismissFirstUseNotice = () => {
    if (!user) return;
    localStorage.setItem(`netlogger:firstUseNotice:${user.uid}`, '1');
    setShowFirstUseNotice(false);
  };

  const openNewSessionModal = () => {
    setNewNetName(activeSession?.netName || '');
    setNewDate(nowParts(utc).date);
    setNewStartTime(activeSession ? sessionToDisplay(activeSession, utc).startTime : '');
    setShowNewSessionModal(true);
  };

  const handleNewSessionClick = () => {
    if (activeSession) {
      setShowActiveWarning(true);
    } else {
      openNewSessionModal();
    }
  };

  const handleProceedFromWarning = () => {
    setShowActiveWarning(false);
    openNewSessionModal();
  };

  const handleCreateNewSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (activeSession?.id) {
      await updateSession(user.uid, activeSession.id, { endTime: nowParts(true).time });
    }
    const sessionId = await createSession(user.uid, {
      netName: newNetName,
      ...sessionToStored({ date: newDate, startTime: newStartTime }, utc),
      trafficReported: 0,
      trafficCleared: 0,
      checkIns: [],
      radiogramIds: [],
    });
    if (sessionId) {
      router.push(`/net?session=${sessionId}`);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  const bgStyle = bgUrl
    ? { backgroundImage: `url(${bgUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : {};

  if (loading || !user) return null;

  const activeSessionDate = activeSession?.date
    ? formatDateString(sessionToDisplay(activeSession, utc).date)
    : '';

  const resumeHref = activeSession?.id ? `/net?session=${activeSession.id}` : undefined;

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
            onClick={handleNewSessionClick}
            className="w-full text-left bg-cyan-700 text-white rounded-lg py-3 px-5 hover:bg-cyan-900 transition-colors font-medium"
          >
            Create a new net session
          </button>

          {resumeHref ? (
            <Link href={resumeHref} className={linkClass}>
              <span>Resume most recent net session</span>
              <span className="block text-sm font-normal text-slate-500 mt-0.5">
                {activeSession!.netName} &mdash; {activeSessionDate} {formatTimeString(sessionToDisplay(activeSession!, utc).startTime, utc)}
              </span>
            </Link>
          ) : (
            <span className={`${linkClass} opacity-40 cursor-not-allowed`}>
              Resume most recent net session
            </span>
          )}

          <Link href="/sessions" className={linkClass}>Manage sessions</Link>

          <Link href="/radiograms" className={linkClass}>Manage radiograms</Link>

          <Link href="/stations" className={linkClass}>Manage stations</Link>

          <a
            href="/help?page=overview"
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
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

      {showActiveWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-900">Session In Progress</h2>
              <button
                onClick={() => setShowActiveWarning(false)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            </div>
            <p className="text-gray-600 mb-6">
              A session is currently in progress. Starting a new session will end the active session. Do you want to proceed?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowActiveWarning(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleProceedFromWarning}
                className="px-4 py-2 text-white bg-cyan-700 hover:bg-cyan-900 rounded-md text-sm font-medium"
              >
                Proceed
              </button>
            </div>
          </div>
        </div>
      )}

      {showFirstUseNotice && welcomeContent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <div className="prose prose-sm text-gray-600 mb-6">
              <ContentRenderer content={welcomeContent.content} type={welcomeContent.type} />
            </div>
            <div className="flex justify-end">
              <button
                onClick={dismissFirstUseNotice}
                className="px-4 py-2 text-white bg-cyan-700 hover:bg-cyan-900 rounded-md text-sm font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showNewSessionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">New Session</h2>
              <button
                onClick={() => setShowNewSessionModal(false)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreateNewSession} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Net Name</label>
                <input
                  type="text"
                  value={newNetName}
                  onChange={(e) => setNewNetName(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="e.g., SDN"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Start Time</label>
                <TimeInput
                  utc={utc}
                  value={newStartTime}
                  onChange={setNewStartTime}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500"
                  required
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewSessionModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-white bg-cyan-700 hover:bg-cyan-900 rounded-md text-sm font-medium"
                >
                  OK
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
