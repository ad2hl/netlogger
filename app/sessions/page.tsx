'use client';

import React, { Suspense, useEffect, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { getAllSessions, deleteSession, createSession, updateSession } from '@/lib/firestore';
import ProfileMenu from '@/components/ProfileMenu';
import { NetSession } from '@/types';
import { Timestamp } from 'firebase/firestore';
import HeaderBanner from '@/components/HeaderBanner';

type SortColumn = 'date' | 'startTime' | 'endTime' | 'netName' | 'ncs' | 'ancs' | 'duration' | 'stations' | 'trafficReported' | 'trafficCleared';

function getNCS(session: NetSession): string {
  const nc = session.checkIns.find(c => c.tags.includes('NC'));
  return nc?.callsign || '—';
}

function getANCS(session: NetSession): string {
  const anc = session.checkIns.find(c => c.tags.includes('ANC'));
  return anc?.callsign || '—';
}

function computeDurationMinutes(session: NetSession): number {
  const [startH, startM] = session.startTime.split(':').map(Number);
  const startMinutes = startH * 60 + startM;

  if (session.endTime) {
    const [endH, endM] = session.endTime.split(':').map(Number);
    const endMinutes = endH * 60 + endM;
    return endMinutes >= startMinutes ? endMinutes - startMinutes : (1440 - startMinutes) + endMinutes;
  }

  // Active session: compute from start to now
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return nowMinutes >= startMinutes ? nowMinutes - startMinutes : (1440 - startMinutes) + nowMinutes;
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export default function SessionsPage() {
  return (
    <Suspense fallback={null}>
      <SessionsContent />
    </Suspense>
  );
}

function SessionsContent() {
  const { user, loading, emailVerified, photoURL } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const openOnLoad = searchParams.get('new') === '1';
  const isWelcome = searchParams.get('welcome') === '1';
  const [sessions, setSessions] = useState<NetSession[]>([]);
  const [fetching, setFetching] = useState(true);
  const [sortColumn, setSortColumn] = useState<SortColumn>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [deleteTarget, setDeleteTarget] = useState<NetSession | null>(null);
  const [showNewSessionModal, setShowNewSessionModal] = useState(false);
  const [showActiveWarning, setShowActiveWarning] = useState(false);
  const [showGettingStarted, setShowGettingStarted] = useState(false);
  const [doNotShowAgain, setDoNotShowAgain] = useState(false);
  const [newNetName, setNewNetName] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newStartTime, setNewStartTime] = useState('');

  useEffect(() => {
    if (!loading && (!user || !emailVerified)) {
      router.push('/');
    }
  }, [user, loading, emailVerified, router]);

  useEffect(() => {
    if (user) {
      getAllSessions(user.uid).then((s) => {
        setSessions(s);
        setFetching(false);
        if (openOnLoad) {
          const now = new Date();
          const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
          setNewNetName(s[0]?.netName || '');
          setNewDate(todayStr);
          setNewStartTime(s[0]?.startTime || '');
          setShowNewSessionModal(true);
        } else if (isWelcome && !localStorage.getItem('netlogger:hideGettingStarted')) {
          setShowGettingStarted(true);
        }
      });
    }
  // openOnLoad is derived from URL params and stable for the lifetime of this page load
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const sortedSessions = useMemo(() => {
    const sorted = [...sessions];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortColumn) {
        case 'date':
          cmp = a.date.toDate().getTime() - b.date.toDate().getTime();
          if (cmp === 0) cmp = a.startTime.localeCompare(b.startTime);
          if (cmp === 0) cmp = a.netName.localeCompare(b.netName);
          // For date, desc means newest first for both date and startTime
          return sortDirection === 'asc' ? cmp : -cmp;
        case 'startTime':
          cmp = a.startTime.localeCompare(b.startTime);
          break;
        case 'endTime': {
          const aEnd = a.endTime || '';
          const bEnd = b.endTime || '';
          cmp = aEnd.localeCompare(bEnd);
          break;
        }
        case 'netName':
          cmp = a.netName.localeCompare(b.netName);
          break;
        case 'ncs':
          cmp = getNCS(a).localeCompare(getNCS(b));
          break;
        case 'ancs':
          cmp = getANCS(a).localeCompare(getANCS(b));
          break;
        case 'duration':
          cmp = computeDurationMinutes(a) - computeDurationMinutes(b);
          break;
        case 'stations':
          cmp = a.checkIns.length - b.checkIns.length;
          break;
        case 'trafficReported':
          cmp = a.trafficReported - b.trafficReported;
          break;
        case 'trafficCleared':
          cmp = a.trafficCleared - b.trafficCleared;
          break;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [sessions, sortColumn, sortDirection]);

  const handleSort = (column: SortColumn) => {
    if (column === sortColumn) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const sortArrow = (column: SortColumn) => {
    if (column !== sortColumn) return null;
    return sortDirection === 'asc' ? ' ↑' : ' ↓';
  };

  const handleDeleteSession = async () => {
    if (!user || !deleteTarget?.id) return;
    const success = await deleteSession(user.uid, deleteTarget.id);
    if (success) {
      setSessions((prev) => prev.filter((s) => s.id !== deleteTarget.id));
    }
    setDeleteTarget(null);
  };

  const openNewSessionModal = () => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    setNewNetName(sessions[0]?.netName || '');
    setNewDate(todayStr);
    setNewStartTime(sessions[0]?.startTime || '');
    setShowNewSessionModal(true);
  };

  const handleNewSessionClick = () => {
    const active = sessions.find((s) => !s.endTime);
    if (active) {
      setShowActiveWarning(true);
    } else {
      openNewSessionModal();
    }
  };

  const handleProceedFromWarning = async () => {
    if (!user) return;
    const active = sessions.find((s) => !s.endTime);
    if (active?.id) {
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      await updateSession(user.uid, active.id, { endTime: timeStr });
      setSessions((prev) => prev.map((s) => s.id === active.id ? { ...s, endTime: timeStr } : s));
    }
    setShowActiveWarning(false);
    openNewSessionModal();
  };

  const handleCreateNewSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const [year, month, day] = newDate.split('-').map(Number);
    const localDate = new Date(year, month - 1, day);
    const sessionId = await createSession(user.uid, {
      netName: newNetName,
      date: Timestamp.fromDate(localDate),
      startTime: newStartTime,
      endTime: null,
      trafficReported: 0,
      trafficCleared: 0,
      checkIns: [],
      radiograms: [],
    });
    if (sessionId) {
      router.push(`/net?session=${sessionId}`);
    }
  };

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

  const handleDismissGettingStarted = () => {
    if (doNotShowAgain) {
      localStorage.setItem('netlogger:hideGettingStarted', '1');
    }
    setShowGettingStarted(false);
  };

  useEffect(() => {
    if (!showGettingStarted) return;
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') handleDismissGettingStarted(); };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showGettingStarted, doNotShowAgain]);

  if (loading || !user) {
    return null;
  }

  return (
    <div>
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-900">AD2HL Net Logger</h1>
            <HeaderBanner />
          </div>
          <div className="flex items-center gap-4">
            <Link href="/sessions" className="text-cyan-700 hover:text-cyan-900 text-sm">Sessions</Link>
            <Link href="/radiograms" className="text-cyan-700 hover:text-cyan-900 text-sm">Radiograms</Link>
            <Link href="/stations" className="text-cyan-700 hover:text-cyan-900 text-sm">Stations</Link>
            <a href="/help?page=sessions" target="_blank" rel="noopener noreferrer" className="text-cyan-700 hover:text-cyan-900 text-sm">Help</a>
            <ProfileMenu photoURL={photoURL} />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-slate-900">Sessions</h2>
          <button
            onClick={handleNewSessionClick}
            className="bg-cyan-700 text-white py-1 px-3 rounded-md hover:bg-cyan-900 text-sm"
          >
            New Session
          </button>
        </div>

        {fetching ? (
          <p className="text-slate-500">Loading...</p>
        ) : sortedSessions.length === 0 ? (
          <p className="text-slate-500">No sessions found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-600">
                  <th className="py-2 pr-4 cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort('date')}>
                    Date{sortArrow('date')}
                  </th>
                  <th className="py-2 pr-4 cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort('startTime')}>
                    Start{sortArrow('startTime')}
                  </th>
                  <th className="py-2 pr-4 cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort('endTime')}>
                    End{sortArrow('endTime')}
                  </th>
                  <th className="py-2 pr-4 cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort('netName')}>
                    Net Name{sortArrow('netName')}
                  </th>
                  <th className="py-2 pr-4 cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort('ncs')}>
                    NCS{sortArrow('ncs')}
                  </th>
                  <th className="py-2 pr-4 cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort('ancs')}>
                    ANCS{sortArrow('ancs')}
                  </th>
                  <th className="py-2 pr-4 cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort('stations')}>
                    Stations{sortArrow('stations')}
                  </th>
                  <th className="py-2 pr-4 cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort('trafficReported')}>
                    Rptd{sortArrow('trafficReported')}
                  </th>
                  <th className="py-2 pr-4 cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort('trafficCleared')}>
                    Clrd{sortArrow('trafficCleared')}
                  </th>
                  <th className="py-2 pr-4 cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort('duration')}>
                    Duration{sortArrow('duration')}
                  </th>
                  <th className="py-2 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {sortedSessions.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b hover:bg-slate-50 cursor-pointer"
                    onClick={() => router.push(`/net?session=${s.id}`)}
                  >
                    <td className="py-2 pr-4 whitespace-nowrap">
                      {s.date.toDate().toLocaleDateString()}
                    </td>
                    <td className="py-2 pr-4 whitespace-nowrap">{s.startTime}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">
                      {s.endTime || 'Active'}
                    </td>
                    <td className="py-2 pr-4">{s.netName}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">{getNCS(s)}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">{getANCS(s)}</td>
                    <td className="py-2 pr-4">{s.checkIns.length}</td>
                    <td className="py-2 pr-4">{s.trafficReported}</td>
                    <td className="py-2 pr-4">{s.trafficCleared}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">
                      {s.endTime ? formatDuration(computeDurationMinutes(s)) : 'Active'}
                    </td>
                    <td className="py-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(s); }}
                        className="text-slate-400 hover:text-red-600 p-1"
                        title="Delete session"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                          <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.519.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {deleteTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Delete Session?</h2>
            <p className="text-gray-600 mb-6">
              This will permanently delete the session <strong>{deleteTarget.netName}</strong> from{' '}
              <strong>{deleteTarget.date.toDate().toLocaleDateString()}</strong> at <strong>{deleteTarget.startTime}</strong>, including all check-ins, radiograms, and reports.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteSession}
                className="px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-md text-sm font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

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

      {showGettingStarted && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-900">Welcome to AD2HL Net Logger</h2>
              <button
                onClick={handleDismissGettingStarted}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            </div>
            <p className="text-gray-600 mb-6">
              To get started, click on the <strong>New Session</strong> button to create a new net session.
            </p>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-gray-500 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={doNotShowAgain}
                  onChange={(e) => setDoNotShowAgain(e.target.checked)}
                  className="rounded"
                />
                Do not show this again
              </label>
              <button
                onClick={handleDismissGettingStarted}
                className="px-4 py-2 text-white bg-cyan-700 hover:bg-cyan-900 rounded-md text-sm font-medium"
              >
                OK
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
                <input
                  type="time"
                  value={newStartTime}
                  onChange={(e) => setNewStartTime(e.target.value)}
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
